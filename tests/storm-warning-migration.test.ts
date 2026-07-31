import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260728122215_add_storm_warnings.sql",
  import.meta.url,
);

test("storm warning tables enable RLS and cascade with the client profile", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /ALTER TABLE public\.client_storm_warnings ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.client_storm_warning_dismissals ENABLE ROW LEVEL SECURITY/);
  assert.equal(
    (migration.match(/REFERENCES public\.client_profiles\(id\) ON DELETE CASCADE/g) || []).length,
    2,
  );
});

test("clients read their own storm data through the Founder-mode idiom", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  // 2 = warnings SELECT + dismissals SELECT. Dismissal writes are API-only,
  // so no client INSERT/UPDATE policies may exist.
  assert.equal(
    (migration.match(/client_profiles\.user_id = \(SELECT auth\.uid\(\)\)/g) || []).length,
    2,
  );
  assert.equal(
    (migration.match(/client_profiles\.experience_mode = 'founder_dashboard'/g) || []).length,
    2,
  );
  assert.match(migration, /"Clients view own storm warnings"/);
  assert.match(migration, /"Clients view own storm warning dismissals"/);
  assert.doesNotMatch(migration, /CREATE POLICY "Clients dismiss own storm warnings"/);
  assert.doesNotMatch(migration, /CREATE POLICY "Clients update own storm warning dismissals"/);
});

test("admins keep full access through the house idiom", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.equal((migration.match(/\(SELECT private\.is_admin\(\)\)/g) || []).length, 4);
  assert.match(migration, /"Admins manage storm warnings"[\s\S]*FOR ALL TO authenticated/);
  assert.match(migration, /"Admins manage storm warning dismissals"[\s\S]*FOR ALL TO authenticated/);
});

test("the audit log is deduplicated and constrained", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /UNIQUE \(client_id, window_key, input_hash\)/);
  assert.match(migration, /UNIQUE \(client_id, window_key\)/);
  assert.equal((migration.match(/CHECK \(severity IN \('amber', 'red'\)\)/g) || []).length, 2);
  assert.equal((migration.match(/CHECK \(window_key ~ '\^\\d\{4\}-W\\d\{2\}\$'\)/g) || []).length, 2);
  assert.match(migration, /CHECK \(window_end >= window_start\)/);
  assert.match(migration, /CHECK \(array_length\(triggered_rules, 1\) >= 1\)/);
  assert.match(migration, /idx_client_storm_warnings_client_window/);
  assert.match(migration, /idx_client_storm_warnings_evaluated/);
  assert.match(migration, /idx_client_storm_warning_dismissals_window/);
});

test("clients can never write storm rows directly", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(
    migration,
    /REVOKE ALL ON TABLE public\.client_storm_warnings, public\.client_storm_warning_dismissals\s+FROM anon, authenticated;/,
  );
  assert.match(
    migration,
    /GRANT SELECT ON TABLE public\.client_storm_warnings, public\.client_storm_warning_dismissals\s+TO authenticated;/,
  );
  // Dismissals are written only by the service-role API after a fresh
  // server-side evaluation - no direct client INSERT/UPDATE/DELETE grants.
  assert.doesNotMatch(migration, /GRANT [^;]*(INSERT|UPDATE|DELETE)[^;]* ON public\.client_storm_warning/);
});

test("all warning writers share an atomic database-owned retention cap", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.log_client_storm_warning/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(
    migration,
    /SELECT count\(\*\)\s+FROM public\.client_storm_warnings\s+WHERE client_id = p_client_id\s+AND window_key = p_window_key\s+\) >= 30/,
  );
  assert.match(
    migration,
    /ON CONFLICT \(client_id, window_key, input_hash\) DO NOTHING/,
  );
  assert.match(
    migration,
    /REVOKE ALL ON FUNCTION public\.log_client_storm_warning\([\s\S]*\) FROM anon, authenticated;/,
  );
  assert.match(
    migration,
    /GRANT EXECUTE ON FUNCTION public\.log_client_storm_warning\([\s\S]*\) TO service_role;/,
  );
});
