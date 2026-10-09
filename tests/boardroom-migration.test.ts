import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const coach = id(1), user = id(2), otherUser = id(3), shiftUser = id(4);
const client = id(12), otherClient = id(13), shiftClient = id(14), content = id(20);
const migration = new URL('../supabase/migrations/20261009130000_capacity_boardroom.sql', import.meta.url);

async function fixture() {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql AS $$SELECT string_to_array(name,'/')$$;
      CREATE TABLE users(id uuid PRIMARY KEY, role text NOT NULL CHECK(role IN ('client','admin')));
      CREATE TABLE client_profiles(id uuid PRIMARY KEY, user_id uuid UNIQUE NOT NULL REFERENCES users(id),
        programme_type text NOT NULL DEFAULT 'capacity' CHECK(programme_type IN ('capacity','shift','in_person')));
      CREATE TABLE training_modules(id uuid PRIMARY KEY, title text NOT NULL,
        programme_audiences text[] NOT NULL DEFAULT ARRAY['capacity','shift','in_person']::text[],
        CONSTRAINT training_modules_programme_audiences_check CHECK(cardinality(programme_audiences)>0 AND programme_audiences <@ ARRAY['capacity','shift','in_person']::text[]));
      CREATE TABLE module_content(id uuid PRIMARY KEY, module_id uuid NOT NULL REFERENCES training_modules(id));
      CREATE TABLE checkin_forms(id uuid PRIMARY KEY, config jsonb, is_default boolean DEFAULT false, created_at timestamptz DEFAULT now());
      CREATE TABLE form_config(form_type text UNIQUE, config jsonb);
      CREATE TABLE checkins(id uuid PRIMARY KEY,client_id uuid NOT NULL REFERENCES client_profiles(id),checkin_form_id uuid REFERENCES checkin_forms(id),
        created_at timestamptz DEFAULT now(),mood text NOT NULL CHECK(mood IN ('great','good','okay','struggling')),
        wins text,challenges text,questions text,responses jsonb,admin_reply text,replied_at timestamptz);
      CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text NOT NULL,name text NOT NULL);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      INSERT INTO users VALUES('${coach}','admin'),('${user}','client'),('${otherUser}','client'),('${shiftUser}','client');
      INSERT INTO client_profiles VALUES('${client}','${user}','capacity'),('${otherClient}','${otherUser}','capacity'),('${shiftClient}','${shiftUser}','shift');
      INSERT INTO training_modules(id,title) VALUES('${content}','Existing fitness education');
      INSERT INTO module_content VALUES('${content}','${content}');
      GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,service_role;
      GRANT SELECT ON users,client_profiles TO authenticated;
    `);
    // Execute the original plan table definitions, preserving their actual constraints/FKs.
    const v2 = await readFile(new URL('../supabase/migration-v2.sql', import.meta.url), 'utf8');
    await db.exec(v2.slice(v2.indexOf('CREATE TABLE public.business_plans'), v2.indexOf('-- Internal notes')));
    await db.exec('ALTER TABLE business_plans ADD COLUMN discovery_answers jsonb;');
    const documents = await readFile(new URL('../supabase/migrations/20260630134240_remaining_build2_nutrition_consultation_calendar_docs.sql', import.meta.url), 'utf8');
    await db.exec(documents.slice(documents.indexOf('CREATE TABLE IF NOT EXISTS public.client_documents'), documents.indexOf('CREATE INDEX IF NOT EXISTS idx_client_documents')));
    await db.exec('ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,UPDATE ON client_documents TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;');
    await db.exec(await readFile(new URL('../supabase/migrations/20260616154523_inbox_messages.sql', import.meta.url), 'utf8'));
    await db.exec("ALTER TABLE inbox_messages ADD COLUMN message_type text DEFAULT 'text';");
    await db.exec(await readFile(new URL('../supabase/migrations/20261006180000_checkin_dm_replies.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(migration, 'utf8'));
    // Match production service-role privileges; RPCs are SECURITY INVOKER.
    await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;');
    return db;
  } catch (error) { await db.close(); throw error; }
}

function plan(offset = 100, owner = client) {
  return {
    id: id(offset), client_id: owner, status: 'active', title: '90-day business plan', summary: 'Improve retention',
    start_date: '2026-10-12', duration_days: 90, discovery_answers: { priority: 'Retention' }, pdf_url: null,
    phases: [{ id: id(offset + 1), name: 'First month', notes: 'Review the baseline', due_date: '2026-11-12', order_index: 0,
      linked_trainings: [content], items: [{ id: id(offset + 2), title: 'Interview five clients', category: 'Retention',
        due_date: '2026-10-19', notes: '', completed: false, order_index: 0 }] }],
  };
}
const save = (db: PGlite, payload: unknown) => db.query('SELECT save_business_plan($1::jsonb) AS id', [JSON.stringify(payload)]);
async function update(db: PGlite, payload: unknown) {
  return (await db.query<{ item: { completed: boolean; completed_at: string | null; notes: string } }>(
    'SELECT update_business_plan_item($1::jsonb) AS item', [JSON.stringify(payload)])).rows[0].item;
}

test('full migration is repeatable; Boardroom does not change existing tiers or automatically expose fitness education', async () => {
  const db = await fixture();
  try {
    await db.exec(await readFile(migration, 'utf8'));
    assert.deepEqual((await db.query<{ programme_type: string }>('SELECT programme_type FROM client_profiles ORDER BY id')).rows.map(r => r.programme_type), ['capacity','capacity','shift']);
    await db.query('UPDATE client_profiles SET programme_type=$1 WHERE id=$2', ['boardroom', client]);
    await assert.rejects(db.query("UPDATE client_profiles SET programme_type='unknown' WHERE id=$1", [client]));
    assert.deepEqual((await db.query<{ programme_audiences: string[] }>('SELECT programme_audiences FROM training_modules')).rows[0].programme_audiences, ['capacity','shift','in_person']);
    await db.query("INSERT INTO training_modules(id,title,programme_audiences) VALUES($1,'Business lesson',ARRAY['boardroom'])", [id(21)]);
    await assert.rejects(db.query("UPDATE training_modules SET programme_audiences='{}' WHERE id=$1", [content]));
    await assert.rejects(db.query("UPDATE training_modules SET programme_audiences=ARRAY['unknown'] WHERE id=$1", [content]));
  } finally { await db.close(); }
});

test('stale plan edits preserve client completion and notes, dates and discovery metadata', async () => {
  const db = await fixture();
  try {
    const original = plan();
    await save(db, original);
    const changed = await update(db, { item_id: id(102), user_id: user, completed: true, notes: 'Three interviews booked' });
    assert.equal(changed.completed, true);
    const stale = structuredClone(original); stale.title = 'Edited by Gordy'; stale.phases[0].items[0].title = 'Interview six clients';
    await save(db, stale);
    const row = (await db.query<{ title: string; notes: string; completed: boolean; completed_at: Date }>('SELECT * FROM business_plan_items WHERE id=$1', [id(102)])).rows[0];
    assert.equal(row.title, 'Interview six clients'); assert.equal(row.notes, changed.notes);
    assert.equal(row.completed, true); assert.equal(row.completed_at.toISOString(), new Date(changed.completed_at!).toISOString());
    const header = (await db.query<{ title: string; duration_days: number; start_date: Date; discovery_answers: object }>('SELECT * FROM business_plans WHERE id=$1', [id(100)])).rows[0];
    assert.equal(header.title, 'Edited by Gordy'); assert.equal(header.duration_days, 90);
    assert.equal(header.start_date.toISOString().slice(0,10), '2026-10-12'); assert.deepEqual(header.discovery_answers, { priority: 'Retention' });
    const removed = structuredClone(stale); removed.phases[0].items = [];
    await assert.rejects(save(db, removed), /Keep actions with progress/);
    assert.equal((await db.query('SELECT * FROM business_plan_items')).rows.length, 1);
  } finally { await db.close(); }
});

test('explicit completion retries retain timestamp and note-only updates do not toggle progress', async () => {
  const db = await fixture();
  try {
    await save(db, plan());
    const complete = { item_id: id(102), client_id: client, completed: true };
    const first = await update(db, complete), retry = await update(db, complete);
    assert.equal(retry.completed, true); assert.equal(retry.completed_at, first.completed_at);
    const note = await update(db, { item_id: id(102), user_id: user, notes: 'Completed review' });
    assert.equal(note.completed, true); assert.equal(note.completed_at, first.completed_at);
    const cleared = await update(db, { ...complete, completed: false });
    assert.equal(cleared.completed, false); assert.equal(cleared.completed_at, null); assert.equal(cleared.notes, 'Completed review');
    await assert.rejects(update(db, { ...complete, completed: 'true' }), /Invalid completion/);
    await assert.rejects(update(db, { ...complete, notes: 'x'.repeat(20001) }), /Invalid notes/);
  } finally { await db.close(); }
});

test('failed replacement rolls back every write and successful new block archives only its own prior active plan', async () => {
  const db = await fixture();
  try {
    await save(db, plan()); await save(db, plan(300, otherClient));
    const invalidEdit = plan(); invalidEdit.title = 'Must roll back'; invalidEdit.phases[0].items[0].title = 'Must roll back'; invalidEdit.phases[0].linked_trainings = [id(999)];
    await assert.rejects(save(db, invalidEdit), /foreign key/);
    assert.equal((await db.query<{ title: string }>('SELECT title FROM business_plans WHERE id=$1', [id(100)])).rows[0].title, '90-day business plan');
    assert.equal((await db.query<{ title: string }>('SELECT title FROM business_plan_items WHERE id=$1', [id(102)])).rows[0].title, 'Interview five clients');
    const replacement = plan(200); replacement.phases[0].linked_trainings = [id(999)];
    await assert.rejects(save(db, replacement), /foreign key/);
    assert.deepEqual((await db.query<{ id: string; status: string }>('SELECT id,status FROM business_plans ORDER BY id')).rows, [{ id: id(100), status: 'active' }, { id: id(300), status: 'active' }]);
    assert.equal((await db.query('SELECT * FROM business_plan_phases WHERE id=$1', [id(201)])).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM business_plan_items WHERE id=$1', [id(202)])).rows.length, 0);
    await save(db, plan(200));
    const statuses = (await db.query<{ id: string; status: string; completed_at: string | null }>('SELECT id,status,completed_at FROM business_plans ORDER BY id')).rows;
    assert.equal(statuses[0].status, 'completed'); assert.ok(statuses[0].completed_at);
    assert.equal(statuses[1].status, 'active'); assert.equal(statuses[2].status, 'active');
    await assert.rejects(update(db, { item_id: id(102), user_id: user, completed: true }), /Active action not found/);
    await assert.rejects(save(db, plan()), /no longer active/);
    await save(db, { ...plan(), title: 'Historical correction', status: 'completed' });
    assert.equal((await db.query<{ status: string }>('SELECT status FROM business_plans WHERE id=$1', [id(200)])).rows[0].status, 'active');
  } finally { await db.close(); }
});

test('plan and action ownership fail closed; public/authenticated cannot execute privileged RPCs', async () => {
  const db = await fixture();
  try {
    await save(db, plan()); await save(db, plan(300, otherClient));
    await assert.rejects(save(db, { ...plan(), client_id: otherClient }), /another client/);
    const phaseCollision = plan(200); phaseCollision.phases[0].id = id(301);
    await assert.rejects(save(db, phaseCollision), /Phase belongs to another plan/);
    const itemCollision = plan(200); itemCollision.phases[0].items[0].id = id(302);
    await assert.rejects(save(db, itemCollision), /Action belongs to another plan/);
    await assert.rejects(update(db, { item_id: id(102), user_id: otherUser, completed: true }), /Forbidden/);
    await assert.rejects(update(db, { item_id: id(102), client_id: otherClient, completed: true }), /Wrong client/);
    await assert.rejects(update(db, { item_id: id(102), completed: true }), /owner required/);
    await db.exec('SET ROLE authenticated;');
    await assert.rejects(save(db, plan()), /permission denied for function/);
    await assert.rejects(update(db, { item_id: id(102), user_id: user, completed: true }), /permission denied for function/);
    await db.exec('RESET ROLE; SET ROLE service_role;');
    await update(db, { item_id: id(102), user_id: user, completed: true });
  } finally { await db.close(); }
});

test('Boardroom document/storage policies allow only the owning eligible client', async () => {
  const db = await fixture();
  try {
    await db.exec(`UPDATE client_profiles SET programme_type='boardroom' WHERE id='${client}';
      SET ROLE authenticated; SET request.jwt.claim.sub='${user}';`);
    await db.query('INSERT INTO client_documents(client_id,uploaded_by,title,storage_path,file_name,category) VALUES($1,$2,$3,$4,$5,$6)', [client,user,'Business report',`${client}/report.pdf`,'report.pdf','other']);
    await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('client-documents',$1)", [`${client}/report.pdf`]);
    await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('client-documents',$1)", [`${otherClient}/report.pdf`]), /row-level security/);
    assert.equal((await db.query('SELECT * FROM client_documents')).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length, 1);
    await db.exec(`SET request.jwt.claim.sub='${otherUser}';`);
    assert.equal((await db.query('SELECT * FROM client_documents')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length, 0);
    await db.exec(`SET request.jwt.claim.sub='${shiftUser}';`);
    await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('client-documents',$1)", [`${shiftClient}/report.pdf`]), /row-level security/);
    await assert.rejects(db.query('INSERT INTO client_documents(client_id,uploaded_by,title,storage_path,file_name,category) VALUES($1,$2,$3,$4,$5,$6)', [shiftClient,shiftUser,'No access',`${shiftClient}/report.pdf`,'report.pdf','other']), /row-level security/);
  } finally { await db.close(); }
});

test('check-in DM quote uses submission schema and survives later form/reply edits', async () => {
  const db = await fixture();
  try {
    const snapshot = { programme_type: 'boardroom', mood_enabled: false, questions: [{ id: 'sales', label: 'Sales this week (£)' }] };
    await db.query('INSERT INTO checkin_forms(id,config) VALUES($1,$2)', [id(500), { questions: [{ id: 'sales', label: 'Changed label' }] }]);
    await db.query("INSERT INTO checkins(id,client_id,checkin_form_id,mood,responses,form_config_snapshot) VALUES($1,$2,$3,'okay',$4,$5)", [id(501), client, id(500), { sales: '0' }, snapshot]);
    await db.query('SELECT save_checkin_dm_reply($1,$2,$3)', [coach,id(501),'Let’s review the pipeline']);
    const first = (await db.query<{ checkin_context: { config: object; responses: object; mood: string | null } }>('SELECT checkin_context FROM inbox_messages')).rows[0].checkin_context;
    assert.equal(first.mood, null); assert.deepEqual(first.config, snapshot); assert.deepEqual(first.responses, { sales: '0' });
    await db.exec("UPDATE inbox_messages SET read_by_client=true; UPDATE checkin_forms SET config='{}'; UPDATE checkins SET form_config_snapshot='{}';");
    await db.query('SELECT save_checkin_dm_reply($1,$2,$3)', [coach,id(501),'Updated response']);
    const after = (await db.query<{ checkin_context: object; read_by_client: boolean }>('SELECT checkin_context,read_by_client FROM inbox_messages')).rows;
    assert.equal(after.length, 1); assert.deepEqual(after[0].checkin_context, first); assert.equal(after[0].read_by_client, true);
  } finally { await db.close(); }
});
