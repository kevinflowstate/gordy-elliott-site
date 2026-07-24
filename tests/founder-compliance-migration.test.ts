import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const complianceMigrationUrl = new URL(
  "../supabase/migrations/20260724120000_add_founder_compliance.sql",
  import.meta.url,
);
const reviewsMigrationUrl = new URL(
  "../supabase/migrations/20260724121000_add_month4_reviews_and_baseline_overrides.sql",
  import.meta.url,
);

test("compliance tables exist with row level security enabled", async () => {
  const migration = await readFile(complianceMigrationUrl, "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.client_call_attendance/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.client_whatsapp_help/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.guarantee_settings/);
  assert.match(migration, /ALTER TABLE public\.client_call_attendance ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.client_whatsapp_help ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.guarantee_settings ENABLE ROW LEVEL SECURITY/);
});

test("compliance records are admin-only with no client read policy", async () => {
  const migration = await readFile(complianceMigrationUrl, "utf8");
  assert.equal((migration.match(/\(SELECT private\.is_admin\(\)\)/g) || []).length, 6);
  assert.equal((migration.match(/FOR ALL TO authenticated/g) || []).length, 3);
  assert.doesNotMatch(migration, /client_profiles\.user_id = \(SELECT auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /FOR SELECT/);
});

test("call records carry an allowlisted type and a bounded note", async () => {
  const migration = await readFile(complianceMigrationUrl, "utf8");
  assert.match(migration, /call_type IN \('coaching_call', 'strategy_call'\)/);
  assert.equal((migration.match(/char_length\(note\) <= 500/g) || []).length, 2);
  assert.match(migration, /attended BOOLEAN NOT NULL/);
});

test("whatsapp help is one row per client-week with a validated week key", async () => {
  const migration = await readFile(complianceMigrationUrl, "utf8");
  assert.match(migration, /week_key ~ '\^\\d\{4\}-W\\d\{2\}\$'/);
  assert.match(migration, /UNIQUE \(client_id, week_key\)/);
  assert.match(migration, /helped BOOLEAN NOT NULL/);
});

test("the guarantee is a single row that starts entirely unconfigured", async () => {
  const migration = await readFile(complianceMigrationUrl, "utf8");
  assert.match(migration, /id SMALLINT PRIMARY KEY DEFAULT 1 CHECK \(id = 1\)/);
  assert.match(migration, /INSERT INTO public\.guarantee_settings \(id\) VALUES \(1\) ON CONFLICT \(id\) DO NOTHING/);
  assert.doesNotMatch(migration, /metric_key TEXT NOT NULL/);
  assert.doesNotMatch(migration, /threshold_value NUMERIC\(10,2\) NOT NULL/);
  assert.doesNotMatch(migration, /DEFAULT '(coaching_call|hrv_ms|increase_at_least|absolute|percent)'/);
});

test("guarantee fields are allowlisted and the remedy is bounded", async () => {
  const migration = await readFile(complianceMigrationUrl, "utf8");
  assert.match(migration, /metric_key IN \('hrv_ms', 'resting_hr_bpm', 'sleep_minutes', 'sleep_score', 'weight_kg', 'body_fat_percentage', 'waist_cm'\)/);
  assert.match(migration, /comparison IN \('increase_at_least', 'decrease_at_least'\)/);
  assert.match(migration, /threshold_type IN \('absolute', 'percent'\)/);
  assert.match(migration, /threshold_value IS NULL OR threshold_value > 0/);
  assert.match(migration, /char_length\(remedy_text\) <= 1000/);
});

test("compliance records do not block account deletion", async () => {
  const migration = await readFile(complianceMigrationUrl, "utf8");
  assert.equal(
    (migration.match(/REFERENCES public\.client_profiles\(id\) ON DELETE CASCADE/g) || []).length,
    2,
  );
  assert.doesNotMatch(migration, /BEFORE UPDATE OR DELETE/);
});

test("month 4 review and baseline override tables exist with row level security", async () => {
  const migration = await readFile(reviewsMigrationUrl, "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.client_month4_reviews/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.client_baseline_overrides/);
  assert.match(migration, /ALTER TABLE public\.client_month4_reviews ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.client_baseline_overrides ENABLE ROW LEVEL SECURITY/);
});

test("each client has at most one month 4 review", async () => {
  const migration = await readFile(reviewsMigrationUrl, "utf8");
  assert.match(migration, /client_id UUID NOT NULL UNIQUE REFERENCES public\.client_profiles\(id\) ON DELETE CASCADE/);
});

test("clients read only their own completed Founder review; writes are admin-only", async () => {
  const migration = await readFile(reviewsMigrationUrl, "utf8");
  assert.equal((migration.match(/client_profiles\.user_id = \(SELECT auth\.uid\(\)\)/g) || []).length, 1);
  assert.equal((migration.match(/client_profiles\.experience_mode = 'founder_dashboard'/g) || []).length, 1);
  assert.match(migration, /client_month4_reviews\.status = 'completed'/);
  assert.equal((migration.match(/\(SELECT private\.is_admin\(\)\)/g) || []).length, 4);
  assert.equal((migration.match(/FOR ALL TO authenticated/g) || []).length, 2);
});

test("a completed review must carry both snapshots, an outcome note and a timestamp", async () => {
  const migration = await readFile(reviewsMigrationUrl, "utf8");
  assert.match(migration, /status = 'draft' AND completed_at IS NULL/);
  assert.match(
    migration,
    /status = 'completed'\s+AND completed_at IS NOT NULL\s+AND baseline_comparison IS NOT NULL\s+AND compliance_summary IS NOT NULL\s+AND outcome_note IS NOT NULL/,
  );
  assert.match(migration, /char_length\(outcome_note\) <= 1000/);
});

test("completed reviews and override audit rows are immutable without blocking deletion cascades", async () => {
  const migration = await readFile(reviewsMigrationUrl, "utf8");
  assert.match(migration, /Completed Month 4 reviews are immutable/);
  assert.match(migration, /BEFORE UPDATE ON public\.client_month4_reviews/);
  assert.match(migration, /Baseline override audit records are immutable/);
  assert.match(migration, /BEFORE UPDATE ON public\.client_baseline_overrides/);
  assert.doesNotMatch(migration, /BEFORE UPDATE OR DELETE/);
  assert.match(migration, /baseline_id UUID NOT NULL REFERENCES public\.client_capacity_baselines\(id\) ON DELETE CASCADE/);
});

test("the override audit row stores prior values, replacement values, reason, actor and time", async () => {
  const migration = await readFile(reviewsMigrationUrl, "utf8");
  assert.match(migration, /old_values JSONB NOT NULL/);
  assert.match(migration, /new_values JSONB NOT NULL/);
  assert.match(migration, /char_length\(btrim\(reason\)\) BETWEEN 1 AND 500/);
  assert.match(migration, /actor UUID REFERENCES public\.users\(id\) ON DELETE SET NULL/);
  assert.match(migration, /created_at TIMESTAMPTZ NOT NULL DEFAULT NOW\(\)/);
});

test("the override function requires a written reason and audits before it relocks", async () => {
  const migration = await readFile(reviewsMigrationUrl, "utf8");
  assert.match(migration, /RAISE EXCEPTION 'An override reason is required'/);
  assert.match(migration, /RAISE EXCEPTION 'The override reason is limited to 500 characters'/);
  assert.match(migration, /RAISE EXCEPTION 'Only a locked baseline can be overridden'/);
  const auditIndex = migration.indexOf("INSERT INTO public.client_baseline_overrides");
  const updateIndex = migration.indexOf("UPDATE public.client_capacity_baselines SET");
  assert.ok(auditIndex > -1 && updateIndex > -1 && auditIndex < updateIndex);
  assert.match(migration, /status = 'locked',\s+locked_at = v_now/);
});

test("the override path is service-role only and the lock trigger stays closed otherwise", async () => {
  const migration = await readFile(reviewsMigrationUrl, "utf8");
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.override_locked_capacity_baseline\(UUID, JSONB, TEXT, UUID\) FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.override_locked_capacity_baseline\(UUID, JSONB, TEXT, UUID\) FROM anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.override_locked_capacity_baseline\(UUID, JSONB, TEXT, UUID\) TO service_role/);
  assert.match(migration, /set_config\('app\.capacity_baseline_override', 'allow', true\)/);
  assert.match(migration, /current_setting\('app\.capacity_baseline_override', true\)/);
  assert.match(migration, /RAISE EXCEPTION 'Locked capacity baselines are immutable'/);
});
