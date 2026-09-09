import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HealthCapacityOverview from "@/components/portal/HealthCapacityOverview";
import WearableConnectionsPanel from "@/components/portal/WearableConnectionsPanel";
import { dateKeyInTimeZone } from "@/lib/founder-dashboard";
import { normaliseTerraPayloads, mergeDailySummary } from "@/lib/terra/normalise";
import { buildWearableInsight, wearableReadinessScore, type WearableDailySummary } from "@/lib/wearable-insights";

const date = dateKeyInTimeZone(new Date(), "Europe/London");
test("disabled WHOOP disappears from connection actions, logos, counts and latest signal", () => {
  const renderPanel = (whoopAvailable: boolean) => renderToStaticMarkup(
    <WearableConnectionsPanel
      connections={[{ id: "demo", client_id: "demo", provider: "whoop", terra_user_id: null, reference_id: "demo", status: "connected", last_sync_at: "2026-09-08T12:00:00Z", connected_at: null, disconnected_at: null }]}
      consentAccepted available mockMode={false} whoopAvailable={whoopAvailable}
      connecting={null} disconnecting={null} onConsentChange={() => {}} onConnect={() => {}} onDisconnect={() => {}} onBack={() => {}}
    />
  );
  const hidden = renderPanel(false);
  assert.doesNotMatch(hidden, /WHOOP|Latest signal|Disconnect<\/button>/);
  assert.match(hidden, /No services connected/);
  for (const provider of ["Garmin", "Oura", "Fitbit", "MyFitnessPal"]) assert.match(hidden, new RegExp(provider));
  const enabled = renderPanel(true);
  assert.match(enabled, /WHOOP/);
  assert.match(enabled, /1 service connected/);
});
const daily = () => normaliseTerraPayloads({ type: "daily", user: { provider: "WHOOP" }, data: [{ metadata: { start_time: date }, strain_data: { strain_level: 11.4 } }] })[0];
// Expected shared Terra contract, NOT a populated production WHOOP sample.
const sleep = () => normaliseTerraPayloads({ type: "sleep", user: { provider: "WHOOP" }, data: [{ metadata: { start_time: `${date}T00:00:00+01:00`, end_time: `${date}T07:00:00+01:00` }, sleep_durations_data: { asleep: { duration_asleep_state_seconds: 25200 } }, scores: { sleep: 82 }, heart_rate_data: { summary: { avg_hrv_rmssd: 48, resting_hr_bpm: 55 } } }] })[0];

test("actual redacted WHOOP success envelopes with empty data never invent a workout, date or score", () => {
  const events = JSON.parse(fs.readFileSync("tests/fixtures/whoop-empty-production.json", "utf8"));
  for (const event of events) assert.deepEqual(normaliseTerraPayloads(event), [], event.type);
  for (const data of [null, {}, [null], [{}], undefined]) {
    assert.deepEqual(normaliseTerraPayloads({ type: "activity", user: { provider: "WHOOP" }, data }), []);
  }
  assert.deepEqual(normaliseTerraPayloads({ type: "activity", data: [{ calories: 300 }] }), [], "Undated data must not acquire receipt date");
});

test("activity and isolated heart data keep capacity unavailable, including legacy stored 82", () => {
  const partial = { ...daily(), readiness_score: 82, recovery_status: "good" as const, insight: "Recovery signals look steady." };
  assert.equal(wearableReadinessScore(partial), null);
  for (const input of [partial, { ...partial, hrv_ms: 48, resting_hr_bpm: 55 }]) {
    const insight = buildWearableInsight(input);
    assert.equal(insight.readiness_score, null);
    assert.deepEqual(insight.flags, ["recovery_data_unavailable"]);
    assert.doesNotMatch(insight.insight || "", /look steady/);
  }
});

test("sleep and daily merge in either order; sparse and empty events preserve richer data", () => {
  for (const sequence of [[sleep(), daily()], [daily(), sleep()]]) {
    let summary: WearableDailySummary | null = null;
    for (const [i, input] of sequence.entries()) summary = { ...input, ...mergeDailySummary(summary, input, `event-${i}`) } as WearableDailySummary;
    assert.equal(summary?.sleep_minutes, 420);
    assert.equal(summary?.sleep_score, 82);
    assert.equal(summary?.hrv_ms, 48);
    assert.equal(summary?.resting_hr_bpm, 55);
    assert.equal(summary?.training_load, 11.4);
    assert.notEqual(summary?.readiness_score, null);
    const sparse = { ...daily(), training_load: null, steps: 0 };
    const result = mergeDailySummary(summary, sparse, "sparse");
    assert.equal(result.sleep_minutes, 420);
    assert.equal(result.sleep_score, 82);
    assert.equal(result.training_load, 11.4);
    assert.equal(result.steps, 0);
  }
});

