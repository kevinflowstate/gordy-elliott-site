import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  deauthenticateTerraUser,
  generateTerraWidgetSession,
  verifyTerraWebhookSignature,
} from "@/lib/terra/client";
import {
  canApplyTerraEvent,
  classifyTerraEvent,
  getTerraWidgetProvider,
  normaliseTerraProvider,
} from "@/lib/terra/events";
import { extractTerraUser, normaliseTerraPayloads } from "@/lib/terra/normalise";

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

test("limits the web widget to the approved launch provider", () => {
  assert.equal(normaliseTerraProvider("GARMIN"), "garmin");
  assert.equal(normaliseTerraProvider("My_Fitness_Pal"), "myfitnesspal");
  assert.equal(normaliseTerraProvider("WHOOP"), null);
  assert.equal(getTerraWidgetProvider("fitbit"), "FITBIT");
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

test("Terra hardening migration records explicit consent and indexes raw-event retention", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260803120000_harden_terra_consent_and_retention.sql"),
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
  const sessionRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/portal/integrations/terra/session/route.ts"),
    "utf8",
  );
  const privacyPage = fs.readFileSync(
    path.join(process.cwd(), "app/privacy/page.tsx"),
    "utf8",
  );

  assert.match(connectedAppsPage, /through Terra,\s*our connection provider/);
  assert.match(connectedAppsPage, /https:\/\/tryterra\.co\/end-user-privacy/);
  assert.match(connectedAppsPage, /I explicitly consent to this health-data use/);
  assert.match(sessionRoute, /TERRA_CONSENT_VERSION = "wearable_connection_v2"/);
  assert.match(sessionRoute, /export async function PATCH/);
  assert.match(sessionRoute, /\.eq\("status", "pending"\)/);
  assert.match(privacyPage, /https:\/\/tryterra\.co\/end-user-privacy/);
});
