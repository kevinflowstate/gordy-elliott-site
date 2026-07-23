import assert from "node:assert/strict";
import test from "node:test";
import {
  averageWearableMetrics,
  compareCapacityMetrics,
  hasCapacityMetric,
  parseBoundedCapacityMetric,
  type CapacityMetrics,
} from "../lib/capacity-baseline";
import { defaultBaselinePeriod } from "../lib/capacity-baseline-server";

const empty: CapacityMetrics = {
  hrv_ms: null,
  resting_hr_bpm: null,
  sleep_minutes: null,
  sleep_score: null,
  weight_kg: null,
  body_fat_percentage: null,
  waist_cm: null,
};

test("wearable baseline averages ignore missing metrics without turning them into zero", () => {
  const average = averageWearableMetrics([
    { hrv_ms: 40, resting_hr_bpm: 65, sleep_minutes: 390, sleep_score: 70 },
    { hrv_ms: null, resting_hr_bpm: 61, sleep_minutes: null, sleep_score: 76 },
  ]);

  assert.deepEqual(average, {
    hrv_ms: 40,
    resting_hr_bpm: 63,
    sleep_minutes: 390,
    sleep_score: 73,
    wearable_source_days: 2,
  });
});

test("comparison reports direction but does not invent guarantee thresholds", () => {
  const result = compareCapacityMetrics(
    { ...empty, hrv_ms: 40, resting_hr_bpm: 70, sleep_minutes: 360 },
    { ...empty, hrv_ms: 45, resting_hr_bpm: 66, sleep_minutes: 390 },
  );

  assert.equal(result.hrv_ms.direction, "improved");
  assert.equal(result.resting_hr_bpm.direction, "improved");
  assert.equal(result.sleep_minutes.delta, 30);
  assert.equal(result.body_fat_percentage.direction, "missing");
  assert.equal("passed" in result.hrv_ms, false);
});

test("a baseline requires at least one real metric", () => {
  assert.equal(hasCapacityMetric(empty), false);
  assert.equal(hasCapacityMetric({ ...empty, waist_cm: 92 }), true);
});

test("a future or invalid client start date never creates a reversed baseline window", () => {
  const today = new Date("2026-07-23T15:00:00.000Z");
  assert.deepEqual(defaultBaselinePeriod("2030-01-01", today), {
    periodStart: "2026-07-23",
    periodEnd: "2026-07-23",
  });
  assert.deepEqual(defaultBaselinePeriod("not-a-date", today), {
    periodStart: "2026-07-23",
    periodEnd: "2026-07-23",
  });
  assert.deepEqual(defaultBaselinePeriod(null, today), {
    periodStart: "2026-07-23",
    periodEnd: "2026-07-23",
  });
});

test("manual and stored body metrics use the same baseline bounds", () => {
  assert.equal(parseBoundedCapacityMetric(20, 20, 400), 20);
  assert.equal(parseBoundedCapacityMetric("89.456", 20, 400), 89.46);
  assert.equal(parseBoundedCapacityMetric(null, 20, 400), null);
  assert.equal(parseBoundedCapacityMetric(19.9, 20, 400), undefined);
  assert.equal(parseBoundedCapacityMetric(401, 20, 400), undefined);
});
