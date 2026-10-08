import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create table users(id uuid primary key,role text); grant select on users to authenticated;
    create table client_profiles(id uuid primary key);
    insert into users values('${id(1)}','admin'),('${id(2)}','client'); insert into client_profiles values('${id(2)}'),('${id(3)}');`);
  await db.exec(await readFile(new URL("../supabase/migrations/20261008152000_client_email_delivery_tracking.sql", import.meta.url), "utf8"));
  return db;
}
test("additive tracking enforces exact identities, unique sends/webhooks, and supports event-before-send races", async () => {
  const db = await fixture();
  try {
    await db.query("insert into client_email_delivery_events(webhook_id,email_id,event_type,occurred_at) values($1,$2,$3,now())", ["msg_first", id(9), "email.delivered"]);
    await db.query("insert into client_email_delivery_events(webhook_id,email_id,event_type,occurred_at) values($1,$2,$3,now()) on conflict(webhook_id) do nothing", ["msg_first", id(9), "email.sent"]);
    await db.query("insert into client_email_attempts(client_id,kind,idempotency_key,provider_email_id,status) values($1,'setup','key-one',$2,'accepted')", [id(2), id(9)]);
    assert.equal((await db.query("select * from client_email_delivery_events e join client_email_attempts a on a.provider_email_id=e.email_id")).rows.length, 1);
    assert.equal((await db.query<{ event_type: string }>("select event_type from client_email_delivery_events")).rows[0].event_type, "email.delivered");
    await assert.rejects(db.query("insert into client_email_attempts(client_id,kind,idempotency_key) values($1,'setup','key-two')", [id(99)]), /foreign key/);
    await assert.rejects(db.query("insert into client_email_attempts(client_id,kind,idempotency_key,provider_email_id) values($1,'setup','key-two',$2)", [id(3), id(9)]), /unique/);
  } finally { await db.close(); }
});
test("clients and anonymous users cannot read or write delivery history; admins read and service role writes", async () => {
  const db = await fixture();
  try {
    await db.query("insert into client_email_attempts(client_id,kind,idempotency_key) values($1,'setup','key')", [id(2)]);
    await db.exec(`set role authenticated; set test.uid='${id(2)}'`);
    assert.equal((await db.query("select * from client_email_attempts")).rows.length, 0);
    assert.equal((await db.query("select * from client_email_delivery_events")).rows.length, 0);
    await assert.rejects(db.exec(`insert into client_email_delivery_events values('msg_fake','${id(9)}','email.delivered',now(),now())`), /permission denied/);
    await db.exec(`set test.uid='${id(1)}'`);
    assert.equal((await db.query("select * from client_email_attempts")).rows.length, 1);
    await assert.rejects(db.exec("update client_email_attempts set status='accepted'"), /permission denied/);
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from client_email_attempts"), /permission denied/);
    await db.exec("reset role; set role service_role");
    await db.exec(`insert into client_email_delivery_events values('msg_real','${id(9)}','email.delivered',now(),now())`);
    assert.equal((await db.query("select * from client_email_delivery_events")).rows.length, 1);
  } finally { await db.close(); }
});
