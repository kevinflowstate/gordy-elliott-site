process.env.TZ = "Europe/London";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { applyTrainingDateOverrides, manualActivityError, occupiedTrainingDates, type TrainingDateOverride } from "../lib/training-calendar";
import { programmeAddDays, programmeCalendarWeekStart } from "../lib/exercise-programme";
import { addPlannerDays, formatPlannerDate, getPlannerWeekStart } from "../lib/training-planner";
import type { WeeklyTrainingAssignment } from "../lib/types";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const USER = id(101), OTHER_USER = id(102), CLIENT = id(1), OTHER_CLIENT = id(2);
const PLAN = id(10), PROGRAMME = id(11), OTHER_PLAN = id(12);
const PELOTON = id(20), STRENGTH = id(21), MOBILITY = id(22), P1 = id(30), P2 = id(31), OTHER_SESSION = id(40);

function assignment(sessionId: string, weekStart: string, plannedDate: string | null, source: "explicit" | "recurring" = "explicit"): WeeklyTrainingAssignment {
  return { id: source === "explicit" ? id(900) : null, client_id: CLIENT, plan_id: PLAN, session_id: sessionId, week_start: weekStart, planned_date: plannedDate, is_recurring: source === "recurring", recurrence_stopped: false, source };
}
function move(sessionId: string, source: string, date: string): TrainingDateOverride {
  return { id: id(800), client_id: CLIENT, plan_id: PLAN, session_id: sessionId, source_week_start: source, planned_date: date, created_at: "", updated_at: "" };
}

test("reported case: Friday 16 October to Monday 19 October lands in the following Monday week", () => {
  assert.equal(programmeCalendarWeekStart("2026-10-16"), "2026-10-12");
  assert.equal(programmeCalendarWeekStart("2026-10-19"), "2026-10-19");
  // Month end and the UK clock change (Sunday 25 October 2026) stay date-exact.
  assert.equal(programmeCalendarWeekStart("2026-11-01"), "2026-10-26");
  assert.equal(programmeAddDays("2026-10-30", 3), "2026-11-02");
  assert.equal(formatPlannerDate(getPlannerWeekStart(new Date("2026-10-25T00:00:00"))), "2026-10-19");
  assert.equal(formatPlannerDate(getPlannerWeekStart(new Date("2026-10-26T00:30:00"))), "2026-10-26");
  assert.equal(addPlannerDays("2026-10-19", 7), "2026-10-26");
  assert.equal(addPlannerDays("2027-03-22", 7), "2027-03-29");
});

test("a cross-week move leaves the source week's slot held and shows the same session separately in the target week", () => {
  const moves = [move(PELOTON, "2026-10-12", "2026-10-19")];
  const source = applyTrainingDateOverrides([assignment(PELOTON, "2026-10-12", "2026-10-12"), assignment(STRENGTH, "2026-10-12", "2026-10-14")], moves, "2026-10-12", { clientId: CLIENT, planId: PLAN });
  const peloton = source.assignments.find((a) => a.session_id === PELOTON)!;
  assert.equal(peloton.planned_date, null);
  assert.equal(peloton.moved_to, "2026-10-19");
  assert.equal(peloton.held_date, "2026-10-12");
  assert.equal(source.movedIn.length, 0);
  assert.equal(source.assignments.filter((a) => a.session_id === PELOTON).length, 1);

  // Target week keeps its own (static, recurring) Peloton on Wednesday and gains the moved one on Monday.
  const target = applyTrainingDateOverrides([assignment(PELOTON, "2026-10-19", "2026-10-21", "recurring")], moves, "2026-10-19", { clientId: CLIENT, planId: PLAN });
  assert.deepEqual(target.assignments.map((a) => [a.session_id, a.planned_date, a.moved_to]), [[PELOTON, "2026-10-21", undefined]]);
  assert.deepEqual(target.movedIn.map((a) => [a.session_id, a.planned_date, a.source_week_start]), [[PELOTON, "2026-10-19", "2026-10-12"]]);
  // The moved-in Monday stays taken even for this week's own Peloton chips (the server would refuse it).
  assert.deepEqual([...occupiedTrainingDates(target.assignments, target.movedIn, PELOTON).keys()], ["2026-10-19"]);
});

test("same-week and previously unplaced moves are one-off and never recurring", () => {
  const sameWeek = applyTrainingDateOverrides([assignment(PELOTON, "2026-10-12", "2026-10-12", "recurring")], [move(PELOTON, "2026-10-12", "2026-10-15")], "2026-10-12", { clientId: CLIENT, planId: PLAN });
  assert.equal(sameWeek.assignments[0].planned_date, "2026-10-15");
  assert.equal(sameWeek.assignments[0].held_date, null, "a virtual recurring slot does not hold its date");
  const unplaced = applyTrainingDateOverrides([], [move(MOBILITY, "2026-10-12", "2026-10-20")], "2026-10-12", { clientId: CLIENT, planId: PLAN });
  assert.equal(unplaced.assignments[0].is_recurring, false);
  assert.equal(unplaced.assignments[0].moved_to, "2026-10-20");
});

