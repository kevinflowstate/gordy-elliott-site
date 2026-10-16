#!/usr/bin/env bash
# Real two-connection check that rest-day saves and workout logs cannot both land on one date.
# Needs local Postgres binaries (initdb, pg_ctl, psql). Uses a throwaway cluster in a temp directory;
# touches no Supabase project. Usage: scripts/check-training-day-concurrency.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
PORT="${PGPORT_CHECK:-54339}"
cleanup() { pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
initdb -D "$WORK/data" -A trust -U postgres >/dev/null
pg_ctl -D "$WORK/data" -o "-k $WORK -p $PORT -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
q() { PGOPTIONS="-c client_min_messages=warning" psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

USER_ID=00000000-0000-4000-8000-000000000101
CLIENT=00000000-0000-4000-8000-000000000001
PLAN=00000000-0000-4000-8000-000000000010
SESSION=00000000-0000-4000-8000-000000000020
q <<SQL
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid \$\$;
CREATE TABLE client_profiles(id uuid primary key, user_id uuid unique, programme_type text, fitness_plans_enabled boolean default false);
CREATE TABLE client_exercise_plans(id uuid primary key, client_id uuid not null references client_profiles, status text not null default 'active',
  start_date date, programme_weeks integer, created_at timestamptz default now());
CREATE TABLE client_exercise_sessions(id uuid primary key, plan_id uuid not null references client_exercise_plans on delete cascade, name text, day_number int, week_number int);
CREATE TABLE client_exercise_logs(id uuid primary key default gen_random_uuid(), client_id uuid not null, exercise_item_id uuid default gen_random_uuid(), session_id uuid, log_date date not null, completed boolean default true);
CREATE TABLE client_exercise_session_summaries(id uuid primary key default gen_random_uuid(), client_id uuid not null, session_id uuid not null, log_date date not null);
CREATE TABLE client_training_weekly_assignments(id uuid primary key default gen_random_uuid(), client_id uuid not null, plan_id uuid not null, session_id uuid not null,
  week_start date not null, planned_date date, is_recurring boolean not null default false, recurrence_stopped boolean not null default false,
  UNIQUE(client_id, plan_id, session_id, week_start));
INSERT INTO client_profiles VALUES ('$CLIENT', '$USER_ID', 'shift', false);
INSERT INTO client_exercise_plans(id, client_id, start_date) VALUES ('$PLAN', '$CLIENT', '2026-09-07');
INSERT INTO client_exercise_sessions VALUES ('$SESSION', '$PLAN', 'Peloton ride', 1, NULL);
SQL
q -f "$ROOT/supabase/migrations/20261016100000_training_calendar_activity.sql"
q -f "$ROOT/supabase/migrations/20261016110000_scope_training_date_override_state.sql"
q <<SQL
CREATE TRIGGER exercise_logs_plan_lock BEFORE INSERT OR UPDATE ON client_exercise_logs FOR EACH ROW EXECUTE FUNCTION public.lock_exercise_plan_for_history();
CREATE TRIGGER exercise_summaries_plan_lock BEFORE INSERT OR UPDATE ON client_exercise_session_summaries FOR EACH ROW EXECUTE FUNCTION public.lock_exercise_plan_for_history();
CREATE TRIGGER exercise_assignments_plan_lock BEFORE INSERT OR UPDATE ON client_training_weekly_assignments FOR EACH ROW EXECUTE FUNCTION public.lock_exercise_plan_for_history();
SQL

TODAY="$(q -c "SELECT (now() AT TIME ZONE 'UTC')::date")"
day() { q -c "SELECT ('$TODAY'::date - $1)::text"; }
rest_sql() { echo "SELECT 1 FROM save_manual_training_activity('$USER_ID', '$1', 'rest', NULL, '', '$TODAY');"; }
log_sql() { echo "INSERT INTO client_exercise_logs(client_id, session_id, log_date, completed) VALUES ('$CLIENT', '$SESSION', '$1', true);"; }
state() { q -c "SELECT (SELECT count(*) FROM client_manual_training_activity WHERE activity_date='$1' AND kind='rest') || ' rest, ' || (SELECT count(*) FROM client_exercise_logs WHERE log_date='$1' AND completed) || ' workout'"; }

# Rest transaction is in flight (check done, row written, not yet committed) when the workout is logged.
rest_first() {
  local d="$1"
  q -c "BEGIN; $(rest_sql "$d") SELECT pg_sleep(2); COMMIT;" >/dev/null &
  sleep 0.5
  local started; started=$(date +%s)
  q -c "$(log_sql "$d")"
  # Before the fix the route deleted the marker itself; after it, only the database trigger may clear it.
  [ "${2:-}" = "with-route-delete" ] && q -c "DELETE FROM client_manual_training_activity WHERE activity_date='$d' AND kind='rest';"
  local waited=$(( $(date +%s) - started ))
  wait
  echo "rest first:    $(state "$d") (workout waited ${waited}s)"
}
# Workout transaction is in flight when rest is saved.
workout_first() {
  local d="$1" out
  q -c "BEGIN; $(log_sql "$d") SELECT pg_sleep(2); COMMIT;" >/dev/null &
  sleep 0.5
  out="$(q -c "$(rest_sql "$d")" 2>&1 || true)"
  wait
  echo "workout first: $(state "$d") (rest save: ${out:-accepted})"
}

echo "== Schema production has today (20261016100000 + 20261016110000)"
rest_first "$(day 1)" with-route-delete
workout_first "$(day 2)"
q -f "$ROOT/supabase/migrations/20261016120000_training_calendar_review_fixes.sql"
echo "== After 20261016120000_training_calendar_review_fixes"
rest_first "$(day 3)"
workout_first "$(day 4)"

BAD="$(q -c "SELECT count(*) FROM client_manual_training_activity r WHERE r.kind='rest' AND r.activity_date >= '$TODAY'::date - 4 AND r.activity_date <= '$TODAY'::date - 3
  AND EXISTS (SELECT 1 FROM client_exercise_logs l WHERE l.log_date = r.activity_date AND l.completed)")"
if [ "$BAD" = "0" ]; then echo "PASS: no date has both a rest marker and a completed workout after the fix"; else echo "FAIL: $BAD date(s) have both"; exit 1; fi

# Existing-row upserts fire both INSERT and UPDATE guards. Delay the final INSERT trigger so
# two connections would both hold SHARE before upgrading if the stronger guard lock were skipped.
SESSION_TWO=00000000-0000-4000-8000-000000000021
q <<SQL
INSERT INTO client_exercise_sessions VALUES ('$SESSION_TWO', '$PLAN', 'Strength', 2, NULL);
INSERT INTO client_training_weekly_assignments(client_id,plan_id,session_id,week_start,planned_date) VALUES
 ('$CLIENT','$PLAN','$SESSION','2030-01-07','2030-01-07'),
 ('$CLIENT','$PLAN','$SESSION_TWO','2030-01-07','2030-01-08');
CREATE FUNCTION public.test_pause_planner_insert() RETURNS trigger LANGUAGE plpgsql AS \$\$
BEGIN PERFORM pg_sleep(1); RETURN NEW; END; \$\$;
CREATE TRIGGER zz_test_pause_planner_insert BEFORE INSERT ON client_training_weekly_assignments
 FOR EACH ROW EXECUTE FUNCTION public.test_pause_planner_insert();
SQL
upsert_planner() {
  q -c "INSERT INTO client_training_weekly_assignments(client_id,plan_id,session_id,week_start,planned_date)
    VALUES ('$CLIENT','$PLAN','$1','2030-01-07','$2')
    ON CONFLICT(client_id,plan_id,session_id,week_start) DO UPDATE SET planned_date=excluded.planned_date;"
}
upsert_planner "$SESSION" '2030-01-10' >"$WORK/planner-a.log" 2>&1 &
PLANNER_A=$!
upsert_planner "$SESSION_TWO" '2030-01-11' >"$WORK/planner-b.log" 2>&1 &
PLANNER_B=$!
PLANNER_FAILED=0
wait "$PLANNER_A" || PLANNER_FAILED=1
wait "$PLANNER_B" || PLANNER_FAILED=1
if [ "$PLANNER_FAILED" != 0 ]; then
  cat "$WORK/planner-a.log" "$WORK/planner-b.log"
  echo 'FAIL: concurrent existing-assignment upserts must not deadlock'
  exit 1
fi
PLACED="$(q -c "SELECT count(*) FROM client_training_weekly_assignments WHERE week_start='2030-01-07'
  AND ((session_id='$SESSION' AND planned_date='2030-01-10') OR (session_id='$SESSION_TWO' AND planned_date='2030-01-11'))")"
[ "$PLACED" = 2 ] || { echo 'FAIL: both planner updates must persist'; exit 1; }
echo 'PASS: concurrent existing-assignment upserts serialize and both persist'
