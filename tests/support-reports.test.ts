import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  validateSupportInput,
  validateSupportUpdate,
  supportTicketMatchesFilter,
} from "../lib/support-contract";
const valid = {
  submission_key: "4a82969a-4a6d-4311-b4f8-7b90ab820c11",
  name: "Alex Example",
  email: "alex@example.invalid",
  area: "Training",
  description: "Last set is not saved",
  expected: "",
  impact: "Something looks wrong",
  device: "iPhone",
  page: "/portal/exercise-plan",
};
test("report validation bounds contact/input and excludes URLs carrying private context", () => {
  assert.equal(
    validateSupportInput({ ...valid, email: " ALEX@example.invalid " }).email,
    "alex@example.invalid",
  );
  assert.equal(
    validateSupportInput({ ...valid, page: "/portal?access_token=private" })
      .page,
    "",
  );
  assert.equal(
    validateSupportInput({ ...valid, page: "//evil.example" }).page,
    "",
  );
  assert.throws(() => validateSupportInput({ ...valid, name: "" }));
  assert.throws(() => validateSupportInput({ ...valid, email: "bad" }));
  assert.throws(() =>
    validateSupportInput({ ...valid, description: "x".repeat(4001) }),
  );
  assert.throws(() => validateSupportInput({ ...valid, area: "unauthorised" }));
  assert.throws(() =>
    validateSupportInput({ ...valid, submission_key: "guessed" }),
  );
});
test("triage requires recognised status/priority and a resolution when closing", () => {
  const update = {
    status: "In progress",
    priority: "High",
    owner: "Flowstate",
    internal_notes: "Private",
    resolution: "",
  };
  assert.equal(validateSupportUpdate(update).owner, "Flowstate");
  assert.throws(() => validateSupportUpdate({ ...update, status: "Resolved" }));
  assert.throws(() =>
    validateSupportUpdate({ ...update, priority: "unknown" }),
  );
  assert.equal(
    validateSupportUpdate({
      ...update,
      status: "Resolved",
      resolution: "Retest passed",
    }).resolution,
    "Retest passed",
  );
});
test("actual SQL migration: service-only intake, idempotency and durable quota", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261005093000_support_reports.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const submit = async (input: typeof valid, hash = "test-hash") =>
      (
        await db.query<{ receipt: { reference: string; duplicate: boolean } }>(
          "select public.submit_support_report($1::jsonb,$2) receipt",
          [JSON.stringify(input), hash],
        )
      ).rows[0].receipt;
    const first = await submit(valid);
    const retry = await submit(valid);
    assert.equal(first.reference, retry.reference);
    assert.equal(first.duplicate, false);
    assert.equal(retry.duplicate, true);
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::int count from support_reports",
        )
      ).rows[0].count,
      1,
    );
    for (let i = 0; i < 4; i++)
      await submit({ ...valid, submission_key: crypto.randomUUID() });
    await assert.rejects(
      () => submit({ ...valid, submission_key: crypto.randomUUID() }),
      /SUPPORT_RATE_LIMIT/,
    );
    assert.equal(
      (await submit(valid)).reference,
      first.reference,
      "receipt retries work even after quota is reached",
    );
    await submit(
      { ...valid, submission_key: crypto.randomUUID() },
      "different-requester",
    );
    const bucket = (
      await db.query<{ public: boolean }>(
        "select public from storage.buckets where id='support-images'",
      )
    ).rows[0];
    assert.equal(bucket.public, false);
    await db.exec(
      "grant usage on schema storage to anon,authenticated;grant select,insert on storage.objects to anon,authenticated;create policy legacy_broad_storage on storage.objects for all to anon,authenticated using(true) with check(true);insert into storage.objects(bucket_id,name) values('support-images','private.jpg'),('other-bucket','other.jpg');",
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        () => db.query("select * from public.support_reports"),
        /permission denied/,
      );
      await assert.rejects(
        () => submit({ ...valid, submission_key: crypto.randomUUID() }),
        /permission denied/,
      );
      await assert.rejects(
        () => db.query("select reserve_support_request('anonymous')"),
        /permission denied/,
      );
      const objects = await db.query<{ bucket_id: string }>(
        "select bucket_id from storage.objects",
      );
      assert.deepEqual(
        objects.rows.map((row) => row.bucket_id),
        ["other-bucket"],
        "support screenshots stay hidden even with a legacy permissive storage policy",
      );
      await assert.rejects(
        () =>
          db.query(
            "insert into storage.objects(bucket_id,name) values('support-images','rogue.jpg')",
          ),
        /row-level security/,
      );
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    assert.equal(
      (
        await db.query<{ count: number }>(
          "select count(*)::int count from public.support_reports",
        )
      ).rows[0].count,
      6,
    );
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});

test("queue views include active reports and exclude resolved or duplicate reports", () => {
  assert.equal(supportTicketMatchesFilter("New", "Open"), true);
  assert.equal(supportTicketMatchesFilter("Resolved", "Open"), false);
  assert.equal(supportTicketMatchesFilter("Duplicate", "Open"), false);
  assert.equal(
    supportTicketMatchesFilter("New", "All"),
    supportTicketMatchesFilter("Resolved", "All"),
  );
  assert.notEqual(
    supportTicketMatchesFilter("New", "New"),
    supportTicketMatchesFilter("Triaged", "New"),
  );
});
