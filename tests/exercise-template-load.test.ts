import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTemplateRows } from "../lib/exercise-template-load";

function database(rows: { id: string; session_id: string }[], failPage = -1) {
  let calls = 0;
  const admin = { from() {
    let from = 0, to = 0, ids: string[] | undefined;
    const q = {
      select() { return q; }, order(column: string) { assert.equal(column, "id"); return q; },
      range(start: number, end: number) { from = start; to = end; return q; },
      in(_column: string, values: string[]) { ids = values; assert.ok(values.length <= 20); return q; },
      eq() { return q; },
      then(resolve: (value: unknown) => unknown) {
        const filtered = rows.filter(r => !ids || ids.includes(r.session_id)).sort((a,b) => a.id.localeCompare(b.id));
        return Promise.resolve(calls++ === failPage ? { data: null, error: { message: "network failed" } } : { data: filtered.slice(from, to + 1), error: null }).then(resolve);
      },
    }; return q;
  } } as unknown as SupabaseClient;
  return admin;
}
const rows = Array.from({ length: 1194 }, (_, i) => ({ id: String(i).padStart(5, "0"), session_id: `s${i % 111}` }));
test("loads all 1,194 exercise rows across 111 sessions, including final cool-down", async () => {
  const result = await loadTemplateRows(database(rows), "items", "*", { column: "session_id", ids: rows.map(r => r.session_id) });
  assert.equal(result.error, null);
  assert.equal(result.data?.length, 1194);
  assert.equal(new Set(result.data?.map(r => r.id)).size, 1194);
  assert.ok(result.data?.some(r => r.id === "01193"));
});
test("paginates a single very long template, including exact page boundaries", async () => {
  for (const length of [500, 1000, 1194]) {
    const data = rows.slice(0, length).map(r => ({ ...r, session_id: "one" }));
    const result = await loadTemplateRows(database(data), "items", "*", { column: "session_id", ids: ["one"] });
    assert.equal(result.data?.length, length);
  }
});
test("a later page failure never returns a partial editable plan", async () => {
  const result = await loadTemplateRows(database(rows.map(r => ({ ...r, session_id: "one" })), 1), "items", "*", { column: "session_id", ids: ["one"] });
  assert.equal(result.data, null);
  assert.ok(result.error);
});
test("empty session list does not query unrelated items", async () => {
  const result = await loadTemplateRows(database(rows), "items", "*", { column: "session_id", ids: [] });
  assert.deepEqual(result.data, []);
});