test("sleep uses London wake date across UTC midnight and both DST transitions", () => {
  for (const [start, end, expected] of [
    ["2026-09-04T18:00:00Z", "2026-09-04T23:30:00Z", "2026-09-05"],
    ["2026-03-28T23:00:00Z", "2026-03-29T06:00:00Z", "2026-03-29"],
    ["2026-10-24T22:00:00Z", "2026-10-25T07:00:00Z", "2026-10-25"],
    ["2026-09-04T23:00:00+01:00", "2026-09-05T07:00:00+01:00", "2026-09-05"],
  ]) {
    const record = normaliseTerraPayloads({ type: "sleep", user: { provider: "WHOOP" }, data: [{ metadata: { start_time: start, end_time: end }, scores: { sleep: 80 } }] })[0];
    assert.equal(record.summary_date, expected);
  }
});

test("pending/unscored sleep has no recovery estimate", () => {
  assert.deepEqual(normaliseTerraPayloads({ type: "sleep", user: { provider: "WHOOP" }, data: [{ metadata: { start_time: date }, scores: { sleep: null }, sleep_durations_data: { asleep: { duration_asleep_state_seconds: null } } }] }), []);
});

function render(summaries: WearableDailySummary[]) {
  return renderToStaticMarkup(<HealthCapacityOverview summaries={summaries} connections={[{id:"demo",client_id:"demo",provider:"whoop",terra_user_id:null,reference_id:"demo",status:"connected",last_sync_at:null,connected_at:null,disconnected_at:null}]} loading={false} refreshing={false} onRefresh={() => {}} onManageConnections={() => {}} />);
}

test("rendered WHOOP cards suppress legacy false recovery; populated sleep restores capacity", () => {
  const html = render([{ ...daily(), readiness_score: 82, recovery_status: "good", insight: "Recovery signals look steady." }]);
  assert.match(html, /Your recovery picture is incomplete/);
  assert.match(html, /Recovery data unavailable/);
  assert.match(html, /No data/);
  assert.doesNotMatch(html, /You have room to perform|Recovery looks steady|Recovery signals look steady/);
  assert.match(render([sleep()]), /You have room to perform/);
  const empty = render([]);
  assert.match(empty, /Waiting for health data/);
  assert.match(empty, /Your wearable is connected/);
});

test("signed production-shaped empty events are stored without writing daily summaries", async () => {
  const { POST } = await import("@/app/api/integrations/terra/webhook/route");
  const { createHmac } = await import("node:crypto");
  const originalFetch = globalThis.fetch;
  const originalEnv = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, secret: process.env.TERRA_WEBHOOK_SIGNING_SECRET };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://local-diagnostic.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-service-key";
  process.env.TERRA_WEBHOOK_SIGNING_SECRET = "local-test-signature";
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "local-diagnostic.supabase.co", "No live requests allowed");
    const method = init?.method || "GET";
    calls.push(`${method} ${url.pathname}`);
    if (url.pathname.endsWith("client_wearable_connections") && method === "GET") {
      assert.equal(url.searchParams.get("client_id"), "eq.00000000-0000-4000-8000-000000000002");
      assert.equal(url.searchParams.get("provider"), "eq.whoop");
      return Response.json([{ id: "connection", client_id: "00000000-0000-4000-8000-000000000002", provider: "whoop", terra_user_id: "00000000-0000-4000-8000-000000000001", reference_id: "client:00000000-0000-4000-8000-000000000002", status: "connected", consented_at: "2026-09-03T11:52:03Z", scopes: [], last_sync_at: new Date().toISOString() }]);
    }
    if (url.pathname.endsWith("client_wearable_events") && method === "POST") return Response.json({ id: "event" });
    throw new Error(`Unexpected database operation: ${method} ${url.pathname}`);
  };
  try {
    const events = JSON.parse(fs.readFileSync("tests/fixtures/whoop-empty-production.json", "utf8"));
    for (const event of events) {
      const body = JSON.stringify(event);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac("sha256", "local-test-signature").update(`${timestamp}.${body}`).digest("hex");
      const response = await POST(new Request("https://app.example.test/api/integrations/terra/webhook", { method: "POST", body, headers: { "terra-signature": `t=${timestamp},v1=${signature}` } }));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).summaryUpdated, false);
    }
    assert.equal(calls.filter(x => x.endsWith("client_wearable_events")).length, 3);
    assert.equal(calls.some(x => x.includes("daily_summaries")), false);
    const count = calls.length;
    assert.equal((await POST(new Request("https://app.example.test/api/integrations/terra/webhook", { method: "POST", body: JSON.stringify(events[0]) }))).status, 401);
    assert.equal(calls.length, count);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: originalEnv.url, SUPABASE_SERVICE_ROLE_KEY: originalEnv.key, TERRA_WEBHOOK_SIGNING_SECRET: originalEnv.secret })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("missing recovery does not turn into a lower-recovery training warning", async () => {
  const { getImmediateTodayPriority } = await import("@/lib/today-priority");
  assert.equal(getImmediateTodayPriority({ calendarEvents: [], wearableSummary: daily(), todayTraining: "Lower body", now: new Date() }), null);
});