test("manual activity validation", () => {
  const today = "2026-10-16";
  assert.equal(manualActivityError("2026-10-16", "walking", "30", "", today), null);
  assert.equal(manualActivityError("2026-10-16", "rest", "9999", "", today), null, "minutes ignored for rest");
  assert.match(manualActivityError("2026-10-17", "walking", "", "", today)!, /up to today/);
  assert.match(manualActivityError("2025-10-15", "walking", "", "", today)!, /past year/);
  assert.match(manualActivityError("2026-10-16", "peloton", "", "", today)!, /Choose an activity/);
  assert.match(manualActivityError("2026-10-16", "walking", "0", "", today)!, /minutes/);
  assert.match(manualActivityError("2026-10-16", "walking", "12.5", "", today)!, /minutes/);
  assert.match(manualActivityError("2026-10-16", "walking", "", "x".repeat(1001), today)!, /1,000/);
});

const MIGRATIONS = [
  "20261016100000_training_calendar_activity.sql",
  "20261016110000_scope_training_date_override_state.sql",
  "20261016120000_training_calendar_review_fixes.sql",
];
const applyMigration = async (db: PGlite, name: string) =>
  db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));

/** Fresh install applies every migration; `upgradeFrom` stops after that many, as production was before the review fixes. */
async function database({ upgradeFrom }: { upgradeFrom?: number } = {}) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE TABLE client_profiles(id uuid primary key, user_id uuid unique, programme_type text, fitness_plans_enabled boolean default false);
    CREATE TABLE client_exercise_plans(id uuid primary key, client_id uuid not null references client_profiles, status text not null default 'active',
      start_date date, programme_weeks integer, created_at timestamptz default now());
    CREATE TABLE client_exercise_sessions(id uuid primary key, plan_id uuid not null references client_exercise_plans on delete cascade, name text, day_number int, week_number int);
    CREATE TABLE client_exercise_logs(id uuid primary key default gen_random_uuid(), client_id uuid not null, exercise_item_id uuid default gen_random_uuid(), session_id uuid, log_date date not null, completed boolean default true);
    CREATE TABLE client_exercise_session_summaries(id uuid primary key default gen_random_uuid(), client_id uuid not null, session_id uuid not null, log_date date not null);
    CREATE TABLE client_training_weekly_assignments(id uuid primary key default gen_random_uuid(), client_id uuid not null, plan_id uuid not null, session_id uuid not null,
      week_start date not null, planned_date date, is_recurring boolean not null default false, recurrence_stopped boolean not null default false,
      UNIQUE(client_id, plan_id, session_id, week_start));
    CREATE UNIQUE INDEX unique_day ON client_training_weekly_assignments(client_id, plan_id, week_start, planned_date) WHERE planned_date IS NOT NULL;
    INSERT INTO client_profiles VALUES ('${CLIENT}', '${USER}', 'shift', false), ('${OTHER_CLIENT}', '${OTHER_USER}', 'shift', false);
    INSERT INTO client_exercise_plans(id, client_id, start_date, programme_weeks) VALUES
      ('${PLAN}', '${CLIENT}', '2026-09-07', NULL), ('${OTHER_PLAN}', '${OTHER_CLIENT}', '2026-09-07', NULL);
    INSERT INTO client_exercise_sessions VALUES
      ('${PELOTON}', '${PLAN}', 'Peloton ride', 1, NULL), ('${STRENGTH}', '${PLAN}', 'Strength', 2, NULL), ('${MOBILITY}', '${PLAN}', 'Mobility', 3, NULL),
      ('${OTHER_SESSION}', '${OTHER_PLAN}', 'Other client', 1, NULL);
  `);
  for (const name of MIGRATIONS.slice(0, upgradeFrom ?? MIGRATIONS.length)) await applyMigration(db, name);
  await db.exec(`
    CREATE TRIGGER exercise_logs_plan_lock BEFORE INSERT OR UPDATE ON client_exercise_logs FOR EACH ROW EXECUTE FUNCTION public.lock_exercise_plan_for_history();
    CREATE TRIGGER exercise_summaries_plan_lock BEFORE INSERT OR UPDATE ON client_exercise_session_summaries FOR EACH ROW EXECUTE FUNCTION public.lock_exercise_plan_for_history();
    CREATE TRIGGER exercise_assignments_plan_lock BEFORE INSERT OR UPDATE ON client_training_weekly_assignments FOR EACH ROW EXECUTE FUNCTION public.lock_exercise_plan_for_history();
  `);
  return db;
}

const moveSql = (db: PGlite, sessionId: string, source: string, date: string, user = USER, plan = PLAN) =>
  db.query<{ planned_date: string }>(`SELECT planned_date::text FROM save_training_calendar_date('${user}', '${plan}', '${sessionId}', '${source}', '${date}')`);
const rejects = (promise: Promise<unknown>, pattern: RegExp) => assert.rejects(promise, (error: Error) => pattern.test(error.message));

test("SQL: moves preserve schedules, refuse collisions (explicit, recurring, moved) and protect logged history", async () => {
  const db = await database();
  // Peloton is planned explicitly on Monday 12th; Strength repeats every Wednesday from an earlier week.
  await db.exec(`INSERT INTO client_training_weekly_assignments(client_id, plan_id, session_id, week_start, planned_date, is_recurring) VALUES
    ('${CLIENT}', '${PLAN}', '${PELOTON}', '2026-10-12', '2026-10-12', false),
    ('${CLIENT}', '${PLAN}', '${STRENGTH}', '2026-10-05', '2026-10-07', true);`);

  assert.equal((await moveSql(db, PELOTON, "2026-10-12", "2026-10-19")).rows[0].planned_date, "2026-10-19");
  const original = await db.query<{ planned_date: string }>(`SELECT planned_date::text FROM client_training_weekly_assignments WHERE session_id='${PELOTON}'`);
  assert.equal(original.rows[0].planned_date, "2026-10-12", "the weekly row is untouched so undo restores it exactly");

  await rejects(moveSql(db, MOBILITY, "2026-10-12", "2026-10-21"), /already has a planned session/);  // recurring Strength lands on Wed 21st
  await rejects(moveSql(db, MOBILITY, "2026-10-12", "2026-10-19"), /already has a planned session/);  // the moved Peloton
  await rejects(moveSql(db, MOBILITY, "2026-10-12", "2026-10-12"), /already has a planned session/);  // Peloton's held original date
  await rejects(moveSql(db, MOBILITY, "2026-10-12", "2026-10-11"), /from this training week onwards/);
  await rejects(moveSql(db, MOBILITY, "2026-10-12", "2027-10-13"), /within a year/);
  await rejects(moveSql(db, MOBILITY, "2026-10-13", "2026-10-20"), /from this training week onwards/);  // source must be a Monday

  // Strength's own week-19 occurrence moved away frees its recurring Wednesday for Mobility.
  await moveSql(db, STRENGTH, "2026-10-19", "2026-10-23");
  assert.equal((await moveSql(db, MOBILITY, "2026-10-12", "2026-10-21")).rows[0].planned_date, "2026-10-21");
  // A stopped recurrence no longer occupies its weekday.
  await db.exec(`INSERT INTO client_training_weekly_assignments(client_id, plan_id, session_id, week_start, planned_date, recurrence_stopped)
    VALUES ('${CLIENT}', '${PLAN}', '${STRENGTH}', '2026-10-26', NULL, true)`);
  assert.equal((await moveSql(db, PELOTON, "2026-11-02", "2026-11-04")).rows[0].planned_date, "2026-11-04");

  // Coaches and direct client writes cannot plan another session onto a moved-in date.
  await rejects(db.exec(`INSERT INTO client_training_weekly_assignments(client_id, plan_id, session_id, week_start, planned_date)
    VALUES ('${CLIENT}', '${PLAN}', '${STRENGTH}', '2026-10-19', '2026-10-19')`), /moved workout/);
  // The moved occurrence's own original row can still be edited.
  await db.exec(`UPDATE client_training_weekly_assignments SET is_recurring=true WHERE session_id='${PELOTON}' AND week_start='2026-10-12'`);

  // Logging the moved Peloton on its new date protects that move; a log in its source week blocks further moves.
  await db.exec(`INSERT INTO client_exercise_logs(client_id, session_id, log_date) VALUES ('${CLIENT}', '${PELOTON}', '2026-10-19')`);
  await rejects(moveSql(db, PELOTON, "2026-10-12", "2026-10-20"), /already been logged/);
  await rejects(db.query(`SELECT clear_training_calendar_date('${USER}', '${PLAN}', '${PELOTON}', '2026-10-12')`), /logged on its new date/);
  // That log belongs to the moved occurrence, so week 19's own Peloton can still move.
  assert.equal((await moveSql(db, PELOTON, "2026-10-19", "2026-10-24")).rows[0].planned_date, "2026-10-24");
  await db.exec(`INSERT INTO client_exercise_logs(client_id, session_id, log_date) VALUES ('${CLIENT}', '${MOBILITY}', '2026-10-13')`);
  await rejects(moveSql(db, MOBILITY, "2026-10-12", "2026-10-22"), /already been logged/);

  // Peloton now repeats on Mondays, and week 12's logged Peloton occupies Monday 19th, so undoing week 19's
  // move would leave it unplaced: refused (review fix). Undoing an occurrence that was never moved is a no-op.
  await rejects(db.query(`SELECT clear_training_calendar_date('${USER}', '${PLAN}', '${PELOTON}', '2026-10-19')`), /back on Mon 19 Oct/);
  assert.equal((await db.query<{ ok: boolean }>(`SELECT clear_training_calendar_date('${USER}', '${PLAN}', '${PELOTON}', '2026-11-09') ok`)).rows[0].ok, false);
  const history = await db.query<{ n: number }>(`SELECT count(*)::int n FROM client_exercise_logs`);
  assert.equal(history.rows[0].n, 2, "logs are never rewritten");
});

test("SQL: ownership, inactive plans and grants", async () => {
  const db = await database();
  await rejects(moveSql(db, OTHER_SESSION, "2026-10-12", "2026-10-19"), /Session not found/);
  await rejects(moveSql(db, PELOTON, "2026-10-12", "2026-10-19", OTHER_USER), /Session not found/);
  await rejects(moveSql(db, OTHER_SESSION, "2026-10-12", "2026-10-19", USER, OTHER_PLAN), /Session not found/);
  await db.exec(`UPDATE client_exercise_plans SET status='archived' WHERE id='${PLAN}'`);
  await rejects(moveSql(db, PELOTON, "2026-10-12", "2026-10-19"), /Session not found/);
  await db.exec(`UPDATE client_profiles SET programme_type='boardroom' WHERE id='${CLIENT}'`);
  await rejects(moveSql(db, PELOTON, "2026-10-12", "2026-10-19"), /Training access unavailable/);
  const grants = await db.query<{ table_read: boolean; move_rpc: boolean; state_fn: boolean }>(`SELECT
    has_table_privilege('authenticated', 'client_training_date_overrides', 'SELECT') table_read,
    has_function_privilege('authenticated', 'save_training_calendar_date(uuid,uuid,uuid,date,date)', 'EXECUTE') move_rpc,
    has_function_privilege('authenticated', 'training_date_override_state(text,uuid,date,date)', 'EXECUTE') state_fn`);
  assert.deepEqual(grants.rows[0], { table_read: false, move_rpc: false, state_fn: true });
});

test("SQL: the trigger helper only reports moves on the signed-in client's own sessions", async () => {
  const db = await database();
  await moveSql(db, PELOTON, "2026-10-12", "2026-10-19");
  const state = async (sub: string) => {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${sub}', false)`);
    return (await db.query<{ s: string | null }>(`SELECT training_date_override_state('log', '${PELOTON}', NULL, '2026-10-19') s`)).rows[0].s;
  };
  assert.equal(await state(USER), "moved_here");
  assert.equal(await state(OTHER_USER), null);
  assert.equal(await state(""), "moved_here", "service contexts without a user still see moves");
});

