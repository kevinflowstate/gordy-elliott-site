import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { normaliseTerraPayload, mergeDailySummary } from "@/lib/terra/normalise";
import { resolveNutritionTotals } from "@/lib/nutrition-totals";

function payload(macros: Record<string, unknown>) {
  return { type: "nutrition", user: { provider: "MYFITNESSPAL" }, data: [{ metadata: { start_time: "2026-10-18T00:00:00+01:00" }, summary: { macros } }] };
}

test("real Terra shape retains daily fibre and sugar, including zero", () => {
  const summary = normaliseTerraPayload(payload({ calories: 1800, fiber_g: 24.5, sugar_g: 0 }));
  assert.equal(summary?.summary_date, "2026-10-18");
  assert.equal(summary?.fibre_g, 24.5);
  assert.equal(summary?.sugar_g, 0);
  const absent = normaliseTerraPayload(payload({ calories: 1800 }));
  assert.equal(absent?.fibre_g, null);
  assert.equal(absent?.sugar_g, null);
});

test("fibre-only updates count as data and nutrition keeps MFP ownership", () => {
  const initial = normaliseTerraPayload(payload({ calories: 1800, fiber_g: 24.5, sugar_g: 40 }))!;
  const correction = normaliseTerraPayload(payload({ fiber_g: 0 }))!;
  assert.ok(correction);
  const merged = mergeDailySummary(initial, correction, "correction");
  assert.equal(merged.fibre_g, 0);
  assert.equal(merged.sugar_g, 40);
  const unrelated = { ...initial, providers: ["fitbit"], fibre_g: 99, sugar_g: 99 };
  const protectedSummary = mergeDailySummary(initial, unrelated, "other");
  assert.equal(protectedSummary.fibre_g, 24.5);
  assert.equal(protectedSummary.sugar_g, 40);
});

test("synced totals use imported nutrients without adding meal entries; manual corrections still win", () => {
  const syncedNutrition = { provider: "myfitnesspal" as const, summaryDate: "2026-10-18", calories: 1800, proteinG: 100, carbsG: 200, fatG: 60, fibreG: 24.5, sugarG: 0, waterMl: null, summaryUpdatedAt: null, lastSyncAt: null, connectionStatus: "connected" };
  const manualEntries = [{ name: "Lunch", completed: true, calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15, fibre_g: 7, sugar_g: 10 }];
  const imported = resolveNutritionTotals({ syncedNutrition, manualEntries, assignedEntries: [] });
  assert.equal(imported.totals.fibre, 24.5);
  assert.equal(imported.totals.sugar, 0);
  const manual = resolveNutritionTotals({ syncedNutrition, manualEntries: [{ ...manualEntries[0], name: "Daily totals (manual)" }], assignedEntries: [] });
  assert.equal(manual.totals.fibre, 7);
  assert.equal(manual.source, "manual_override");
});

test("additive migration keeps old data and unknown nutrient values and can run twice", async () => {
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE public.client_wearable_daily_summaries (id text PRIMARY KEY, nutrition_calories integer); INSERT INTO public.client_wearable_daily_summaries VALUES ('old', 1800);");
    const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261019090000_imported_nutrition_fibre_sugar.sql"), "utf8");
    await db.exec(sql); await db.exec(sql);
    const old = (await db.query("SELECT * FROM public.client_wearable_daily_summaries")).rows[0];
    assert.deepEqual(old, { id: "old", nutrition_calories: 1800, fibre_g: null, sugar_g: null });
    await db.exec("UPDATE public.client_wearable_daily_summaries SET fibre_g=24.5,sugar_g=0 WHERE id='old'");
    const changed = (await db.query("SELECT fibre_g::float8 AS fibre, sugar_g::float8 AS sugar FROM public.client_wearable_daily_summaries")).rows[0];
    assert.deepEqual(changed, { fibre: 24.5, sugar: 0 });
  } finally { await db.close(); }
});
