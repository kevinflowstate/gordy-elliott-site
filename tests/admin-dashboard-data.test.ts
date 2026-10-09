import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const requireActual = createRequire(new URL("../lib/admin-data.ts", import.meta.url));
test("admin dashboard queries include the UK Monday entry while UTC is still Sunday", async () => {
  const bounds: Array<{ table: string; key: string; value: unknown }> = [];
  const profile = { id: "fictional", user_id: "fictional-user", user: { full_name: "Example", email: "example@example.invalid" }, created_at: "2026-08-01T12:00:00Z", start_date: "2026-08-01", tier: "coached", programme_type: "shift", experience_mode: "ai_coaching", onboarding_status: "active", last_login: "2026-10-05T00:00:00Z", last_checkin: "2026-10-05T00:00:00Z" };
  const admin = { from(table: string) {
    const result = () => ({ data: table === "client_profiles" ? profile : [], error: null });
    const builder = {
      select() { return builder; }, eq() { return builder; }, in() { return builder; }, order() { return builder; }, limit() { return builder; },
      lte(key: string, value: unknown) { bounds.push({ table, key, value }); return builder; },
      gte() { return builder; },
      single() { return Promise.resolve(result()); },
      maybeSingle() { return Promise.resolve({ data: table === "client_profiles" ? profile : null, error: null }); },
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return Promise.resolve(result()).then(resolve, reject); },
    };
    return builder;
  } };
  class FixedDate extends Date {
    constructor(value?: string | number | Date) { super(value === undefined ? "2026-10-04T23:30:00Z" : value instanceof Date ? value.getTime() : value); }
  }
  const source = await readFile(new URL("../lib/admin-data.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: { getClientById?: (id: string) => Promise<unknown> } = {};
  new Function("require", "exports", "Date", compiled)((id: string) => id === "@/lib/supabase/admin" ? { createAdminClient: () => admin } : requireActual(id), exports, FixedDate);
  await exports.getClientById!("fictional");
  for (const table of ["client_daily_metrics", "client_wearable_daily_summaries", "client_exercise_logs", "client_meal_tracking"]) {
    assert.equal(bounds.find((bound) => bound.table === table)?.value, "2026-10-05", `${table} must use the same day as the displayed tracker`);
  }
});
