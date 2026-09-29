import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("plan overview backfill is safe to re-run without replacing coach-authored text", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260930100000_client_exercise_plan_overview.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /ADD COLUMN IF NOT EXISTS overview text/);
  assert.match(migration, /plan\.template_id = template\.id/);
  assert.match(migration, /NULLIF\(BTRIM\(plan\.overview\), ''\) IS NULL/);
  assert.match(migration, /NULLIF\(BTRIM\(template\.overview\), ''\) IS NOT NULL/);
});
