export type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  sugar: number;
};

export type SyncedNutrition = {
  provider: "myfitnesspal";
  summaryDate: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  waterMl: number | null;
  summaryUpdatedAt: string | null;
  lastSyncAt: string | null;
  connectionStatus: string | null;
};

type ManualNutritionEntry = {
  name: string;
  completed: boolean;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g?: number;
  sugar_g?: number;
};

type AssignedNutritionEntry = {
  completed: boolean;
  totals: NutritionTotals;
};

export type NutritionTotalsSource = "myfitnesspal" | "manual_override" | "manual_entries";

export function isWholeDayNutritionTotal(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === "myfitnesspal totals" || normalized === "daily totals (manual)";
}

function fromManualEntry(entry: ManualNutritionEntry): NutritionTotals {
  return {
    calories: Number(entry.calories) || 0,
    protein: Number(entry.protein_g) || 0,
    carbs: Number(entry.carbs_g) || 0,
    fat: Number(entry.fat_g) || 0,
    fibre: Number(entry.fibre_g) || 0,
    sugar: Number(entry.sugar_g) || 0,
  };
}

function addTotals(current: NutritionTotals, incoming: NutritionTotals): NutritionTotals {
  return {
    calories: current.calories + incoming.calories,
    protein: current.protein + incoming.protein,
    carbs: current.carbs + incoming.carbs,
    fat: current.fat + incoming.fat,
    fibre: current.fibre + incoming.fibre,
    sugar: current.sugar + incoming.sugar,
  };
}

const EMPTY_TOTALS: NutritionTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fibre: 0,
  sugar: 0,
};

export function resolveNutritionTotals({
  syncedNutrition,
  manualEntries,
  assignedEntries,
}: {
  syncedNutrition: SyncedNutrition | null;
  manualEntries: ManualNutritionEntry[];
  assignedEntries: AssignedNutritionEntry[];
}): {
  totals: NutritionTotals;
  source: NutritionTotalsSource;
  hasManualOverride: boolean;
} {
  const completedManualEntries = manualEntries.filter((entry) => entry.completed);
  const manualOverride = [...completedManualEntries]
    .reverse()
    .find((entry) => isWholeDayNutritionTotal(entry.name));

  if (manualOverride) {
    return {
      totals: fromManualEntry(manualOverride),
      source: "manual_override",
      hasManualOverride: true,
    };
  }

  if (syncedNutrition) {
    return {
      totals: {
        calories: syncedNutrition.calories ?? 0,
        protein: syncedNutrition.proteinG ?? 0,
        carbs: syncedNutrition.carbsG ?? 0,
        fat: syncedNutrition.fatG ?? 0,
        fibre: 0,
        sugar: 0,
      },
      source: "myfitnesspal",
      hasManualOverride: false,
    };
  }

  const quickMealTotals = completedManualEntries.reduce(
    (totals, entry) => addTotals(totals, fromManualEntry(entry)),
    EMPTY_TOTALS,
  );
  const assignedMealTotals = assignedEntries
    .filter((entry) => entry.completed)
    .reduce((totals, entry) => addTotals(totals, entry.totals), EMPTY_TOTALS);

  return {
    totals: addTotals(quickMealTotals, assignedMealTotals),
    source: "manual_entries",
    hasManualOverride: false,
  };
}
