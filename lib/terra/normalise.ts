import { buildWearableInsight, type WearableDailySummary } from "@/lib/wearable-insights";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function getNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function getString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function getDateKey(...values: unknown[]) {
  const value = getString(...values);
  if (!value) return new Date().toISOString().split("T")[0];
  return value.includes("T") ? value.split("T")[0] : value.slice(0, 10);
}

function uniqueProviders(provider: string | null) {
  return provider ? [provider.toLowerCase()] : [];
}

export function extractTerraUser(payload: AnyRecord) {
  const user = asRecord(payload.user);
  const metadata = asRecord(user.metadata);
  const provider = getString(
    payload.provider,
    payload.source,
    payload.data_source,
    user.provider,
    user.provider_name,
    user.data_source,
  );

  return {
    provider: provider?.toLowerCase() || "terra",
    terraUserId: getString(user.user_id, user.id, payload.user_id, payload.terra_user_id),
    referenceId: getString(user.reference_id, metadata.reference_id, payload.reference_id),
    eventType: getString(payload.type, payload.event_type, payload.status) || "unknown",
    rawUser: user,
  };
}

export function normaliseTerraPayload(payload: AnyRecord): Omit<WearableDailySummary, "id" | "client_id" | "source_payload_ids" | "created_at" | "updated_at"> | null {
  const data = asRecord(payload.data);
  const sleep = asRecord(data.sleep || payload.sleep);
  const daily = asRecord(data.daily || payload.daily);
  const activity = asRecord(data.activity || payload.activity);
  const nutrition = asRecord(data.nutrition || payload.nutrition);
  const summary = asRecord(data.summary || payload.summary);
  const userInfo = extractTerraUser(payload);

  const summaryDate = getDateKey(
    summary.summary_date,
    daily.summary_date,
    sleep.summary_date,
    nutrition.summary_date,
    activity.summary_date,
    data.start_time,
    payload.start_time,
    payload.created_at,
  );

  const base = {
    summary_date: summaryDate,
    providers: uniqueProviders(userInfo.provider),
    sleep_minutes: getNumber(
      sleep.sleep_minutes,
      sleep.duration_in_bed_seconds ? Number(sleep.duration_in_bed_seconds) / 60 : null,
      sleep.total_sleep_duration_seconds ? Number(sleep.total_sleep_duration_seconds) / 60 : null,
      summary.sleep_minutes,
    ),
    sleep_score: getNumber(sleep.score, sleep.sleep_score, summary.sleep_score),
    hrv_ms: getNumber(sleep.hrv_ms, sleep.avg_hrv, daily.hrv_ms, summary.hrv_ms),
    resting_hr_bpm: getNumber(sleep.resting_hr_bpm, daily.resting_hr_bpm, daily.resting_heart_rate, summary.resting_hr_bpm),
    steps: getNumber(daily.steps, activity.steps, summary.steps),
    active_calories: getNumber(daily.active_calories, activity.active_calories, activity.calories, summary.active_calories),
    total_calories_burned: getNumber(daily.total_calories_burned, daily.calories_burned, summary.total_calories_burned),
    training_load: getNumber(activity.training_load, daily.training_load, summary.training_load),
    workout_count: getNumber(activity.workout_count, daily.workout_count, summary.workout_count),
    nutrition_calories: getNumber(nutrition.calories, nutrition.energy_kcal, summary.nutrition_calories),
    protein_g: getNumber(nutrition.protein_g, nutrition.protein, summary.protein_g),
    carbs_g: getNumber(nutrition.carbs_g, nutrition.carbohydrates_g, nutrition.carbs, summary.carbs_g),
    fat_g: getNumber(nutrition.fat_g, nutrition.fat, summary.fat_g),
    water_ml: getNumber(nutrition.water_ml, nutrition.water, summary.water_ml),
  };

  const hasSignal = Object.entries(base).some(([key, value]) =>
    !["summary_date", "providers"].includes(key) && value !== null && value !== undefined
  );
  if (!hasSignal) return null;

  return {
    ...base,
    ...buildWearableInsight(base),
  };
}

export function mergeDailySummary(
  existing: WearableDailySummary | null,
  incoming: Omit<WearableDailySummary, "id" | "client_id" | "source_payload_ids" | "created_at" | "updated_at">,
  sourcePayloadId: string,
): Partial<WearableDailySummary> {
  const mergedBase = {
    ...incoming,
    providers: Array.from(new Set([...(existing?.providers || []), ...incoming.providers])),
    sleep_minutes: incoming.sleep_minutes ?? existing?.sleep_minutes ?? null,
    sleep_score: incoming.sleep_score ?? existing?.sleep_score ?? null,
    hrv_ms: incoming.hrv_ms ?? existing?.hrv_ms ?? null,
    resting_hr_bpm: incoming.resting_hr_bpm ?? existing?.resting_hr_bpm ?? null,
    steps: incoming.steps ?? existing?.steps ?? null,
    active_calories: incoming.active_calories ?? existing?.active_calories ?? null,
    total_calories_burned: incoming.total_calories_burned ?? existing?.total_calories_burned ?? null,
    training_load: incoming.training_load ?? existing?.training_load ?? null,
    workout_count: incoming.workout_count ?? existing?.workout_count ?? null,
    nutrition_calories: incoming.nutrition_calories ?? existing?.nutrition_calories ?? null,
    protein_g: incoming.protein_g ?? existing?.protein_g ?? null,
    carbs_g: incoming.carbs_g ?? existing?.carbs_g ?? null,
    fat_g: incoming.fat_g ?? existing?.fat_g ?? null,
    water_ml: incoming.water_ml ?? existing?.water_ml ?? null,
  };

  return {
    ...mergedBase,
    ...buildWearableInsight(mergedBase),
    source_payload_ids: Array.from(new Set([...(existing?.source_payload_ids || []), sourcePayloadId])),
    updated_at: new Date().toISOString(),
  };
}
