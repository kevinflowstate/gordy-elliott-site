import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";
import { checkinConfigRevision } from "../lib/checkin-revision";
import * as forms from "../lib/checkin-form";
import type { CheckinFormConfig } from "../lib/types";

function businessConfig(): CheckinFormConfig {
  return forms.normalizeCheckinConfig({ ...forms.buildFallbackCheckinConfig("boardroom"), progress_tracking: [
    { id: "booked", label: "Revenue booked", type: "number", kind: "money", enabled: true, required: true },
    { id: "enquiries", label: "Enquiries", type: "number", kind: "count", enabled: true },
    { id: "hours", label: "Admin hours", type: "number", kind: "hours", enabled: true },
    { id: "conversion", label: "Conversion", type: "number", kind: "percentage", enabled: true },
    { id: "focus", label: "Focus", type: "scale", kind: "score", enabled: true },
  ] });
}
const answers = { wins: "Quoted a new job", challenges: "Admin", booked: "0", enquiries: "0", hours: "0.5", conversion: "0", focus: "1" };

test("business normalization never inserts fitness defaults and preserves stable personal field IDs", () => {
  const config = businessConfig();
  assert.deepEqual(config.questions.map(q => q.id), ["wins", "challenges", "one_number", "mission"]);
  assert.equal(config.progress_tracking?.find(m => m.id === "booked")?.unit, "£");
  assert.equal(config.progress_tracking?.some(m => m.id === "weight"), false);
  assert.deepEqual(forms.normalizeCheckinConfig(config).progress_tracking?.map(m => m.id), config.progress_tracking?.map(m => m.id));
  assert.ok(forms.normalizeCheckinConfig(null).progress_tracking?.some(m => m.id === "weight"));
});

test("changing a business score to a number removes the slider input", () => {
  const config = businessConfig();
  const score = config.progress_tracking!.find(metric => metric.id === "focus")!;
  const changed = forms.normalizeCheckinConfig({ ...config, progress_tracking: [{ ...score, kind: "number", min: undefined, max: undefined, unit: undefined }] });
  assert.equal(changed.progress_tracking![0].type, "number");
  assert.equal(forms.validateCheckinSubmission(changed, null, { wins: "Good", challenges: "None", focus: "125.5" }).error, undefined);
});

test("business numbers accept zero, validate kinds/ranges, required answers and choices; unrelated fields omitted", () => {
  const config = businessConfig();
  const submitted = forms.validateCheckinSubmission(config, null, { ...answers, weight: "85", unknown: "anything" });
  assert.equal(submitted.error, undefined);
  assert.equal(submitted.responses.booked, "0");
  assert.equal(submitted.responses.weight, undefined);
  for (const invalid of [{ enquiries: "1.5" }, { enquiries: "-1" }, { hours: "-1" }, { conversion: "101" }, { focus: "0" }, { focus: "1.5" }, { booked: "Infinity" }, { booked: "" }, { wins: " " }, { mission: "invented" }]) assert.ok(forms.validateCheckinSubmission(config, null, { ...answers, ...invalid }).error);
  assert.ok(forms.validateCheckinTemplate({ ...config, questions: [...config.questions, config.questions[0]] }));
});

