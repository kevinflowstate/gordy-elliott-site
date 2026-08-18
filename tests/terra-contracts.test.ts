import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  deauthenticateTerraUser,
  generateTerraWidgetSession,
  getTerraConfig,
  getTerraUsersByReferenceId,
  requestTerraData,
  requestTerraNutritionData,
  verifyTerraWebhookSignature,
} from "@/lib/terra/client";
import {
  canApplyTerraEvent,
  classifyTerraEvent,
  getTerraWidgetProvider,
  normaliseTerraProvider,
} from "@/lib/terra/events";
import { extractTerraUser, mergeDailySummary, normaliseTerraPayloads } from "@/lib/terra/normalise";
import { buildWearableInsight, hasWearableHealthSignals } from "@/lib/wearable-insights";

test("verifies Terra's timestamped HMAC signature against the raw body", () => {
  const rawBody = JSON.stringify({ type: "daily", data: [] });
  const secret = "test-signing-secret";
  const timestamp = "1723808700";
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const now = Number(timestamp) * 1000;

  assert.equal(
    verifyTerraWebhookSignature(rawBody, `t=${timestamp},v1=${signature}`, secret, now),
    true,
  );
  assert.equal(
    verifyTerraWebhookSignature(`${rawBody} `, `t=${timestamp},v1=${signature}`, secret, now),
    false,
  );
  assert.equal(
    verifyTerraWebhookSignature(rawBody, `t=${timestamp},v1=${signature}`, secret, now + 301_000),
    false,
  );
});

test("normalises each daily item in an official Terra array payload", () => {
  const summaries = normaliseTerraPayloads({
    type: "daily",
    user: { provider: "GARMIN", user_id: "terra-user", reference_id: "client:00000000-0000-0000-0000-000000000001" },
    data: [
      {
        metadata: { start_time: "2026-07-19T00:00:00Z" },
        distance_data: { summary: { steps: 8123 } },
        calories_data: { net_activity_calories: 540, total_burned_calories: 2310 },
        heart_rate_data: { summary: { resting_hr_bpm: 61, avg_hrv_rmssd: 47.5 } },
      },
      {
        metadata: { start_time: "2026-07-20T00:00:00Z" },
        distance_data: { summary: { steps: 6420 } },
      },
    ],
  });

  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].summary_date, "2026-07-19");
  assert.equal(summaries[0].steps, 8123);
  assert.equal(summaries[0].active_calories, 540);
  assert.equal(summaries[0].total_calories_burned, 2310);
  assert.equal(summaries[0].resting_hr_bpm, 61);
  assert.equal(summaries[0].hrv_ms, 47.5);
  assert.deepEqual(summaries[0].providers, ["garmin"]);
  assert.equal(summaries[1].summary_date, "2026-07-20");
});

test("normalises Terra sleep and nutrition coaching signals", () => {
  const sleep = normaliseTerraPayloads({
    type: "sleep",
    user: { provider: "OURA" },
    data: [{
      metadata: { start_time: "2026-07-20T22:00:00Z" },
      scores: { sleep: 64 },
      sleep_durations_data: { asleep: { duration_asleep_state_seconds: 19_800 } },
      heart_rate_data: { summary: { resting_hr_bpm: 67, avg_hrv_rmssd: 39 } },
    }],
  })[0];
  const nutrition = normaliseTerraPayloads({
    type: "nutrition",
    user: { provider: "MYFITNESSPAL" },
    data: [{
      metadata: { start_time: "2026-07-20T00:00:00Z" },
      summary: { macros: { calories: 1840, protein_g: 112, carbohydrates_g: 205, fat_g: 61 }, water_ml: 2100 },
    }],
  })[0];

  assert.equal(sleep.sleep_minutes, 330);
  assert.equal(sleep.sleep_score, 64);
  assert.equal(sleep.recovery_status, "watch");
  assert.equal(nutrition.nutrition_calories, 1840);
  assert.equal(nutrition.protein_g, 112);
  assert.equal(nutrition.carbs_g, 205);
  assert.equal(nutrition.fat_g, 61);
  assert.equal(nutrition.water_ml, 2100);
});

