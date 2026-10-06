import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { checkinAnswers, checkinPreview } from "../lib/checkin-message";

const coach = "00000000-0000-4000-8000-000000000001";
const client = "00000000-0000-4000-8000-000000000002";
const other = "00000000-0000-4000-8000-000000000003";
const checkin = "00000000-0000-4000-8000-000000000004";
async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table users(id uuid primary key,role text);
    create table client_profiles(id uuid primary key,user_id uuid references users(id));
    create table checkin_forms(id uuid primary key,config jsonb,is_default boolean,created_at timestamptz default now());
    create table form_config(form_type text,config jsonb);
    create table checkins(id uuid primary key,client_id uuid references client_profiles(id),checkin_form_id uuid,
      created_at timestamptz default now(),mood text,wins text,challenges text,questions text,responses jsonb,admin_reply text,replied_at timestamptz);
    insert into users values('${coach}','admin'),('${client}','client'),('${other}','client');
    insert into client_profiles values('${client}','${client}'),('${other}','${other}');
    insert into checkins(id,client_id,mood,wins,responses) values('${checkin}','${client}','good','All three sessions done','{"support_ask":"Can we adjust Friday?"}');
    grant usage on schema public,auth to authenticated,service_role;
    grant select on users,client_profiles,checkins to authenticated;
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20260616154523_inbox_messages.sql', import.meta.url),'utf8'));
  await db.exec("alter table inbox_messages add column message_type text default 'text';");
  await db.exec(await readFile(new URL('../supabase/migrations/20261006180000_checkin_dm_replies.sql', import.meta.url),'utf8'));
  return db;
}
async function save(db: PGlite, reply: string, adminId = coach, checkinId = checkin) {
  return (await db.query<{saved:{message_id:string;client_id:string;created:boolean}}>(
    'select save_checkin_dm_reply($1,$2,$3) as saved',[adminId,checkinId,reply])).rows[0].saved;
}

test('reply and quoted DM save together; retry/edit retain one message, snapshot and read state', async () => {
  const db=await fixture();
  try {
    const first=await save(db,' Great work. Let’s adjust Friday. ');
    assert.equal(first.created,true);
    const retry=await save(db,'Great work. Let’s adjust Friday.');
    assert.equal(retry.created,false); assert.equal(retry.message_id,first.message_id);
    const row=(await db.query<{message:string;read_by_client:boolean;checkin_context:{wins:string}}>('select * from inbox_messages')).rows[0];
    assert.equal(row.message,'Great work. Let’s adjust Friday.'); assert.equal(row.read_by_client,false);
    await db.exec("update inbox_messages set read_by_client=true; update checkins set wins='Later client edit';");
    const edited=await save(db,'Friday is now a recovery day.');
    assert.equal(edited.created,false); assert.equal(edited.message_id,first.message_id);
    const after=(await db.query<typeof row>('select * from inbox_messages')).rows;
    assert.equal(after.length,1); assert.equal(after[0].checkin_context.wins,'All three sessions done');
    assert.equal(after[0].read_by_client,true);
    assert.equal((await db.query<{admin_reply:string}>('select admin_reply from checkins')).rows[0].admin_reply,after[0].message);
  } finally {await db.close();}
});

test('DM failure rolls back the check-in reply, invalid replies and non-admin/missing targets fail closed',async()=>{
  const db=await fixture();
  try {
    await assert.rejects(save(db,'hello',client));
    await assert.rejects(save(db,'')); await assert.rejects(save(db,'x'.repeat(4001)));
    await assert.rejects(save(db,'hello',coach,other));
    await db.exec("create function fail_dm() returns trigger language plpgsql as $$begin raise exception 'forced failure';end$$; create trigger fail_dm before insert on inbox_messages for each row execute function fail_dm();");
    await assert.rejects(save(db,'valid reply'));
    assert.equal((await db.query<{admin_reply:string|null}>('select admin_reply from checkins')).rows[0].admin_reply,null);
    assert.equal((await db.query('select * from inbox_messages')).rows.length,0);
  }finally{await db.close();}
});

test('client can read only its private quote; RPC cannot be called as authenticated; mismatched client link rejected',async()=>{
  const db=await fixture();
  try{
    await save(db,'Private reply');
    await assert.rejects(db.query('update inbox_messages set client_id=$1',[other]));
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${client}';`);
    assert.equal((await db.query('select * from inbox_messages')).rows.length,1);
    await assert.rejects(save(db,'pretend coach'));
    await db.exec(`set request.jwt.claim.sub='${other}';`);
    assert.equal((await db.query('select * from inbox_messages')).rows.length,0);
  }finally{await db.close();}
});

test('quote uses real answers and labels, prioritises context and clips long text without inventing summary',()=>{
  const context={submitted_at:'2026-10-06T10:00:00Z',mood:'good',wins:'Three workouts',responses:{support_ask:'Friday timing',wellbeing:'x'.repeat(180),photos:'private path',weight:'72'}};
  assert.deepEqual(checkinPreview(context).map(x=>x.text),['Three workouts','Friday timing']);
  const answers=checkinAnswers(context);
  assert.equal(answers.some(x=>x.key==='photos'),false);
  assert.equal(answers.find(x=>x.key==='weight')?.label,'Weight (kg)');
  const long=checkinPreview({...context,wins:'x'.repeat(180)})[0];
  assert.equal(long.text.length,138); assert.ok(long.text.endsWith('…'));
});
