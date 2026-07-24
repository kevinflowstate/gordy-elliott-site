import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260724100000_add_early_win.sql",
  import.meta.url,
);

test("early win tables exist with row level security enabled", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.client_early_wins/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.client_early_win_entries/);
  assert.match(migration, /ALTER TABLE public\.client_early_wins ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.client_early_win_entries ENABLE ROW LEVEL SECURITY/);
});

test("clients can read only their own active Founder early win", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.equal((migration.match(/client_profiles\.user_id = \(SELECT auth\.uid\(\)\)/g) || []).length, 2);
  assert.equal((migration.match(/client_profiles\.experience_mode = 'founder_dashboard'/g) || []).length, 2);
  assert.equal((migration.match(/client_early_wins\.status = 'active'/g) || []).length, 2);
});

test("writes are admin-only through private.is_admin on both tables", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.equal((migration.match(/\(SELECT private\.is_admin\(\)\)/g) || []).length, 4);
  assert.equal((migration.match(/FOR ALL TO authenticated/g) || []).length, 2);
});

test("only one active early win is allowed per client", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_client_early_wins_one_active\s+ON public\.client_early_wins\(client_id\) WHERE status = 'active'/,
  );
});

test("metric identity is constrained to the supported allowlist and sources", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /metric_key IN \('hrv_ms', 'resting_hr_bpm', 'sleep_minutes', 'weight_kg', 'waist_cm', 'manual'\)/);
  assert.match(migration, /source IN \('wearable', 'body_measurement', 'manual'\)/);
  assert.match(migration, /metric_key = 'manual' AND source = 'manual'/);
});

test("free text columns carry length caps", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /char_length\(display_label\) BETWEEN 1 AND 80/);
  assert.match(migration, /char_length\(unit\) BETWEEN 1 AND 20/);
  assert.match(migration, /char_length\(coaching_note\) <= 500/);
  assert.match(migration, /char_length\(review_outcome\) <= 1000/);
});

test("completion requires a review timestamp and an active win carries none", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /status = 'active' AND reviewed_at IS NULL AND review_outcome IS NULL/);
  assert.match(migration, /status = 'completed' AND reviewed_at IS NOT NULL/);
});

test("completed early win immutability does not block account deletion", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /REFERENCES public\.client_profiles\(id\) ON DELETE CASCADE/);
  assert.match(migration, /REFERENCES public\.client_early_wins\(id\) ON DELETE CASCADE/);
  assert.match(migration, /BEFORE UPDATE ON public\.client_early_wins/);
  assert.doesNotMatch(migration, /BEFORE UPDATE OR DELETE/);
});

test("manual entries are unique per day and bounded", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /UNIQUE \(early_win_id, entry_date\)/);
  assert.match(migration, /value BETWEEN -100000 AND 100000/);
});