test("SQL: programme weeks keep exact session identity when moved across weeks", async () => {
  const db = await database();
  await db.exec(`INSERT INTO client_exercise_plans(id, client_id, start_date, programme_weeks) VALUES ('${PROGRAMME}', '${CLIENT}', '2026-10-05', 2);
    UPDATE client_exercise_plans SET status='archived' WHERE id='${PLAN}';
    INSERT INTO client_exercise_sessions VALUES ('${P1}', '${PROGRAMME}', 'Week 1 lower', 1, 1), ('${P2}', '${PROGRAMME}', 'Week 2 lower', 1, 2);`);
  await rejects(moveSql(db, P2, "2026-10-05", "2026-10-15", USER, PROGRAMME), /not part of that programme week/);
  await moveSql(db, P1, "2026-10-05", "2026-10-14", USER, PROGRAMME);
  // Week 1's exact session logs on its new week-2 date, not on its old week's other dates.
  await db.exec(`INSERT INTO client_exercise_logs(client_id, session_id, log_date) VALUES ('${CLIENT}', '${P1}', '2026-10-14')`);
  await rejects(db.exec(`INSERT INTO client_exercise_logs(client_id, session_id, log_date) VALUES ('${CLIENT}', '${P1}', '2026-10-07')`), /moved to another date/);
  await rejects(db.exec(`INSERT INTO client_exercise_logs(client_id, session_id, log_date) VALUES ('${CLIENT}', '${P1}', '2026-10-16')`), /does not belong to this programme week/);
  await db.exec(`INSERT INTO client_exercise_logs(client_id, session_id, log_date) VALUES ('${CLIENT}', '${P2}', '2026-10-13')`);
  await rejects(db.exec(`INSERT INTO client_training_weekly_assignments(client_id, plan_id, session_id, week_start, planned_date, is_recurring)
    VALUES ('${CLIENT}', '${PROGRAMME}', '${P2}', '2026-10-12', '2026-10-13', true)`), /cannot repeat/);
});

