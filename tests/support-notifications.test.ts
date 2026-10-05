import assert from "node:assert/strict";
import test from "node:test";
import { deliverSupportAlerts } from "../lib/support-notifications";
import { GET } from "../app/api/cron/support-notifications/route";

const ticket = { id: "test-id", reference: "AC-TEST", area: "Training", impact: "This feature is blocked" };
test("failed sends remain pending and do not prevent later reports being notified", async () => {
  const marked: string[] = [];
  const result = await deliverSupportAlerts({
    pending: async () => [ticket, { ...ticket, id: "second", reference: "AC-SECOND" }],
    send: async (row) => { if (row.id === ticket.id) throw Error("provider unavailable"); return "email-second"; },
    markSent: async (id) => { marked.push(id); },
  });
  assert.deepEqual(marked, ["second"]);
  assert.deepEqual(result, { checked: 2, sent: 1, failed: ["AC-TEST"] });
});
test("database-write failure retries with the same provider idempotency key", async () => {
  let pending = true;
  let failWrite = true;
  const keys: string[] = [];
  const deps = {
    pending: async () => pending ? [ticket] : [],
    send: async (_ticket: typeof ticket, key: string) => { keys.push(key); return "email-id"; },
    markSent: async () => { if (failWrite) throw Error("database unavailable"); pending = false; },
  };
  assert.equal((await deliverSupportAlerts(deps)).failed.length, 1);
  failWrite = false;
  assert.equal((await deliverSupportAlerts(deps)).sent, 1);
  assert.equal((await deliverSupportAlerts(deps)).checked, 0);
  assert.deepEqual(keys, ["support-alert-test-id", "support-alert-test-id"]);
});
test("notification cron refuses public callers and missing configuration", async () => {
  const previous = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await GET(new Request("https://example.invalid/api/cron/support-notifications"))).status, 401);
    process.env.CRON_SECRET = "test-secret";
    assert.equal((await GET(new Request("https://example.invalid/api/cron/support-notifications", { headers: { authorization: "Bearer wrong" } }))).status, 401);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
