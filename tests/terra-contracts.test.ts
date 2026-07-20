import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { verifyTerraWebhookSignature } from "@/lib/terra/client";
import { normaliseTerraPayloads } from "@/lib/terra/normalise";

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