test("SQL: manual activity is one entry per client-date and rest cannot replace a logged workout", async () => {
  const db = await database();
  const save = (date: string, kind: string, minutes: number | null, user = USER, today = "2026-10-16") =>
    db.query<{ kind: string; duration_minutes: number | null }>(`SELECT kind, duration_minutes FROM save_manual_training_activity($1, $2, $3, $4, 'notes', $5)`, [user, date, kind, minutes, today]);
  // Pin "today" inside the RPC's clamp regardless of the machine clock.
  const today = (await db.query<{ d: string }>(`SELECT (now() AT TIME ZONE 'UTC')::date::text d`)).rows[0].d;
  const yesterday = programmeAddDays(today, -1);
  assert.deepEqual((await save(yesterday, "walking", 40, USER, today)).rows[0], { kind: "walking", duration_minutes: 40 });
  assert.deepEqual((await save(yesterday, "rest", 40, USER, today)).rows[0], { kind: "rest", duration_minutes: null }, "update in place; rest has no minutes");
  assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int n FROM client_manual_training_activity`)).rows[0].n, 1);
  await save(yesterday, "cycling", 30, OTHER_USER, today);
  assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int n FROM client_manual_training_activity`)).rows[0].n, 2, "clients are isolated");

  await rejects(save(programmeAddDays(today, 2), "walking", null, USER, today), /up to today/);
  // A client-supplied "today" is clamped to one day of timezone slack beyond the server's UTC date.
  await rejects(save(programmeAddDays(today, 2), "walking", null, USER, programmeAddDays(today, 5)), /up to today/);
  await rejects(save(programmeAddDays(today, -400), "walking", null, USER, today), /past year/);
  await rejects(save(today, "peloton", null, USER, today), /valid activity/);
  await rejects(save(today, "walking", 2000, USER, today), /valid activity/);

  await db.exec(`INSERT INTO client_exercise_logs(client_id, session_id, log_date, completed) VALUES ('${CLIENT}', '${PELOTON}', '${today}', true)`);
  await rejects(save(today, "rest", null, USER, today), /already logged/);
  assert.equal((await save(today, "walking", 20, USER, today)).rows[0].kind, "walking", "an activity alongside a workout is fine");
});

