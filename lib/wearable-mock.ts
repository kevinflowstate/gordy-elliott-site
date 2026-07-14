import { getTerraReferenceId } from "@/lib/terra/client";
import { buildWearableInsight, type WearableDailySummary } from "@/lib/wearable-insights";

const today = () => new Date().toISOString().split("T")[0];

export const MOCK_WEARABLE_PROVIDERS = ["garmin", "oura", "myfitnesspal"] as const;
export type MockWearableProvider = typeof MOCK_WEARABLE_PROVIDERS[number];

export function createMockTerraPayload(clientId: string, provider: MockWearableProvider = "garmin") {
  const referenceId = getTerraReferenceId(clientId);
  const common = {
    type: "daily",
    provider,
    user: {
      user_id: `mock-${provider}-${clientId}`,
      reference_id: referenceId,
      provider,
    },
  };

  if (provider === "oura") {
    return {
      ...common,
      data: {
        summary: {
          summary_date: today(),
          sleep_minutes: 330,
          sleep_score: 58,
          hrv_ms: 38,
          resting_hr_bpm: 68,
        },
      },
    };
  }

  if (provider === "myfitnesspal") {
    return {
      ...common,
      data: {
        nutrition: {
          summary_date: today(),
          calories: 1840,
          protein_g: 82,
          carbs_g: 205,
          fat_g: 61,
          water_ml: 1800,
        },
      },
    };
  }

  return {
    ...common,
    data: {
      daily: {
        summary_date: today(),
        steps: 7240,
        active_calories: 640,
        total_calories_burned: 2460,
        resting_hr_bpm: 72,
        training_load: 88,
        workout_count: 1,
      },
      sleep: {
        sleep_minutes: 350,
        sleep_score: 62,
        hrv_ms: 42,
      },
    },
  };
}

export function createMockWearableSummary(provider: MockWearableProvider = "garmin"): Omit<WearableDailySummary, "id" | "client_id" | "created_at" | "updated_at"> {
  const base = provider === "myfitnesspal"
    ? {
        summary_date: today(),
        providers: [provider],
        sleep_minutes: null,
        sleep_score: null,
        hrv_ms: null,
        resting_hr_bpm: null,
        steps: null,
        active_calories: null,
        total_calories_burned: null,
        training_load: null,
        workout_count: null,
        nutrition_calories: 1840,
        protein_g: 82,
        carbs_g: 205,
        fat_g: 61,
        water_ml: 1800,
      }
    : provider === "oura"
      ? {
          summary_date: today(),
          providers: [provider],
          sleep_minutes: 330,
          sleep_score: 58,
          hrv_ms: 38,
          resting_hr_bpm: 68,
          steps: null,
          active_calories: null,
          total_calories_burned: null,
          training_load: null,
          workout_count: null,
          nutrition_calories: null,
          protein_g: null,
          carbs_g: null,
          fat_g: null,
          water_ml: null,
        }
      : {
          summary_date: today(),
          providers: [provider],
          sleep_minutes: 350,
          sleep_score: 62,
          hrv_ms: 42,
          resting_hr_bpm: 72,
          steps: 7240,
          active_calories: 640,
          total_calories_burned: 2460,
          training_load: 88,
          workout_count: 1,
          nutrition_calories: null,
          protein_g: null,
          carbs_g: null,
          fat_g: null,
          water_ml: null,
        };

  return {
    ...base,
    ...buildWearableInsight(base),
    source_payload_ids: [],
  };
}