test("keeps live partial-day nutrition out of the recovery score", () => {
  const summary = {
    summary_date: "2026-08-10",
    providers: ["oura", "myfitnesspal"],
    sleep_minutes: 339,
    sleep_score: 75,
    hrv_ms: 35,
    resting_hr_bpm: 67,
    steps: 5_745,
    active_calories: 629,
    total_calories_burned: null,
    training_load: null,
    workout_count: 1,
    nutrition_calories: 68,
    protein_g: 16,
    carbs_g: 0.56,
    fat_g: 0.08,
    water_ml: null,
  };

  const withPartialNutrition = buildWearableInsight(summary);
  const withoutNutrition = buildWearableInsight({
    ...summary,
    nutrition_calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
  });

  assert.equal(withPartialNutrition.readiness_score, 76);
  assert.deepEqual(withPartialNutrition.flags, ["light_sleep"]);
  assert.deepEqual(withPartialNutrition, withoutNutrition);
});

test("rounds fractional wearable fields before integer database writes", () => {
  const summary = normaliseTerraPayloads({
    type: "sleep",
    user: { provider: "OURA" },
    data: [{
      metadata: {
        start_time: "2026-08-03T23:47:33.000000+01:00",
        end_time: "2026-08-04T04:13:03.000000+01:00",
      },
      sleep_durations_data: {
        asleep: { duration_asleep_state_seconds: 15_930 },
      },
      heart_rate_data: {
        summary: { avg_hrv_rmssd: 34, resting_hr_bpm: 67.6 },
      },
      scores: { sleep: 66.4 },
    }],
  })[0];

  assert.equal(summary.sleep_minutes, 266);
  assert.equal(summary.summary_date, "2026-08-04");
  assert.equal(summary.sleep_score, 66);
  assert.equal(summary.hrv_ms, 34);
  assert.equal(summary.resting_hr_bpm, 68);
});

test("keeps the main overnight sleep when Terra sends a later nap", () => {
  const overnight = normaliseTerraPayloads({
    type: "sleep",
    user: { provider: "OURA" },
    data: [{
      metadata: { start_time: "2026-08-08T23:59:00+01:00", end_time: "2026-08-09T08:36:00+01:00" },
      sleep_durations_data: { asleep: { duration_asleep_state_seconds: 27_420 } },
      heart_rate_data: { summary: { resting_hr_bpm: 61, avg_hrv_rmssd: 44 } },
      scores: { sleep: 86 },
    }],
  })[0];
  const nap = normaliseTerraPayloads({
    type: "sleep",
    user: { provider: "OURA" },
    data: [{
      metadata: { start_time: "2026-08-09T15:23:00+01:00", end_time: "2026-08-09T15:47:00+01:00" },
      sleep_durations_data: { asleep: { duration_asleep_state_seconds: 600 } },
      heart_rate_data: { summary: { resting_hr_bpm: 77, avg_hrv_rmssd: 17 } },
      scores: { sleep: 49 },
    }],
  })[0];

  const existing = { ...overnight, source_payload_ids: ["overnight"] } as Parameters<typeof mergeDailySummary>[0];
  const merged = mergeDailySummary(existing, nap, "nap");

  assert.equal(merged.sleep_minutes, 457);
  assert.equal(merged.sleep_score, 86);
  assert.equal(merged.hrv_ms, 44);
  assert.equal(merged.resting_hr_bpm, 61);
  assert.deepEqual(merged.source_payload_ids, ["overnight", "nap"]);
});

test("accepts a longer replacement sleep session", () => {
  const existing = {
    summary_date: "2026-08-10",
    providers: ["oura"],
    sleep_minutes: 300,
    sleep_score: 70,
    hrv_ms: 30,
    resting_hr_bpm: 68,
    source_payload_ids: ["partial"],
  } as Parameters<typeof mergeDailySummary>[0];
  const incoming = {
    ...existing,
    sleep_minutes: 420,
    sleep_score: 82,
    hrv_ms: 39,
    resting_hr_bpm: 62,
  } as Parameters<typeof mergeDailySummary>[1];

  const merged = mergeDailySummary(existing, incoming, "complete");
  assert.equal(merged.sleep_minutes, 420);
  assert.equal(merged.sleep_score, 82);
  assert.equal(merged.hrv_ms, 39);
  assert.equal(merged.resting_hr_bpm, 62);
});