const log = (db: PGlite, sessionId: string, date: string, completed = true) =>
  db.exec(`INSERT INTO client_exercise_logs(client_id, session_id, log_date, completed) VALUES ('${CLIENT}', '${sessionId}', '${date}', ${completed})`);
const plannedDate = async (db: PGlite, sessionId: string, week: string) =>
  (await db.query<{ d: string | null }>(`SELECT planned_date::text d FROM client_training_weekly_assignments WHERE session_id='${sessionId}' AND week_start='${week}'`)).rows[0]?.d;
const undo = (db: PGlite, sessionId: string, source: string) =>
  db.query<{ ok: boolean }>(`SELECT clear_training_calendar_date('${USER}', '${PLAN}', '${sessionId}', '${source}') ok`);
const plannerUpsert = (db: PGlite, sessionId: string, week: string, date: string | null, recurring = false) =>
  db.exec(`INSERT INTO client_training_weekly_assignments(client_id, plan_id, session_id, week_start, planned_date, is_recurring)
    VALUES ('${CLIENT}', '${PLAN}', '${sessionId}', '${week}', ${date ? `'${date}'` : "NULL"}, ${recurring})
    ON CONFLICT (client_id, plan_id, session_id, week_start) DO UPDATE SET planned_date = excluded.planned_date, is_recurring = excluded.is_recurring`);