async function fixture(assigned: CheckinFormConfig | null, existing: Record<string, unknown> | null = null) {
  const queries: Array<{ table: string; payload?: Record<string, unknown>; filters: Record<string, unknown> }> = [];
  const admin = { from(table: string) {
    const query: typeof queries[number] = { table, filters: {} }; queries.push(query);
    const result = () => ({ data: table === "client_profiles" ? { id: "business-client", programme_type: "boardroom", tier: "coached", checkin_form_id: assigned ? "personal-template" : null } : table === "checkin_forms" ? { id: "personal-template", name: "Aaron's questions", config: assigned } : table === "checkins" ? existing : null, error: null });
    const builder = { select() { return builder; }, eq(key: string, value: unknown) { query.filters[key] = value; return builder; }, gte() { return builder; }, order() { return builder; }, limit() { return builder; }, insert(payload: Record<string, unknown>) { query.payload = payload; return builder; }, update(payload: Record<string, unknown>) { query.payload = payload; return builder; }, single() { return Promise.resolve(result()); }, maybeSingle() { return Promise.resolve(result()); }, then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return Promise.resolve(result()).then(resolve, reject); } }; return builder;
  } };
  const source = await readFile(new URL("../app/api/portal/checkin/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: { GET?: () => Promise<Response>; POST?: (request: Request) => Promise<Response> } = {};
  const actual = createRequire(import.meta.url);
  new Function("require", "exports", compiled)((id: string) => {
    if (id === "@/lib/supabase/admin") return { createAdminClient: () => admin };
    if (id === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "authenticated-user" } } }) } }) };
    if (id === "@/lib/checkin-revision") return { checkinConfigRevision };
    if (id === "@/lib/checkin-form") return forms;
    if (id === "@/lib/checkin-replies") return { loadCoachCheckinReplies: async () => ({ replies: [], unavailable: false }) };
    return actual(id);
  }, exports);
  return { get: exports.GET!, post: (responses = answers, revision = assigned ? checkinConfigRevision(assigned, "personal-template") : null) => exports.POST!(new Request("https://app.example.invalid/api/portal/checkin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ responses, config_revision: revision, client_id: "attacker" }) })), queries };
}

test("unassigned Boardroom check-ins stay pending and cannot submit a global fitness form", async () => {
  for (const config of [null, forms.buildFallbackCheckinConfig()]) {
    const f = await fixture(config);
    const state = await (await f.get()).json();
    assert.equal(state.pending, true); assert.equal(state.config, null);
    assert.equal((await f.post()).status, 409);
    assert.equal(f.queries.some(q => q.payload), false);
    assert.equal(f.queries.some(q => q.table === "form_config"), false);
  }
});

test("assigned business form validates server-side, stores full schema snapshot, and never syncs body weight", async () => {
  const config = businessConfig(), f = await fixture(config);
  assert.equal((await f.post({ ...answers, booked: "bad" })).status, 400);
  assert.equal(f.queries.some(q => q.payload), false);
  assert.equal((await f.post({ ...answers, weight: "85" } as typeof answers)).status, 200);
  const saved = f.queries.find(q => q.table === "checkins" && q.payload)?.payload;
  assert.equal(saved?.client_id, "business-client");
  assert.equal(saved?.checkin_form_id, "personal-template");
  assert.equal(saved?.mood, "okay");
  assert.deepEqual(saved?.form_config_snapshot, config);
  assert.equal((saved?.responses as Record<string, string>).weight, undefined);
  assert.equal(f.queries.some(q => q.table === "client_body_measurements"), false);
});


test("legacy global form writer rejects business configuration without touching data", async () => {
  const source = await readFile(new URL("../app/api/admin/form-config/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: { PUT?: (request: Request) => Promise<Response> } = {};
  const actual = createRequire(import.meta.url);
  new Function("require", "exports", compiled)((id: string) => {
    if (id === "@/lib/admin-auth") return { requireAdmin: async () => ({ authorized: true }) };
    if (id === "@/lib/supabase/admin") return { createAdminClient: () => { throw new Error("Unexpected database access"); } };
    if (id === "@/lib/supabase/server") return {};
    if (id === "@/lib/api-errors") return {};
    if (id === "@/lib/checkin-revision") return { checkinConfigRevision };
    if (id === "@/lib/checkin-form") return forms;
    if (id === "@/lib/consultation-form") return {};
    return actual(id);
  }, exports);
  const response = await exports.PUT!(new Request("https://app.example.invalid/api/admin/form-config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "checkin", config: businessConfig() }) }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /assigned personally/);
});


test("business forms reject stale revisions and preserve the submitted schema when editing", async () => {
  const original = businessConfig();
  const changed = forms.normalizeCheckinConfig({ ...original, progress_tracking: original.progress_tracking!.map(metric => metric.id === "booked" ? { ...metric, kind: "hours", unit: "hrs" } : metric) });
  const stale = await fixture(changed);
  assert.equal((await stale.post(answers, checkinConfigRevision(original, "personal-template"))).status, 409);
  assert.equal(stale.queries.some(query => query.payload), false);
  const editing = await fixture(changed, { id: "current-week", week_number: 4, checkin_form_id: "personal-template", form_config_snapshot: original });
  const shown = await (await editing.get()).json();
  assert.equal(shown.config.progress_tracking[0].unit, "£");
  assert.equal((await editing.post(answers, shown.configRevision)).status, 200);
  assert.deepEqual(editing.queries.find(query => query.table === "checkins" && query.payload)?.payload?.form_config_snapshot, original);
});
