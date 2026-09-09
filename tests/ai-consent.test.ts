import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { AI_CONSENT_VERSION } from "../lib/ai-consent";
import { getClientAIConsent, requireClientAIConsent } from "../lib/ai-consent-server";

function consentDatabase(row: unknown, status = 200) {
  const requests: URL[] = [];
  const client = createClient("https://consent-test.supabase.co", "fixture-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      requests.push(new URL(String(input)));
      return new Response(JSON.stringify(row), { status, headers: { "Content-Type": "application/json" } });
    } },
  });
  return { client, requests };
}

test("AI sharing requires an explicit current grant and scopes reads to the requested client", async () => {
  for (const row of [null, { granted: false, consent_version: AI_CONSENT_VERSION }, { granted: true, consent_version: "old-version" }]) {
    const db = consentDatabase(row);
    const response = await requireClientAIConsent(db.client, "client-a");
    assert.equal(response?.status, 403);
    assert.equal((await response!.json()).code, "AI_CONSENT_REQUIRED");
    assert.equal(db.requests[0].searchParams.get("client_id"), "eq.client-a");
  }
  const db = consentDatabase({ granted: true, consent_version: AI_CONSENT_VERSION, created_at: "2026-09-09T12:00:00Z" });
  assert.equal(await requireClientAIConsent(db.client, "client-a"), null);
});

test("withdrawal is checked afresh on the next request and database errors fail closed", async () => {
  let granted = true;
  const client = createClient("https://consent-test.supabase.co", "fixture-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async () => new Response(JSON.stringify({ granted, consent_version: AI_CONSENT_VERSION }), { headers: { "Content-Type": "application/json" } }) },
  });
  assert.equal((await getClientAIConsent(client, "client-a")).granted, true);
  granted = false;
  assert.equal((await requireClientAIConsent(client, "client-a"))?.status, 403);
  const unavailable = consentDatabase({ message: "database unavailable" }, 503);
  assert.equal((await requireClientAIConsent(unavailable.client, "client-a"))?.status, 503);
});

test("all client-bearing AI entry points enforce consent before external processing", async () => {
  for (const path of ["app/api/portal/ai/route.ts", "app/api/admin/client-coaching-notes/extract/route.ts"]) {
    const source = await readFile(path, "utf8");
    const guard = source.indexOf("await requireClientAIConsent(");
    assert.ok(guard > 0, path);
    const external = source.search(/await (?:fetch\(|getShiftBrainContextResult\()/);
    assert.ok(external > guard, path);
  }
  const consultation = await readFile("app/api/portal/consultation/route.ts", "utf8");
  assert.match(consultation, /aiConsent\?\.granted[\s\S]*extractConsultationSummary[\s\S]*buildFallbackSummary/);
  const admin = await readFile("app/api/admin/ai/route.ts", "utf8");
  assert.match(admin, /\.in\("id", consentingClientIds\)/);
  assert.match(admin, /consentScope === currentConsentScope && Array\.isArray\(history\) \? history : \[\]/);
  const endpoint = await readFile("app/api/portal/ai/consent/route.ts", "utf8");
  assert.match(endpoint, /client_id: ctx\.profile\.id, user_id: ctx\.user\.id/);
  assert.match(endpoint, /body\.version !== AI_CONSENT_VERSION/);
});

test("OpenRouter only receives client information through the disclosed OpenAI provider", async () => {
  for (const path of ["lib/brain-retrieval.ts", "app/api/portal/consultation/route.ts"]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /only: \["openai"\], allow_fallbacks: false/);
    assert.match(source, /startsWith\("openai\/"\)/);
  }
});
