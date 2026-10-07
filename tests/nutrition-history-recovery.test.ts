import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { addNutritionDays, buildNutritionLogDays, isDateKey, nutritionWeek, nutritionWeekCount, nutritionTargetsForDate } from "@/lib/nutrition-history";
import { buildWearableInsight, formatWearableSummaryForPrompt, hasSufficientRecoverySignals, sanitizeWearableRecovery, type WearableDailySummary } from "@/lib/wearable-insights";
import { normaliseTerraPayloads, mergeDailySummary } from "@/lib/terra/normalise";
import { isCurrentWearableSummary } from "@/lib/founder-dashboard";
import { getImmediateTodayPriority } from "@/lib/today-priority";

const nutrition = normaliseTerraPayloads({ type: "nutrition", user: { provider: "MYFITNESSPAL" }, data: [{ metadata: { start_time: "2026-10-07T00:00:00+01:00" }, summary: { macros: { calories: 1800, protein_g: 120, carbohydrates_g: 190, fat_g: 50 } } }] })[0];

test("nutrition, activity, missing and zero heart placeholders cannot create recovery", () => {
  for (const extra of [{}, { providers: ["oura"], steps: 12000, training_load: 100, workout_count: 3 }, { sleep_minutes: 0, hrv_ms: 0, resting_hr_bpm: 0 }, { sleep_minutes: 420, sleep_score: 90 }, { hrv_ms: 40 }, { hrv_ms: Infinity, resting_hr_bpm: 60 }, { hrv_ms: NaN, sleep_score: 101, sleep_minutes: -1 }]) {
    const summary = { ...nutrition, ...extra };
    assert.equal(hasSufficientRecoverySignals(summary), false);
    assert.deepEqual(buildWearableInsight(summary), { readiness_score: null, recovery_status: "unknown", flags: [], insight: null });
  }
  assert.equal(nutrition.readiness_score, null);
  assert.equal(nutrition.recovery_status, "unknown");
  const real = { ...nutrition, providers: ["oura"], hrv_ms: 40, resting_hr_bpm: 62 };
  assert.equal(buildWearableInsight(real).recovery_status, "good");
  const stale = { ...real, ...buildWearableInsight(real), summary_date: "2026-10-06" };
  assert.equal(getImmediateTodayPriority({ calendarEvents: [], wearableSummary: { ...stale, recovery_status: "reduce_intensity" }, todayTraining: "Session", now: new Date("2026-10-07T12:00:00Z") }), null);
});

test("actual recovery survives nutrition merges and valid zero sleep score is a warning", () => {
  const base = { ...nutrition, providers: ["oura"], sleep_minutes: 420, sleep_score: 0, resting_hr_bpm: 62, hrv_ms: 40 };
  const actual = { ...base, ...buildWearableInsight(base) };
  assert.equal(actual.recovery_status, "watch");
  assert.equal(actual.readiness_score, 64);
  const merged = mergeDailySummary(actual, { ...nutrition, nutrition_calories: 0, protein_g: 0 }, "event1");
  assert.equal(merged.readiness_score, actual.readiness_score);
  assert.equal(merged.sleep_minutes, 420);
  assert.equal(merged.protein_g, 0);
  assert.equal(merged.nutrition_calories, 0);
});

test("MFP totals replace other feed totals and cannot be overwritten or added by other providers", () => {
  const existing = { ...nutrition, providers: ["myfitnesspal", "oura"] };
  const other = { ...nutrition, providers: ["oura"], nutrition_calories: 500, protein_g: 20, steps: 10000 };
  const merged = mergeDailySummary(existing, other, "event2");
  assert.equal(merged.nutrition_calories, 1800);
  assert.equal(merged.protein_g, 120);
  assert.equal(merged.steps, 10000);
  const mfp = mergeDailySummary(other, { ...nutrition, protein_g: null }, "event3");
  assert.equal(mfp.nutrition_calories, 1800);
  assert.equal(mfp.protein_g, null);
});

test("legacy unsupported scores are removed from prompts and immediate training advice", () => {
  const legacy: WearableDailySummary = { ...nutrition, readiness_score: 82, recovery_status: "reduce_intensity", flags: ["poor_sleep"], insight: "Recovery looks steady" };
  const safe = sanitizeWearableRecovery(legacy);
  assert.equal(safe.readiness_score, null);
  assert.equal(safe.recovery_status, "unknown");
  assert.equal(safe.protein_g, 120);
  assert.equal(legacy.readiness_score, 82); // read sanitization does not mutate stored/raw input
  const prompt = JSON.parse(formatWearableSummaryForPrompt(legacy));
  assert.equal(prompt.recovery_status, "unknown");
  assert.equal(prompt.nutrition.calories, 1800);
  assert.equal(getImmediateTodayPriority({ calendarEvents: [], wearableSummary: legacy, todayTraining: "Session", now: new Date("2026-10-07T12:00:00Z") }), null);
  assert.equal(isCurrentWearableSummary("2026-08-01", new Date("2026-07-31T23:30:00Z")), true);
});

