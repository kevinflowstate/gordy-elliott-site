import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { generateTerraSdkToken, getTerraReferenceId } from "@/lib/terra/client";
import { normaliseTerraProvider, getTerraWidgetProvider, TERRA_CONSENT_VERSION } from "@/lib/terra/events";
const clientId = "00000000-0000-0000-0000-000000000001";
const referenceId = getTerraReferenceId(clientId);
test("SDK token proxy returns only token and public dev ID", async()=>{
 const saved=[process.env.TERRA_DEV_ID,process.env.TERRA_API_KEY];
 process.env.TERRA_DEV_ID="public-dev";process.env.TERRA_API_KEY="private-key";
 try {
  const result=await generateTerraSdkToken(referenceId,async(url,init)=>{
   const requestUrl = new URL(String(url));
   assert.equal(requestUrl.origin + requestUrl.pathname,"https://api.tryterra.co/v2/auth/generateAuthToken");
   assert.equal(requestUrl.searchParams.get("reference_id"), referenceId);
   assert.equal((init?.headers as Record<string,string>)["x-api-key"],"private-key");
   return new Response(JSON.stringify({status:"success",token:"one-use",api_key:"private-key"}));
  });
  assert.deepEqual(result,{token:"one-use",devId:"public-dev"});
  assert.ok(!JSON.stringify(result).includes("private-key"));
  await assert.rejects(generateTerraSdkToken(referenceId,async()=>new Response(JSON.stringify({status:"error",token:"ignored"}))));
  await assert.rejects(generateTerraSdkToken("someone-else",async()=>{throw new Error("Must reject before fetching");}), /client reference/);
 } finally {
  for(const [i,k] of ["TERRA_DEV_ID","TERRA_API_KEY"].entries()) {if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i]}
 }
});
test("native provider mapping and widget exclusion",()=>{
 assert.equal(normaliseTerraProvider("APPLE"),"apple");
 assert.equal(normaliseTerraProvider("HEALTH_CONNECT"),"healthconnect");
 for(const p of ["apple","healthconnect"] as const)assert.throws(()=>getTerraWidgetProvider(p),/native/);
});
test("native bridge requires the registered platform plugin",()=>{
 const bridge=fs.readFileSync("lib/native/terra-health.ts","utf8");
 assert.match(bridge,/isNativePlatform/);assert.match(bridge,/isPluginAvailable\("TerraHealth"\)/);
});

type Connection = { id: string; status: string; updated_at: string; [key: string]: unknown };
function sdkRouteFixture(options: { authenticated?: boolean; connection?: Connection; duringToken?: (set: (row: Connection) => void) => void } = {}) {
 let row = options.connection ? { ...options.connection } : null;
 const issuedFor: string[] = [];
 const admin = { from(table: string) {
  const filters: Record<string, unknown> = {};
  let forbiddenStatus: unknown;
  let values: Record<string, unknown> | null = null;
  let insert = false;
  const query = {
   select() { return query; },
   eq(key: string, value: unknown) { filters[key] = value; return query; },
   neq(key: string, value: unknown) { assert.equal(key, "status"); forbiddenStatus = value; return query; },
   update(value: Record<string, unknown>) { values = value; return query; },
   insert(value: Record<string, unknown>) { values = value; insert = true; return query; },
   async maybeSingle() {
    if (table === "client_profiles") {
     assert.equal(filters.user_id, "signed-in-user");
     return { data: { id: clientId }, error: null };
    }
    assert.equal(table, "client_wearable_connections");
    assert.equal(filters.client_id ?? values?.client_id, clientId);
    if (!values) return { data: row ? { ...row } : null, error: null };
    if (insert && row) return { data: null, error: { code: "23505" } };
    if (!insert && (!row || row.updated_at !== filters.updated_at || row.status === forbiddenStatus)) return { data: null, error: null };
    row = { ...(row || { id: "connection" }), ...values } as Connection;
    return { data: { id: row.id }, error: null };
   },
  };
  return query;
 } };
 const exports: { POST?: (request: Request) => Promise<Response> } = {};
 const source = fs.readFileSync("app/api/portal/integrations/terra/sdk-token/route.ts", "utf8");
 const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 const requireActual = createRequire(import.meta.url);
 new Function("require", "exports", compiled)((id: string) => {
  if (id === "@/lib/supabase/admin") return { createAdminClient: () => admin };
  if (id === "@/lib/supabase/server") return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: options.authenticated === false ? null : { id: "signed-in-user" } } }) } }) };
  if (id === "@/lib/terra/client") return { getTerraReferenceId, generateTerraSdkToken: async (reference: string) => { issuedFor.push(reference); options.duringToken?.((value) => { row = value; }); return { token: "single-use", devId: "public-dev" }; } };
  if (id === "@/lib/terra/events") return { TERRA_CONSENT_VERSION };
  return requireActual(id);
 }, exports);
 return { post: (body: unknown) => exports.POST!(new Request("https://app.example.test/api/portal/integrations/terra/sdk-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })), issuedFor, getRow: () => row };
}

test("SDK route authenticates and consents before issuing a token bound to the owned profile", async () => {
 const signedOut = sdkRouteFixture({ authenticated: false });
 assert.equal((await signedOut.post({ provider: "apple", consent: true })).status, 401);
 assert.deepEqual(signedOut.issuedFor, []);
 const fixture = sdkRouteFixture();
 for (const body of [null, { provider: "fitbit", consent: true }, { provider: "apple", consent: false }]) assert.equal((await fixture.post(body)).status, 400);
 assert.deepEqual(fixture.issuedFor, []);
 const response = await fixture.post({ provider: "apple", consent: true, clientId: "other-client", referenceId: "client:other-client" });
 assert.equal(response.status, 200);
 assert.equal(response.headers.get("Cache-Control"), "no-store");
 assert.deepEqual(fixture.issuedFor, [referenceId]);
 assert.equal((await response.json()).referenceId, referenceId);
 assert.equal(fixture.getRow()?.status, "pending");
});

test("SDK requests preserve connected rows and reject rows changed during token generation", async () => {
 const connected = { id: "connection", status: "connected", updated_at: "2026-10-31T08:00:00Z", last_data_at: "2026-10-31T07:59:00Z" };
 const healthy = sdkRouteFixture({ connection: connected });
 assert.equal((await healthy.post({ provider: "apple", consent: true })).status, 409);
 assert.deepEqual(healthy.issuedFor, []);
 assert.deepEqual(healthy.getRow(), connected);
 for (const existing of [undefined, { ...connected, status: "pending" }]) {
  const raced = sdkRouteFixture({ connection: existing, duringToken: set => set(connected) });
  assert.equal((await raced.post({ provider: "apple", consent: true })).status, 409);
  assert.deepEqual(raced.getRow(), connected);
 }
});

test("native-only refresh succeeds without claiming a REST request; Apple requests workouts",()=>{
 const route=fs.readFileSync("app/api/portal/integrations/terra/sync/route.ts","utf8");
 assert.match(route,/if \(!requests.length\) return NextResponse.json\(\{ accepted: false, automatic: true/);
 assert.match(fs.readFileSync("ios/App/App/TerraHealthPlugin.swift","utf8"),/customReadTypes:\[.WORKOUT_TYPE/);
});
