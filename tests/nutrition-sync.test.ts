import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveNutritionTotals,
  type NutritionTotals,
  type SyncedNutrition,
} from "@/lib/nutrition-totals";

const syncedNutrition: SyncedNutrition = {
  provider: "myfitnesspal",
  summaryDate: "2026-08-03",
  calories: 1840,
  proteinG: 112,
  carbsG: 205,
  fatG: 61,
  waterMl: 2100,
  summaryUpdatedAt: "2026-08-03T12:30:00Z",
  lastSyncAt: "2026-08-03T12:31:00Z",
  connectionStatus: "connected",
};

const assignedTotals: NutritionTotals = {
  calories: 500,
  protein: 40,
  carbs: 55,
  fat: 15,
  fibre: 7,
  sugar: 4,
};

test("MyFitnessPal is authoritative and prevents manual or assigned meals being double counted", () => {
  const result = resolveNutritionTotals({
    syncedNutrition,
    manualEntries: [{
      name: "Lunch",
      completed: true,
      calories: 600,
      protein_g: 35,
      carbs_g: 70,
      fat_g: 20,
    }],
    assignedEntries: [{ completed: true, totals: assignedTotals }],
  });

  assert.equal(result.source, "myfitnesspal");
  assert.deepEqual(result.totals, {
    calories: 1840,
    protein: 112,
    carbs: 205,
    fat: 61,
    fibre: 0,
    sugar: 0,
  });
});

test("a completed manual daily correction overrides MyFitnessPal totals", () => {
  const result = resolveNutritionTotals({
    syncedNutrition,
    manualEntries: [{
      name: "Daily totals (manual)",
      completed: true,
      calories: 2000,
      protein_g: 125,
      carbs_g: 220,
      fat_g: 65,
      fibre_g: 28,
      sugar_g: 40,
    }],
    assignedEntries: [{ completed: true, totals: assignedTotals }],
  });

  assert.equal(result.source, "manual_override");
  assert.equal(result.hasManualOverride, true);
  assert.deepEqual(result.totals, {
    calories: 2000,
    protein: 125,
    carbs: 220,
    fat: 65,
    fibre: 28,
    sugar: 40,
  });
});

test("manual and assigned entries continue to add up when no synced total exists", () => {
  const result = resolveNutritionTotals({
    syncedNutrition: null,
    manualEntries: [{
      name: "Snack",
      completed: true,
      calories: 250,
      protein_g: 10,
      carbs_g: 30,
      fat_g: 8,
      fibre_g: 3,
      sugar_g: 12,
    }],
    assignedEntries: [{ completed: true, totals: assignedTotals }],
  });

  assert.equal(result.source, "manual_entries");
  assert.deepEqual(result.totals, {
    calories: 750,
    protein: 50,
    carbs: 85,
    fat: 23,
    fibre: 10,
    sugar: 16,
  });
});
