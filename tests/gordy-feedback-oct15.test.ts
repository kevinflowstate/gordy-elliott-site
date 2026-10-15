import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { scheduledCheckinDates, checkinToday, scheduledCheckinError, addCheckinDays } from '../lib/checkin-schedule';
import { withConsultationBodyMetrics, consultationMetricError, consultationBodyContext } from '../lib/consultation-metrics';
import { normalizeConsultationConfig } from '../lib/consultation-form';
import { foundationsHelpEmail, FOUNDATIONS_HELP_EMAIL } from '../lib/foundations-help-email';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const today = checkinToday();
const due = scheduledCheckinDates(addCheckinDays(today, -50), 'monday')[0];
async function fixture() { const db = new PGlite(); await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE users(id uuid PRIMARY KEY,role text,full_name text,email text);CREATE TABLE client_profiles(id uuid PRIMARY KEY,user_id uuid,programme_type text,start_date date,checkin_day text,checkin_form_id uuid);CREATE TABLE form_config(form_type text,config jsonb);CREATE TABLE checkin_forms(id uuid PRIMARY KEY,config jsonb,is_default bool,created_at timestamptz DEFAULT now());CREATE TABLE checkins(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid,week_number int,created_at timestamptz DEFAULT now(),reviewed_at timestamptz,reviewed_by uuid,UNIQUE(client_id,week_number));CREATE TABLE inbox_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),client_id uuid,sender_user_id uuid,sender_role text,message text,read_by_admin bool,read_by_client bool);CREATE TABLE foundations_monthly_reviews(id uuid DEFAULT gen_random_uuid(),client_id uuid,period_start date,period_end date,response text,message_id uuid,reviewed_by uuid,UNIQUE(client_id,period_start));INSERT INTO users VALUES('${id(1)}','client','Fictional client','fixture@example.invalid'),('${id(2)}','admin','Coach','coach@example.invalid');INSERT INTO client_profiles VALUES('${id(3)}','${id(1)}','foundations','${addCheckinDays(today, -50)}','monday',null);`); for (const filename of ['20261015160000_checkin_scheduled_date.sql', '20261015161000_foundations_help.sql'])
    await db.exec(await readFile(new URL('../supabase/migrations/' + filename, import.meta.url), 'utf8')); return db; }
test('London date/week boundaries and joining date produce past assigned dates only, including DST', () => { assert.equal(checkinToday(new Date('2026-06-01T23:30:00Z')), '2026-06-02');
    assert.ok(scheduledCheckinDates('2020-01-01','monday','2026-10-15').every(date=>date>='2025-10-16')); assert.deepEqual(scheduledCheckinDates('2026-10-01', 'wednesday', '2026-10-15'), ['2026-10-14', '2026-10-07']); assert.deepEqual(scheduledCheckinDates('2026-10-15', 'friday', '2026-10-15'), []); assert.ok(scheduledCheckinError('2026-10-16', scheduledCheckinDates('2026-10-01', 'wednesday', '2026-10-15'))); });
test('scheduled check-in keeps actual submitted time, prevents duplicates/future/identity movement, legacy edits retained', async () => { const db = await fixture(); try {
    await db.query('INSERT INTO checkins(client_id,week_number,scheduled_date) VALUES($1,1,$2)', [id(3), addCheckinDays(due, -7)]);
    const before = (await db.query<{
        created_at: string;
    }>('SELECT created_at::text FROM checkins')).rows[0].created_at;
    assert.equal(before.slice(0, 10), new Date().toISOString().slice(0, 10));
    await assert.rejects(db.query('INSERT INTO checkins(client_id,week_number,scheduled_date)VALUES($1,2,$2)', [id(3), addCheckinDays(due, -7)]), /unique/);
    await assert.rejects(db.query('INSERT INTO checkins(client_id,week_number,scheduled_date)VALUES($1,2,$2)', [id(3), addCheckinDays(due, 7)]), /past/);
    await assert.rejects(db.query('UPDATE checkins SET scheduled_date=$1', [due]), /cannot change/);
    await db.exec('UPDATE checkins SET reviewed_at=now()');
    assert.equal((await db.query<{
        created_at: string;
    }>('SELECT created_at::text FROM checkins')).rows[0].created_at, before);
}
finally {
    await db.close();
} });
test('Foundations monthly response covers pending late reflections without changing joining dates or old review history', async () => { const db = await fixture(); try {
    await db.query('INSERT INTO checkins(client_id,week_number,scheduled_date)VALUES($1,1,$2)', [id(3), addCheckinDays(due, -14)]);
    await db.query('SELECT save_foundations_review($1,$2,$3,$4,$5)', [id(2), id(3), addCheckinDays(due, -7), addCheckinDays(due, 1), 'Monthly feedback including late reflection']);
    assert.equal((await db.query('SELECT * FROM checkins WHERE reviewed_at IS NOT NULL')).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM inbox_messages')).rows.length, 1);
}
finally {
    await db.close();
} });
test('Foundations help outbox is idempotent, client-scoped, rate limited and service-only; fixture never emails', async () => { const db = await fixture(); try {
    const send = (key: number) => db.query<{
        id: string;
    }>('SELECT submit_foundations_help($1,$2,$3,$4,true) id', [id(1), id(key), 'Getting unstuck', 'Fictional clarification']);
    assert.equal((await send(10)).rows[0].id, (await send(10)).rows[0].id);
    await send(11);
    await send(12);
    await assert.rejects(send(13), /RATE_LIMIT/);
    assert.equal((await db.query('SELECT * FROM foundations_help_requests WHERE notification_sent_at IS NULL')).rows.length, 0);
    await db.exec('SET ROLE authenticated');
    await assert.rejects(send(14), /permission denied/);
    await assert.rejects(db.exec('SELECT * FROM foundations_help_requests'), /permission denied/);
}
finally {
    await db.close();
} });
test('help email uses verified Gordy recipient, stable subject, client reply address and account context', () => { assert.equal(FOUNDATIONS_HELP_EMAIL, 'gordon_elliott@icloud.com'); const email = foundationsHelpEmail({ id: id(9), client_id: id(3), client_name: 'Fixture', client_email: 'fixture@example.invalid', kind: 'Getting unstuck', message: 'Where is the session?', created_at: '2026-10-15T12:00:00Z' }); assert.match(email.subject, /^\[Foundations Help\]/); assert.equal(email.replyTo, 'fixture@example.invalid'); assert.match(email.text, /Where is the session/); assert.match(email.text, /admin\/clients/); });
test('fitness consultation metrics have units, no duplicate aliases/goal confusion; Boardroom excluded', () => { for (const programme of ['capacity', 'shift', 'in_person', 'foundations']) {
    const config = normalizeConsultationConfig(null, programme);
    assert.ok(config.questions.some(q => q.id === 'height_cm' && q.label.includes('cm')));
    assert.ok(config.questions.some(q => q.id === 'weight_kg' && q.label.includes('kg')));
} assert.equal(normalizeConsultationConfig(null, 'boardroom').questions.some(q => ['height_cm', 'weight_kg'].includes(q.id)), false); const existing = [{ id: 'body_weight', label: 'Bodyweight (lb)', type: 'text' as const, placeholder: '', enabled: true }]; assert.equal(withConsultationBodyMetrics(existing).filter(q => /weight/.test(q.id)).length, 1); assert.ok(withConsultationBodyMetrics([{ ...existing[0], id: 'goal_weight', label: 'Goal weight' }]).some(q => q.id === 'weight_kg')); assert.match(consultationMetricError({ height_cm: -1 }) || '', /height/); assert.equal(consultationMetricError({ height_cm: '175', weight_kg: '80.5' }), null); assert.match(consultationBodyContext({ height_cm: 175, weight_kg: 80.5 }), /175 cm/); });

test('legacy check-in config weekday is the same API and database fallback', async()=>{
 const db=await fixture();try{
 await db.exec("INSERT INTO form_config VALUES('checkin','{\"checkin_day\":\"wednesday\"}');UPDATE client_profiles SET checkin_day=null;");
 const scheduled=scheduledCheckinDates(addCheckinDays(today,-50),'wednesday')[0];
 await db.query('INSERT INTO checkins(client_id,week_number,scheduled_date)VALUES($1,1,$2)',[id(3),scheduled]);
 assert.equal((await db.query<{date:string}>('SELECT scheduled_date::text date FROM checkins')).rows[0].date,scheduled);
 }finally{await db.close();}
});
test('retained metric aliases keep configured units in coach/planning context',()=>{
 const questions=[{id:'body_weight',label:'Bodyweight (lb)',type:'text' as const,enabled:true,placeholder:''},{id:'stature',label:'Height (feet/inches)',type:'text' as const,enabled:true,placeholder:''}];
 assert.equal(consultationBodyContext({body_weight:'180',stature:'5 ft 9 in'},questions),'Height (feet/inches): 5 ft 9 in\nBodyweight (lb): 180');
 assert.equal(consultationBodyContext({goal_weight:'150'},[{...questions[0],id:'goal_weight',label:'Goal weight (lb)'}]),'');
});

test('deleting a fictional client cascades saved help without blocking account deletion',async()=>{const db=await fixture();try{await db.query('SELECT submit_foundations_help($1,$2,$3,$4,true)',[id(1),id(15),'Getting unstuck','Fictional request']);await db.query('DELETE FROM client_profiles WHERE id=$1',[id(3)]);assert.equal((await db.query('SELECT * FROM foundations_help_requests')).rows.length,0);}finally{await db.close();}});
