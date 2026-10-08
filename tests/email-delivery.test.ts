import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { emailAttemptStatus, type DeliveryEvent, type DeliveryEventType, type EmailAttempt } from "../lib/email-delivery";
import { verifyDeliveryWebhook } from "../lib/resend-webhook";
import { trackClientEmailSend, TrackedEmailError } from "../lib/tracked-client-email";
import type { createAdminClient } from "../lib/supabase/admin";

const emailId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const secretBytes = Buffer.from("synthetic-test-signing-secret-only");
const secret = `whsec_${secretBytes.toString("base64")}`;
function signed(payload: string, timestamp = Math.floor(Date.now() / 1000)) {
  const id = "msg_synthetic_test";
  const signature = createHmac("sha256", secretBytes).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return new Headers({ "svix-id": id, "svix-timestamp": String(timestamp), "svix-signature": `v1,${signature}` });
}
function payload(type = "email.delivered", id = emailId) { return JSON.stringify({ type, created_at: "2026-10-08T10:00:00Z", data: { email_id: id, to: ["private@example.test"], subject: "Private", html: "secret recovery URL" } }); }
test("only valid raw-body signatures are accepted; stale/replayed signatures and missing configuration fail closed", () => {
  const body = payload();
  assert.deepEqual(verifyDeliveryWebhook(body, signed(body), secret), { webhook_id: "msg_synthetic_test", email_id: emailId, event_type: "email.delivered", occurred_at: "2026-10-08T10:00:00Z" });
  assert.throws(() => verifyDeliveryWebhook(`${body} `, signed(body), secret));
  assert.throws(() => verifyDeliveryWebhook(body, signed(body, Math.floor(Date.now() / 1000) - 3600), secret));
  assert.throws(() => verifyDeliveryWebhook(body, signed(body), undefined));
  assert.throws(() => verifyDeliveryWebhook(body, new Headers(), secret));
  const bad = payload("email.delivered", "not-a-provider-id");
  assert.throws(() => verifyDeliveryWebhook(bad, signed(bad), secret));
  const opened = payload("email.opened");
  assert.equal(verifyDeliveryWebhook(opened, signed(opened), secret), null);
});
const attempt: EmailAttempt = { id: otherId, kind: "setup", status: "accepted", provider_email_id: emailId, created_at: "2026-10-08T09:00:00Z", accepted_at: "2026-10-08T09:00:01Z" };
const event = (type: DeliveryEventType, time = "2026-10-08T10:00:00Z", id = emailId): DeliveryEvent => ({ webhook_id: `msg_${type}_${time}`, email_id: id, event_type: type, occurred_at: time });
test("acceptance is not delivery and unrelated provider IDs cannot change a client's status", () => {
  assert.equal(emailAttemptStatus(attempt, []).status, "accepted");
  assert.equal(emailAttemptStatus(attempt, []).delivery_verified, false);
  assert.equal(emailAttemptStatus(attempt, [event("email.delivered", undefined, otherId)]).status, "accepted");
  assert.equal(emailAttemptStatus({ ...attempt, status: "unknown", provider_email_id: null }, [event("email.delivered")]).status, "unknown");
});
test("duplicate/out-of-order sent/delayed events cannot erase delivered, bounced or complained outcomes", () => {
  const delivered = event("email.delivered");
  const sent = event("email.sent", "2026-10-08T11:00:00Z");
  const delayed = event("email.delivery_delayed", "2026-10-08T12:00:00Z");
  for (const events of [[sent, delivered, delivered, delayed], [delayed, delivered, sent]]) {
    assert.equal(emailAttemptStatus(attempt, events).status, "delivered");
    assert.equal(emailAttemptStatus(attempt, events).status_at, delivered.occurred_at);
  }
  assert.equal(emailAttemptStatus(attempt, [delivered, event("email.bounced"), sent]).status, "bounced");
  assert.equal(emailAttemptStatus(attempt, [event("email.complained"), delivered, event("email.bounced")]).status, "complained");
});
function store(options: { insertFails?: boolean; completionFails?: boolean; wrongRecipient?: boolean; existingAccepted?: boolean } = {}) {
  const state: Record<string, unknown> = { id: otherId, client_id: otherId, kind: "setup", status: "sending", provider_email_id: null };
  return { state, admin: { from() {
    let op = "select"; let changes: Record<string, unknown> = {};
    const query = {
      select() { return query; }, eq() { return query; }, is() { return query; },
      upsert(values: Record<string, unknown>) { op = "insert"; changes = values; return query; },
      update(values: Record<string, unknown>) { op = "update"; changes = values; return query; },
      async maybeSingle() { return { data: { id: otherId, user: { role: "client", email: options.wrongRecipient ? "wrong@example.test" : "client@example.test" } }, error: null }; },
      async single() { return { data: options.existingAccepted ? { ...state, status: "accepted", provider_email_id: emailId } : state, error: null }; },
      then(resolve: (value: unknown) => unknown) {
        const error = op === "insert" && options.insertFails || op === "update" && changes.status === "accepted" && options.completionFails;
        if (!error && op !== "select") Object.assign(state, changes);
        return Promise.resolve({ data: null, error: error ? { message: "synthetic storage failure" } : null }).then(resolve);
      },
    }; return query;
  } } as unknown as ReturnType<typeof createAdminClient> };
}
test("no durable tracking or mismatched client recipient means no provider send", async () => {
  let sends = 0;
  for (const options of [{ insertFails: true }, { wrongRecipient: true }]) {
    await assert.rejects(trackClientEmailSend(store(options).admin, "client@example.test", "setup", async () => { sends++; return { data: { id: emailId }, error: null, headers: null }; }, otherId), TrackedEmailError);
  }
  assert.equal(sends, 0);
});
test("accepted sends stay accepted despite completion storage failure and durable retries do not resend", async () => {
  let sends = 0;
  const send = async () => { sends++; return { data: { id: emailId }, error: null, headers: null }; };
  const result = await trackClientEmailSend(store({ completionFails: true }).admin, "client@example.test", "setup", send, otherId);
  assert.equal(result.data?.id, emailId);
  await trackClientEmailSend(store({ existingAccepted: true }).admin, "client@example.test", "setup", send, otherId, "same-existing-key");
  assert.equal(sends, 1);
});
test("explicit rejection is failed, but transport uncertainty never claims rejection or delivery", async () => {
  const rejected = store();
  await assert.rejects(trackClientEmailSend(rejected.admin, "client@example.test", "setup", async () => ({ data: null, error: { message: "Synthetic rejection", name: "validation_error", statusCode: 400 }, headers: null }), otherId), (error: unknown) => error instanceof TrackedEmailError && error.sendStatus === "failed");
  assert.equal(rejected.state.status, "failed");
  const unknown = store();
  await assert.rejects(trackClientEmailSend(unknown.admin, "client@example.test", "setup", async () => { throw new Error("Network interrupted"); }, otherId), (error: unknown) => error instanceof TrackedEmailError && error.sendStatus === "unknown");
  assert.equal(unknown.state.status, "unknown");
});


test("SDK transport/response failures and server errors remain uncertain", async () => {
  for (const error of [
    { name: "application_error" as const, statusCode: null, message: "Unable to fetch data" },
    { name: "application_error" as const, statusCode: 502, message: "Unreadable response" },
    { name: "internal_server_error" as const, statusCode: 500, message: "Server error" },
    { name: "application_error" as const, statusCode: 408, message: "Timeout" },
    { name: "concurrent_idempotent_requests" as const, statusCode: 409, message: "Request still running" },
  ]) {
    const unknown = store();
    await assert.rejects(trackClientEmailSend(unknown.admin, "client@example.test", "setup",
      async () => ({ data: null, error, headers: null }), otherId),
      (error: unknown) => error instanceof TrackedEmailError && error.sendStatus === "unknown");
    assert.equal(unknown.state.status, "unknown");
  }
});