test("requests MyFitnessPal nutrition data through Terra's webhook delivery", async () => {
  const originalEnv = {
    devId: process.env.TERRA_DEV_ID,
    apiKey: process.env.TERRA_API_KEY,
  };
  process.env.TERRA_DEV_ID = "testing-dev";
  process.env.TERRA_API_KEY = "testing-key";
  let requestedUrl = "";

  try {
    await requestTerraNutritionData(
      "00000000-0000-4000-8000-000000000001",
      "2026-08-09",
      "2026-08-10",
      async (input) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify({ status: "success" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const url = new URL(requestedUrl);
    assert.equal(url.pathname, "/v2/nutrition");
    assert.equal(url.searchParams.get("user_id"), "00000000-0000-4000-8000-000000000001");
    assert.equal(url.searchParams.get("start_date"), "2026-08-09");
    assert.equal(url.searchParams.get("end_date"), "2026-08-10");
    assert.equal(url.searchParams.get("to_webhook"), "true");
  } finally {
    if (originalEnv.devId === undefined) delete process.env.TERRA_DEV_ID;
    else process.env.TERRA_DEV_ID = originalEnv.devId;
    if (originalEnv.apiKey === undefined) delete process.env.TERRA_API_KEY;
    else process.env.TERRA_API_KEY = originalEnv.apiKey;
  }
});

test("requests Oura daily, sleep and activity backfill through Terra's webhook delivery", async () => {
  const originalEnv = {
    devId: process.env.TERRA_DEV_ID,
    apiKey: process.env.TERRA_API_KEY,
  };
  process.env.TERRA_DEV_ID = "testing-dev";
  process.env.TERRA_API_KEY = "testing-key";
  const requestedUrls: string[] = [];

  try {
    const fetchImpl = async (input: string | URL | Request) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    for (const dataType of ["daily", "sleep", "activity"] as const) {
      await requestTerraData(
        dataType,
        "00000000-0000-4000-8000-000000000001",
        "2026-08-12",
        "2026-08-18",
        fetchImpl,
      );
    }

    assert.deepEqual(requestedUrls.map((value) => new URL(value).pathname), [
      "/v2/daily",
      "/v2/sleep",
      "/v2/activity",
    ]);
    for (const value of requestedUrls) {
      const url = new URL(value);
      assert.equal(url.searchParams.get("start_date"), "2026-08-12");
      assert.equal(url.searchParams.get("end_date"), "2026-08-18");
      assert.equal(url.searchParams.get("to_webhook"), "true");
    }
  } finally {
    if (originalEnv.devId === undefined) delete process.env.TERRA_DEV_ID;
    else process.env.TERRA_DEV_ID = originalEnv.devId;
    if (originalEnv.apiKey === undefined) delete process.env.TERRA_API_KEY;
    else process.env.TERRA_API_KEY = originalEnv.apiKey;
  }
});

test("does not treat a nutrition-only summary as a current Capacity signal", () => {
  const base = {
    summary_date: "2026-08-18",
    providers: ["myfitnesspal"],
    sleep_minutes: null,
    sleep_score: null,
    hrv_ms: null,
    resting_hr_bpm: null,
    steps: null,
    active_calories: null,
    total_calories_burned: null,
    training_load: null,
    workout_count: null,
    nutrition_calories: 1_800,
    protein_g: 120,
    carbs_g: 180,
    fat_g: 60,
    water_ml: null,
    readiness_score: 82,
    recovery_status: "good" as const,
    flags: [],
    insight: null,
  };

  assert.equal(hasWearableHealthSignals(base), false);
  assert.equal(hasWearableHealthSignals({ ...base, providers: ["oura"], steps: 4_000 }), true);
});

test("the client refresh route requests all connected Oura health signal types", () => {
  const syncRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/portal/integrations/terra/sync/route.ts"),
    "utf8",
  );
  const connectedAppsPage = fs.readFileSync(
    path.join(process.cwd(), "app/portal/connected-apps/page.tsx"),
    "utf8",
  );

  assert.match(syncRoute, /oura:\s*\["daily", "sleep", "activity"\]/);
  assert.match(syncRoute, /myfitnesspal:\s*\["nutrition"\]/);
  assert.match(syncRoute, /Promise\.allSettled/);
  assert.doesNotMatch(syncRoute, /\.eq\("provider", "myfitnesspal"\)/);
  assert.match(connectedAppsPage, /Health refresh started\. New data can take a moment to appear/);
});

test("classifies Terra lifecycle events without treating revocations as active data", () => {
  assert.equal(classifyTerraEvent("healthcheck"), "healthcheck");
  assert.equal(classifyTerraEvent("auth", "success"), "connect");
  assert.equal(classifyTerraEvent("auth", "failed"), "error");
  assert.equal(classifyTerraEvent("user_reauth"), "connect");
  assert.equal(classifyTerraEvent("deauth"), "disconnect");
  assert.equal(classifyTerraEvent("access_revoked"), "disconnect");
  assert.equal(classifyTerraEvent("connection_error"), "error");
  assert.equal(classifyTerraEvent("google_no_datasource"), "error");
  assert.equal(classifyTerraEvent("daily"), "data");
  assert.equal(classifyTerraEvent("body"), "ignore");
  assert.equal(classifyTerraEvent("menstruation"), "ignore");
  assert.equal(classifyTerraEvent("rate_limit_hit"), "ignore");
  assert.equal(classifyTerraEvent("unexpected"), "ignore");
});

test("a disconnected connection stays terminal until the client starts a new consented session", () => {
  assert.equal(canApplyTerraEvent("data", "disconnected"), false);
  assert.equal(canApplyTerraEvent("connect", "disconnected"), false);
  assert.equal(canApplyTerraEvent("error", "disconnected"), false);
  assert.equal(canApplyTerraEvent("disconnect", "disconnected"), true);
  assert.equal(canApplyTerraEvent("connect", "pending"), true);
  assert.equal(canApplyTerraEvent("data", "pending"), true);
  assert.equal(canApplyTerraEvent("data", "connected"), true);
});

test("limits the web widget to approved providers and recognises WHOOP", () => {
  assert.equal(normaliseTerraProvider("GARMIN"), "garmin");
  assert.equal(normaliseTerraProvider("My_Fitness_Pal"), "myfitnesspal");
  assert.equal(normaliseTerraProvider("WHOOP"), "whoop");
  assert.equal(getTerraWidgetProvider("fitbit"), "FITBIT");
  assert.equal(getTerraWidgetProvider("whoop"), "WHOOP");
});

test("keeps WHOOP hidden until the explicit provider gate is enabled", () => {
  const original = process.env.TERRA_WHOOP_ENABLED;
  const originalDevId = process.env.TERRA_DEV_ID;
  const originalApiKey = process.env.TERRA_API_KEY;
  try {
    process.env.TERRA_DEV_ID = "test-dev";
    process.env.TERRA_API_KEY = "test-key";
    delete process.env.TERRA_WHOOP_ENABLED;
    assert.equal(getTerraConfig().whoopEnabled, false);
    process.env.TERRA_WHOOP_ENABLED = "true";
    assert.equal(getTerraConfig().whoopEnabled, true);
  } finally {
    if (original === undefined) delete process.env.TERRA_WHOOP_ENABLED; else process.env.TERRA_WHOOP_ENABLED = original;
    if (originalDevId === undefined) delete process.env.TERRA_DEV_ID; else process.env.TERRA_DEV_ID = originalDevId;
    if (originalApiKey === undefined) delete process.env.TERRA_API_KEY; else process.env.TERRA_API_KEY = originalApiKey;
  }
});

test("normalises WHOOP sleep and strain through the shared Terra contract", () => {
  const sleep = normaliseTerraPayloads({
    type: "sleep",
    user: { provider: "WHOOP" },
    data: [{
      metadata: { start_time: "2026-08-15T23:00:00Z", end_time: "2026-08-16T07:00:00Z" },
      scores: { sleep: 82 },
      sleep_durations_data: { asleep: { duration_asleep_state_seconds: 25_200 } },
      heart_rate_data: { summary: { resting_hr_bpm: 55, avg_hrv_rmssd: 48 } },
    }],
  })[0];
  const daily = normaliseTerraPayloads({
    type: "daily",
    user: { provider: "WHOOP" },
    data: [{
      metadata: { start_time: "2026-08-16T00:00:00Z" },
      strain_data: { strain_level: 11.4 },
    }],
  })[0];

  assert.deepEqual(sleep.providers, ["whoop"]);
  assert.equal(sleep.sleep_minutes, 420);
  assert.equal(sleep.hrv_ms, 48);
  assert.equal(daily.training_load, 11.4);
});

test("uses the new Terra user when a provider account is reauthenticated", () => {
  const user = extractTerraUser({
    type: "user_reauth",
    old_user: { user_id: "old-terra-user" },
    new_user: {
      user_id: "new-terra-user",
      provider: "OURA",
      reference_id: "client:00000000-0000-0000-0000-000000000001",
    },
  });

  assert.equal(user.terraUserId, "new-terra-user");
  assert.equal(user.oldTerraUserId, "old-terra-user");
  assert.equal(user.provider, "oura");
});

test("generates a provider-scoped Terra widget session", async () => {
  const originalEnv = {
    devId: process.env.TERRA_DEV_ID,
    apiKey: process.env.TERRA_API_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  };
  process.env.TERRA_DEV_ID = "testing-dev";
  process.env.TERRA_API_KEY = "testing-key";
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.test";
  let requestBody: Record<string, unknown> = {};

  try {
    const session = await generateTerraWidgetSession(
      "00000000-0000-0000-0000-000000000001",
      "oura",
      {
        fetchImpl: async (_input, init) => {
          requestBody = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({
            status: "success",
            url: "https://widget.tryterra.co/session/test",
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        },
      },
    );

    assert.equal(requestBody?.providers, "OURA");
    assert.equal(requestBody?.reference_id, "client:00000000-0000-0000-0000-000000000001");
    assert.equal(requestBody?.auth_success_redirect_url, "https://app.example.test/portal/connected-apps?provider=oura&terra=success");
    assert.equal(session.url, "https://widget.tryterra.co/session/test");
  } finally {
    if (originalEnv.devId === undefined) delete process.env.TERRA_DEV_ID;
    else process.env.TERRA_DEV_ID = originalEnv.devId;
    if (originalEnv.apiKey === undefined) delete process.env.TERRA_API_KEY;
    else process.env.TERRA_API_KEY = originalEnv.apiKey;
    if (originalEnv.siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalEnv.siteUrl;
  }
});

test("returns native Terra sessions through the installed app URL bridge", async () => {
  const originalEnv = {
    devId: process.env.TERRA_DEV_ID,
    apiKey: process.env.TERRA_API_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  };
  process.env.TERRA_DEV_ID = "testing-dev";
  process.env.TERRA_API_KEY = "testing-key";
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.test";
  let requestBody: Record<string, unknown> = {};

  try {
    await generateTerraWidgetSession(
      "00000000-0000-0000-0000-000000000001",
      "myfitnesspal",
      {
        nativeReturn: true,
        fetchImpl: async (_input, init) => {
          requestBody = JSON.parse(String(init?.body));
          return new Response(JSON.stringify({
            status: "success",
            url: "https://widget.tryterra.co/session/test",
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        },
      },
    );

    assert.equal(
      requestBody?.auth_success_redirect_url,
      "https://app.example.test/connected-app-return?provider=myfitnesspal&status=success",
    );
    assert.equal(
      requestBody?.auth_failure_redirect_url,
      "https://app.example.test/connected-app-return?provider=myfitnesspal&status=failed",
    );
  } finally {
    if (originalEnv.devId === undefined) delete process.env.TERRA_DEV_ID;
    else process.env.TERRA_DEV_ID = originalEnv.devId;
    if (originalEnv.apiKey === undefined) delete process.env.TERRA_API_KEY;
    else process.env.TERRA_API_KEY = originalEnv.apiKey;
    if (originalEnv.siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalEnv.siteUrl;
  }
});

test("deauthenticates the Terra user before a connection is removed locally", async () => {
  const originalEnv = {
    devId: process.env.TERRA_DEV_ID,
    apiKey: process.env.TERRA_API_KEY,
  };
  process.env.TERRA_DEV_ID = "testing-dev";
  process.env.TERRA_API_KEY = "testing-key";
  let requestedUrl = "";
  let requestedMethod = "";

  try {
    const result = await deauthenticateTerraUser(
      "23dc2540-7139-44c6-8158-f81196e2cf2e",
      async (input, init) => {
        requestedUrl = String(input);
        requestedMethod = String(init?.method);
        return new Response(JSON.stringify({ status: "success" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    assert.equal(requestedMethod, "DELETE");
    assert.match(requestedUrl, /deauthenticateUser\?user_id=23dc2540-7139-44c6-8158-f81196e2cf2e$/);
    assert.equal(result.status, "success");
  } finally {
    if (originalEnv.devId === undefined) delete process.env.TERRA_DEV_ID;
    else process.env.TERRA_DEV_ID = originalEnv.devId;
    if (originalEnv.apiKey === undefined) delete process.env.TERRA_API_KEY;
    else process.env.TERRA_API_KEY = originalEnv.apiKey;
  }
});

test("verifies a Terra connection by internal reference id without trusting redirect parameters", async () => {
  const originalEnv = {
    devId: process.env.TERRA_DEV_ID,
    apiKey: process.env.TERRA_API_KEY,
  };
  process.env.TERRA_DEV_ID = "testing-dev";
  process.env.TERRA_API_KEY = "testing-key";
  let requestedUrl = "";

  try {
    const users = await getTerraUsersByReferenceId(
      "client:00000000-0000-0000-0000-000000000001",
      async (input) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify({
          status: "success",
          user: {
            user_id: "23dc2540-7139-44c6-8158-f81196e2cf2e",
            provider: "MYFITNESSPAL",
            reference_id: "client:00000000-0000-0000-0000-000000000001",
            active: true,
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    );

    assert.match(requestedUrl, /userInfo\?reference_id=client%3A00000000-0000-0000-0000-000000000001$/);
    assert.equal(users.length, 1);
    assert.equal(users[0].provider, "MYFITNESSPAL");
  } finally {
    if (originalEnv.devId === undefined) delete process.env.TERRA_DEV_ID;
    else process.env.TERRA_DEV_ID = originalEnv.devId;
    if (originalEnv.apiKey === undefined) delete process.env.TERRA_API_KEY;
    else process.env.TERRA_API_KEY = originalEnv.apiKey;
  }
});

test("Terra hardening migration records explicit consent and indexes raw-event retention", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260803134739_harden_terra_consent_and_retention.sql"),
    "utf8",
  );

  assert.match(migration, /ADD COLUMN IF NOT EXISTS consent_version TEXT/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ/i);
  assert.match(migration, /client_wearable_events\(received_at\)/i);
});

test("Terra connection consent names the processor and records the revised notice version", () => {
  const connectedAppsPage = fs.readFileSync(
    path.join(process.cwd(), "app/portal/connected-apps/page.tsx"),
    "utf8",
  );
  const connectionsPanel = fs.readFileSync(
    path.join(process.cwd(), "components/portal/WearableConnectionsPanel.tsx"),
    "utf8",
  );
  const healthOverview = fs.readFileSync(
    path.join(process.cwd(), "components/portal/HealthCapacityOverview.tsx"),
    "utf8",
  );
  const sessionRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/portal/integrations/terra/session/route.ts"),
    "utf8",
  );
  const terraEvents = fs.readFileSync(
    path.join(process.cwd(), "lib/terra/events.ts"),
    "utf8",
  );
  const privacyPage = fs.readFileSync(
    path.join(process.cwd(), "app/privacy/page.tsx"),
    "utf8",
  );
  const globalStyles = fs.readFileSync(
    path.join(process.cwd(), "app/globals.css"),
    "utf8",
  );

  assert.match(connectionsPanel, /Terra securely passes the health categories you approve to AT CAPACITY/);
  assert.match(connectionsPanel, /https:\/\/tryterra\.co\/end-user-privacy/);
  assert.match(connectionsPanel, /I consent to AT CAPACITY receiving health data/);
  assert.match(connectionsPanel, /!consentAccepted/);
  assert.match(connectedAppsPage, /Browser\.addListener\("browserFinished"/);
  assert.match(healthOverview, /connection\.provider === "myfitnesspal"/);
  assert.match(healthOverview, /summary\.providers\.includes\("myfitnesspal"\)/);
  assert.match(healthOverview, /Capacity score/);
  assert.match(healthOverview, /label: "HRV"/);
  assert.match(healthOverview, /Waiting for today&apos;s data/);
  assert.match(healthOverview, /An older score will never be presented as today&apos;s result/);
  assert.match(globalStyles, /\.portal-main\s*\{[\s\S]*?env\(safe-area-inset-top/);
  assert.doesNotMatch(globalStyles, /\.native-app \.portal-main\s*\{[\s\S]*?padding-top:\s*1rem/);
  assert.match(sessionRoute, /TERRA_CONSENT_VERSION/);
  assert.match(terraEvents, /TERRA_CONSENT_VERSION = "wearable_connection_v2"/);
  assert.match(sessionRoute, /export async function PATCH/);
  assert.match(sessionRoute, /\.eq\("status", "pending"\)/);
  assert.match(privacyPage, /https:\/\/tryterra\.co\/end-user-privacy/);
});