test("SQL review fix: weekly-planner writes cannot move or unplan a logged workout", async () => {
  const db = await database();
  // Explicit Monday Peloton, logged Monday; then replanned to Thursday as the same-week page path does.
  await plannerUpsert(db, PELOTON, "2026-10-12", "2026-10-12");
  await log(db, PELOTON, "2026-10-12");
  await rejects(plannerUpsert(db, PELOTON, "2026-10-12", "2026-10-15"), /already logged/);
  await rejects(db.exec(`UPDATE client_training_weekly_assignments SET planned_date='2026-10-15' WHERE session_id='${PELOTON}'`), /already logged/);
  await rejects(plannerUpsert(db, PELOTON, "2026-10-12", null), /already logged/);
  await plannerUpsert(db, PELOTON, "2026-10-12", "2026-10-12", true);  // repeat weekly, same date: allowed
  assert.equal(await plannedDate(db, PELOTON, "2026-10-12"), "2026-10-12");

  // Virtual recurring Strength (every Wednesday from 5 Oct), logged Wednesday 14th: keeps Wednesday.
  await plannerUpsert(db, STRENGTH, "2026-10-05", "2026-10-07", true);
  await log(db, STRENGTH, "2026-10-14");
  await rejects(plannerUpsert(db, STRENGTH, "2026-10-12", "2026-10-15"), /already logged/);
  await plannerUpsert(db, STRENGTH, "2026-10-12", "2026-10-14");  // pinning this week on its own date is fine

  // Deleting a logged occurrence's explicit row would unplan it (no recurrence) or move it (recurrence): refused.
  await rejects(db.exec(`DELETE FROM client_training_weekly_assignments WHERE session_id='${PELOTON}' AND week_start='2026-10-12'`), /already logged/);
  // Strength's pinned row sits on its recurring Wednesday, so deleting it changes nothing: allowed.
  await db.exec(`DELETE FROM client_training_weekly_assignments WHERE session_id='${STRENGTH}' AND week_start='2026-10-12'`);

  // Static plans may still be logged on any day. A week with no plan yet can still be planned (coach Copy/Repeat),
  // but once placed, a logged occurrence keeps its date unless it moves to a date it was logged on.
  await log(db, MOBILITY, "2026-10-13");
  await plannerUpsert(db, MOBILITY, "2026-10-12", "2026-10-16");
  await rejects(plannerUpsert(db, MOBILITY, "2026-10-12", "2026-10-15"), /already logged/);
  await plannerUpsert(db, MOBILITY, "2026-10-12", "2026-10-13");

  // Unlogged weeks move freely, and a log that belongs to a moved-in occurrence does not lock the week's own.
  await plannerUpsert(db, PELOTON, "2026-10-19", "2026-10-19");
  await plannerUpsert(db, PELOTON, "2026-10-19", "2026-10-20");
  await moveSql(db, MOBILITY, "2026-10-19", "2026-10-22");
  await log(db, MOBILITY, "2026-10-22");
  await plannerUpsert(db, PELOTON, "2026-10-19", "2026-10-21");  // week 19 Peloton has no log of its own
  assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int n FROM client_exercise_logs`)).rows[0].n, 4, "history untouched");

  // Week 12's Peloton moved into Monday 19th and logged there: week 19's own Peloton is still free to move.
  const fresh = await database();
  await plannerUpsert(fresh, PELOTON, "2026-10-19", "2026-10-21");
  await moveSql(fresh, PELOTON, "2026-10-12", "2026-10-19");
  await log(fresh, PELOTON, "2026-10-19");
  await plannerUpsert(fresh, PELOTON, "2026-10-19", "2026-10-22");
  assert.equal(await plannedDate(fresh, PELOTON, "2026-10-19"), "2026-10-22");
});

test("SQL review fix: Undo refuses to restore a workout onto a date another workout now uses", async () => {
  const db = await database();
  await plannerUpsert(db, STRENGTH, "2026-10-05", "2026-10-07", true);
  await moveSql(db, STRENGTH, "2026-10-19", "2026-10-23");   // Strength off Wednesday 21st
  await moveSql(db, MOBILITY, "2026-10-19", "2026-10-21");   // Mobility onto Wednesday 21st
  await rejects(undo(db, STRENGTH, "2026-10-19"), /Undo would put this workout back on Wed 21 Oct/);
  assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int n FROM client_training_date_overrides WHERE session_id='${STRENGTH}'`)).rows[0].n, 1, "the move stays");

  // An explicit plan for another session on that date blocks it too.
  await moveSql(db, MOBILITY, "2026-10-19", "2026-10-24");
  await plannerUpsert(db, PELOTON, "2026-10-19", "2026-10-21");
  await rejects(undo(db, STRENGTH, "2026-10-19"), /back on Wed 21 Oct/);

  // Once the date is free again Undo restores the recurring Wednesday.
  await plannerUpsert(db, PELOTON, "2026-10-19", "2026-10-22");
  assert.equal((await undo(db, STRENGTH, "2026-10-19")).rows[0].ok, true);
  // An explicit original row is restored to its held date, which no other workout can take.
  await plannerUpsert(db, PELOTON, "2026-10-26", "2026-10-26");
  await moveSql(db, PELOTON, "2026-10-26", "2026-11-03");
  await rejects(moveSql(db, MOBILITY, "2026-10-26", "2026-10-26"), /already has a planned session/);
  assert.equal((await undo(db, PELOTON, "2026-10-26")).rows[0].ok, true);
});

test("SQL review fix: a workout write clears that date's rest marker whichever commits first", async () => {
  const db = await database();
  const today = (await db.query<{ d: string }>(`SELECT (now() AT TIME ZONE 'UTC')::date::text d`)).rows[0].d;
  const day = programmeAddDays(today, -1);
  const save = (kind: string, date = day) => db.query(`SELECT 1 FROM save_manual_training_activity($1, $2, $3, NULL, '', $4)`, [USER, date, kind, today]);
  const kindOn = async (date = day) => (await db.query<{ kind: string }>(`SELECT kind FROM client_manual_training_activity WHERE client_id='${CLIENT}' AND activity_date='${date}'`)).rows[0]?.kind;

  // Rest first, then the workout: the workout's own transaction removes the rest marker.
  await save("rest");
  await log(db, PELOTON, day, false);
  assert.equal(await kindOn(), "rest", "an unfinished log does not replace rest");
  await db.exec(`UPDATE client_exercise_logs SET completed=true WHERE log_date='${day}'`);
  assert.equal(await kindOn(), undefined);
  // Workout first, then rest: refused.
  await rejects(save("rest"), /already logged/);
  // A session summary counts as a workout too.
  const earlier = programmeAddDays(today, -2);
  await save("rest", earlier);
  await db.exec(`INSERT INTO client_exercise_session_summaries(client_id, session_id, log_date) VALUES ('${CLIENT}', '${STRENGTH}', '${earlier}')`);
  assert.equal(await kindOn(earlier), undefined);
  // Other activities stay alongside a workout.
  const third = programmeAddDays(today, -3);
  await save("walking", third);
  await log(db, MOBILITY, third);
  assert.equal(await kindOn(third), "walking");
});

