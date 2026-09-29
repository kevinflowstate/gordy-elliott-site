import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/20260930120000_atomic_exercise_template_save.sql", import.meta.url);
const routeUrl = new URL("../app/api/admin/exercise-templates/route.ts", import.meta.url);

test("template replacement happens inside one service-role-only database function", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.save_exercise_training_template/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /DELETE FROM public\.exercise_training_sessions WHERE template_id = v_template_id/);
  assert.match(sql, /INSERT INTO public\.exercise_training_session_items/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.save_exercise_training_template\(uuid, jsonb\)\s+FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.save_exercise_training_template\(uuid, jsonb\)\s+TO service_role/);
});

test("POST delegates the whole save to the atomic function", async () => {
  const route = await readFile(routeUrl, "utf8");
  const post = route.split("export async function POST")[1].split("export async function DELETE")[0];
  assert.match(post, /admin\.rpc\("save_exercise_training_template"/);
  assert.doesNotMatch(post, /\.from\("exercise_training_sessions"\)/);
  assert.doesNotMatch(post, /\.from\("exercise_training_session_items"\)/);
});
