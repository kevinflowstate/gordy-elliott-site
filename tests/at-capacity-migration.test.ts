import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260723123000_add_capacity_baselines.sql",
  import.meta.url,
);
const attentionMigrationUrl = new URL(
  "../supabase/migrations/20260723130000_bound_attention_activity_dates.sql",
  import.meta.url,
);
const experienceMigrationUrl = new URL(
  "../supabase/migrations/20260723113000_add_client_experience_mode.sql",
  import.meta.url,
);

test("locked baseline immutability does not block account deletion", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /BEFORE UPDATE ON public\.client_capacity_baselines/);
  assert.doesNotMatch(migration, /BEFORE UPDATE OR DELETE/);
});

test("clients can read only locked Founder baselines", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /client_profiles\.experience_mode = 'founder_dashboard'/);
  assert.match(migration, /client_capacity_baselines\.status = 'locked'/);
  assert.match(migration, /weight_kg BETWEEN 20 AND 400/);
  assert.match(migration, /body_fat_percentage BETWEEN 1 AND 75/);
  assert.match(migration, /waist_cm BETWEEN 30 AND 250/);
});

test("Founder Dashboard cannot be paired with the AI-only tier", async () => {
  const migration = await readFile(experienceMigrationUrl, "utf8");
  assert.match(migration, /experience_mode <> 'founder_dashboard' OR tier IS DISTINCT FROM 'ai_only'/);
});

test("shared latest-activity data excludes future tracker rows", async () => {
  const migration = await readFile(attentionMigrationUrl, "utf8");
  const londonToday = /CURRENT_TIMESTAMP AT TIME ZONE 'Europe\/London'/g;
  assert.equal((migration.match(londonToday) || []).length, 4);
  assert.match(migration, /log_date <= \(CURRENT_TIMESTAMP AT TIME ZONE 'Europe\/London'\)::date/);
  assert.equal((migration.match(/tracked_date <= \(CURRENT_TIMESTAMP AT TIME ZONE 'Europe\/London'\)::date/g) || []).length, 2);
  assert.match(migration, /summary_date <= \(CURRENT_TIMESTAMP AT TIME ZONE 'Europe\/London'\)::date/);
  assert.match(migration, /WITH \(security_invoker = true\)/);
  assert.match(migration, /GRANT SELECT ON public\.client_attention_latest_activity TO service_role/);
});