test("SQL review fix: upgrading the already-applied schema keeps data and fixes the reported cases", async () => {
  const db = await database({ upgradeFrom: 2 });
  const today = (await db.query<{ d: string }>(`SELECT (now() AT TIME ZONE 'UTC')::date::text d`)).rows[0].d;
  await db.query(`SELECT 1 FROM save_manual_training_activity($1, $2, 'rest', NULL, '', $3)`, [USER, programmeAddDays(today, -1), today]);

  // Reproduce findings 1 and 3 on the schema production has today.
  await plannerUpsert(db, PELOTON, "2026-10-12", "2026-10-12");
  await log(db, PELOTON, "2026-10-12");
  await plannerUpsert(db, PELOTON, "2026-10-12", "2026-10-15");
  assert.equal(await plannedDate(db, PELOTON, "2026-10-12"), "2026-10-15", "before the fix a logged workout could move");
  await db.exec(`UPDATE client_training_weekly_assignments SET planned_date='2026-10-12' WHERE session_id='${PELOTON}'`);
  await plannerUpsert(db, STRENGTH, "2026-10-05", "2026-10-07", true);
  await moveSql(db, STRENGTH, "2026-10-19", "2026-10-23");
  await moveSql(db, MOBILITY, "2026-10-19", "2026-10-21");
  assert.equal((await undo(db, STRENGTH, "2026-10-19")).rows[0].ok, true, "before the fix Undo reported success onto a taken date");
  await moveSql(db, STRENGTH, "2026-10-19", "2026-10-23");

  await applyMigration(db, MIGRATIONS[2]);
  await applyMigration(db, MIGRATIONS[2]);  // re-runnable
  const counts = (await db.query<{ moves: number; rest: number; logs: number }>(`SELECT
    (SELECT count(*)::int FROM client_training_date_overrides) moves,
    (SELECT count(*)::int FROM client_manual_training_activity WHERE kind='rest') rest,
    (SELECT count(*)::int FROM client_exercise_logs) logs`)).rows[0];
  assert.deepEqual(counts, { moves: 2, rest: 1, logs: 1 }, "existing moves, rest days and logs survive the upgrade");
  await rejects(plannerUpsert(db, PELOTON, "2026-10-12", "2026-10-15"), /already logged/);
  await rejects(undo(db, STRENGTH, "2026-10-19"), /back on Wed 21 Oct/);
  // The guard also covers deletes.
  await rejects(db.exec(`DELETE FROM client_training_weekly_assignments WHERE session_id='${PELOTON}' AND week_start='2026-10-12'`), /already logged/);
  const triggers = (await db.query<{ tgname: string }>(`SELECT tgname FROM pg_trigger WHERE tgname IN
    ('assignments_logged_date_guard','exercise_logs_clear_rest_day','exercise_summaries_clear_rest_day') ORDER BY tgname`)).rows.map((r) => r.tgname);
  assert.deepEqual(triggers, ["assignments_logged_date_guard", "exercise_logs_clear_rest_day", "exercise_summaries_clear_rest_day"]);
  const grants = (await db.query<{ undo: boolean; lock: boolean }>(`SELECT
    has_function_privilege('authenticated', 'clear_training_calendar_date(uuid,uuid,uuid,date)', 'EXECUTE') undo,
    has_function_privilege('authenticated', 'lock_training_day(uuid,date)', 'EXECUTE') lock`)).rows[0];
  assert.deepEqual(grants, { undo: false, lock: false });
});