test("week bounds, labels and columns share Monday through Sunday across BST and both DST changes", () => {
  const previousTZ = process.env.TZ;
  try {
    for (const tz of ["UTC", "Europe/London", "America/Los_Angeles"]) {
      process.env.TZ = tz;
      for (const [start, monday, sunday] of [["2026-10-06", "2026-10-05", "2026-10-11"], ["2026-03-29", "2026-03-23", "2026-03-29"], ["2026-10-25", "2026-10-19", "2026-10-25"], ["2026-01-02", "2025-12-29", "2026-01-04"]]) {
        const week = nutritionWeek(start, 1);
        assert.equal(week.from, monday);
        assert.equal(week.to, sunday);
        assert.equal(week.dates[0], week.from);
        assert.equal(week.dates.at(-1), week.to);
        assert.equal(week.dates.length, 7);
        assert.equal(nutritionWeek(start, 2).from, addNutritionDays(monday, 7));
      }
    }
  } finally {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  }
  assert.equal(nutritionWeekCount("2026-10-06", "2026-10-12"), 2);
  assert.equal(isDateKey("2026-02-30"), false);
  assert.equal(isDateKey("2026-02-28"), true);
});

const plans = [
  { id: "old", name: "Previous", status: "archived", start_date: "2026-09-01", target_calories: 1900, target_protein_g: 100, target_carbs_g: 210, target_fat_g: 60 },
  { id: "new", name: "Current", status: "active", start_date: "2026-10-06", target_calories: 2100, target_protein_g: 130, target_carbs_g: null, target_fat_g: 0 },
];
test("historical imports preserve missing and zero values and use the applicable recorded assignment", () => {
  const days = buildNutritionLogDays(["2026-10-05", "2026-10-06", "2026-10-07"], [
    { ...nutrition, summary_date: "2026-10-05" },
    { ...nutrition, summary_date: "2026-10-07", nutrition_calories: 0, protein_g: null },
  ], plans, "2026-10-07");
  assert.equal(days[0].targets?.calories, 1900);
  assert.equal(days[1].targets?.calories, 2100);
  assert.equal(days[1].imported, null);
  assert.equal(days[2].imported?.calories, 0);
  assert.equal(days[2].imported?.protein, null);
  assert.equal(days[2].partial, true);
  assert.equal(days[2].isToday, true);
  assert.equal(days[2].targets?.fat, 0);
  assert.equal(days[0].targets?.basis, "recorded_plan");
  assert.equal(nutritionTargetsForDate("2026-08-01", plans), null);
  assert.equal(nutritionTargetsForDate("2026-10-07", [plans[0]], "2026-10-07"), null);
  assert.equal(buildNutritionLogDays(["2026-10-07"], [nutrition], [], "2026-10-07")[0].imported?.calories, 1800);
});

test("repair migration only changes unsupported derived recovery, retains raw nutrition and true health", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE public.client_wearable_daily_summaries (
      id TEXT PRIMARY KEY, sleep_minutes INTEGER, sleep_score INTEGER CHECK (sleep_score BETWEEN 0 AND 100), hrv_ms NUMERIC(8,2), resting_hr_bpm INTEGER,
      readiness_score INTEGER, recovery_status TEXT NOT NULL DEFAULT 'good' CHECK (recovery_status IN ('good','watch','reduce_intensity')),
      flags TEXT[] NOT NULL DEFAULT '{}', insight TEXT, nutrition_calories INTEGER, protein_g NUMERIC, steps INTEGER, source_payload_ids TEXT[], updated_at TIMESTAMPTZ
    );
    INSERT INTO public.client_wearable_daily_summaries VALUES
      ('nutrition',NULL,NULL,NULL,NULL,82,'good','{}','Steady',1800,120,NULL,'{original}','2026-10-05T12:00:00Z'),
      ('steps',NULL,NULL,0,0,82,'good','{}','Steady',0,0,10000,'{original}','2026-10-05T12:00:00Z'),
      ('sleep-only',420,90,NULL,NULL,82,'good','{}','Steady',NULL,NULL,NULL,'{original}','2026-10-05T12:00:00Z'),
      ('actual',420,90,40,61,82,'good','{}','Steady',1900,130,8000,'{original}','2026-10-05T12:00:00Z');`);
    const before = (await db.query<Record<string, unknown>>("SELECT * FROM public.client_wearable_daily_summaries ORDER BY id")).rows;
    const migration = await readFile(new URL("../supabase/migrations/20261007140000_wearable_recovery_data.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await db.exec(migration); // idempotent repair
    const after = (await db.query<Record<string, unknown>>("SELECT * FROM public.client_wearable_daily_summaries ORDER BY id")).rows;
    for (let i = 0; i < before.length; i++) {
      for (const field of ["sleep_minutes", "sleep_score", "hrv_ms", "resting_hr_bpm", "nutrition_calories", "protein_g", "steps", "source_payload_ids", "updated_at"]) assert.deepEqual(after[i][field], before[i][field]);
      if (after[i].id === "actual") assert.deepEqual(after[i], before[i]);
      else {
        assert.equal(after[i].readiness_score, null);
        assert.equal(after[i].recovery_status, "unknown");
        assert.equal(after[i].insight, null);
      }
    }
    await db.exec("INSERT INTO public.client_wearable_daily_summaries (id) VALUES ('new')");
    assert.equal((await db.query<{ recovery_status: string }>("SELECT recovery_status FROM public.client_wearable_daily_summaries WHERE id='new'")).rows[0].recovery_status, "unknown");
  } finally { await db.close(); }
});