test("SQL follow-up: a non-owner learns nothing about another client's logged history from a forged write", async () => {
  const db = await database();
  await plannerUpsert(db, PELOTON, "2026-10-12", "2026-10-12");
  // Production's client-own insert policy, so the forged row is judged by RLS as it is live.
  await db.exec(`
    ALTER TABLE client_training_weekly_assignments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_insert ON client_training_weekly_assignments FOR INSERT TO authenticated WITH CHECK (EXISTS (
      SELECT 1 FROM client_profiles cp JOIN client_exercise_plans p ON p.id = client_training_weekly_assignments.plan_id AND p.client_id = cp.id
      JOIN client_exercise_sessions s ON s.id = client_training_weekly_assignments.session_id AND s.plan_id = p.id
      WHERE cp.id = client_training_weekly_assignments.client_id AND cp.user_id = auth.uid()));
    GRANT USAGE ON SCHEMA auth TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;`);
  const forge = async () => {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${OTHER_USER}', false); SET ROLE authenticated;`);
    try {
      await plannerUpsert(db, PELOTON, "2026-10-19", "2026-10-22");
      return "accepted";
    } catch (error) {
      return (error as Error).message;
    } finally {
      await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);`);
    }
  };
  const withoutLog = await forge();
  await plannerUpsert(db, PELOTON, "2026-10-19", "2026-10-19");
  await log(db, PELOTON, "2026-10-19");
  const withLog = await forge();
  assert.match(withoutLog, /row-level security/);
  assert.equal(withLog, withoutLog, "the same RLS refusal whether or not the other client has logged that workout");
});

test("SQL follow-up: a planner row cannot be re-keyed to escape its logged occurrence", async () => {
  const db = await database();
  await plannerUpsert(db, PELOTON, "2026-10-12", "2026-10-12");
  await log(db, PELOTON, "2026-10-12");
  await rejects(db.exec(`UPDATE client_training_weekly_assignments SET week_start='2026-10-19', planned_date='2026-10-19' WHERE session_id='${PELOTON}'`), /cannot change to another workout/);
  await rejects(db.exec(`UPDATE client_training_weekly_assignments SET session_id='${MOBILITY}' WHERE session_id='${PELOTON}'`), /cannot change to another workout/);
  assert.equal(await plannedDate(db, PELOTON, "2026-10-12"), "2026-10-12");
});

test("SQL follow-up: the guard judges placements the way the weekly loader shows them", async () => {
  const db = await database();
  await plannerUpsert(db, STRENGTH, "2026-10-05", "2026-10-07", true);  // Strength repeats Wednesdays
  // Week 19: Mobility explicitly takes Wednesday, so Strength is unplaced; Strength was logged Tuesday (any-day logging).
  await plannerUpsert(db, MOBILITY, "2026-10-19", "2026-10-21");
  await log(db, STRENGTH, "2026-10-20");
  await plannerUpsert(db, STRENGTH, "2026-10-19", "2026-10-22");  // first placement of an unplaced workout: allowed
  assert.equal(await plannedDate(db, STRENGTH, "2026-10-19"), "2026-10-22");

  // Week 12: Strength sits on Wednesday 14th and is logged there. Another workout cannot take its day...
  await log(db, STRENGTH, "2026-10-14");
  await rejects(plannerUpsert(db, MOBILITY, "2026-10-12", "2026-10-14"), /would move a workout that is already logged/);
  // ...and an earlier recurrence edit cannot shift it either, while an unlogged later week can still change.
  await rejects(plannerUpsert(db, STRENGTH, "2026-10-05", "2026-10-08", true), /would move a workout that is already logged/);
  await plannerUpsert(db, MOBILITY, "2026-10-12", "2026-10-15");
  await plannerUpsert(db, STRENGTH, "2026-10-26", "2026-10-29", true);
});

test("SQL follow-up: Undo refuses when a newer recurring workout now holds the original day", async () => {
  const db = await database();
  await plannerUpsert(db, STRENGTH, "2026-10-05", "2026-10-07", true);   // Strength repeats Wednesdays from 5 Oct
  await moveSql(db, STRENGTH, "2026-10-19", "2026-10-23");               // week 19's Strength moved to Friday
  await plannerUpsert(db, MOBILITY, "2026-10-12", "2026-10-14", true);   // coach: Mobility repeats Wednesdays from 12 Oct
  await rejects(undo(db, STRENGTH, "2026-10-19"), /back on Wed 21 Oct/);
  assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int n FROM client_training_date_overrides WHERE session_id='${STRENGTH}'`)).rows[0].n, 1, "the move stays");
  // Once Mobility stops repeating, Undo restores Strength to Wednesday.
  await db.exec(`INSERT INTO client_training_weekly_assignments(client_id, plan_id, session_id, week_start, planned_date, recurrence_stopped)
    VALUES ('${CLIENT}', '${PLAN}', '${MOBILITY}', '2026-10-19', NULL, true)`);
  assert.equal((await undo(db, STRENGTH, "2026-10-19")).rows[0].ok, true);
});

test("SQL follow-up: deleting a session or client cascades through logged, placed workouts", async () => {
  const db = await database();
  // Production's foreign keys, created in production's order (assignments before summaries).
  await db.exec(`
    ALTER TABLE client_training_weekly_assignments ADD FOREIGN KEY (session_id) REFERENCES client_exercise_sessions ON DELETE CASCADE,
      ADD FOREIGN KEY (client_id) REFERENCES client_profiles ON DELETE CASCADE;
    ALTER TABLE client_exercise_plans DROP CONSTRAINT client_exercise_plans_client_id_fkey,
      ADD FOREIGN KEY (client_id) REFERENCES client_profiles ON DELETE CASCADE;
    ALTER TABLE client_exercise_session_summaries ADD FOREIGN KEY (session_id) REFERENCES client_exercise_sessions ON DELETE CASCADE,
      ADD FOREIGN KEY (client_id) REFERENCES client_profiles ON DELETE CASCADE;`);
  await plannerUpsert(db, PELOTON, "2026-10-12", "2026-10-12");
  await db.exec(`INSERT INTO client_exercise_session_summaries(client_id, session_id, log_date) VALUES ('${CLIENT}', '${PELOTON}', '2026-10-12')`);
  await rejects(db.exec(`DELETE FROM client_training_weekly_assignments WHERE session_id='${PELOTON}'`), /already logged/);  // a direct delete is still a replan
  await db.exec(`DELETE FROM client_exercise_sessions WHERE id='${PELOTON}'`);
  await plannerUpsert(db, STRENGTH, "2026-10-12", "2026-10-14");
  await db.exec(`INSERT INTO client_exercise_session_summaries(client_id, session_id, log_date) VALUES ('${CLIENT}', '${STRENGTH}', '2026-10-14')`);
  await db.exec(`DELETE FROM client_profiles WHERE id='${CLIENT}'`);
  assert.equal((await db.query<{ n: number }>(`SELECT count(*)::int n FROM client_training_weekly_assignments`)).rows[0].n, 0);
});
