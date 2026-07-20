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

function sumNumbers(values: unknown[]) {
  const numbers = values.map((value) => getNumber(value)).filter((value): value is number => value !== null);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) : null;
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
    authStatus: getString(payload.status),
    rawUser: user,
  };
}

function normaliseTerraEntry(payload: AnyRecord): Omit<WearableDailySummary, "id" | "client_id" | "source_payload_ids" | "created_at" | "updated_at"> | null {
  const data = asRecord(payload.data);
  const sleep = asRecord(data.sleep || payload.sleep || data);
  const daily = asRecord(data.daily || payload.daily || data);
  const activity = asRecord(data.activity || payload.activity || data);
  const nutrition = asRecord(data.nutrition || payload.nutrition || data);
  const summary = asRecord(data.summary || payload.summary);
  const macros = asRecord(summary.macros || nutrition.macros);
  const metadata = asRecord(data.metadata || summary.metadata);
  const distanceData = asRecord(daily.distance_data || activity.distance_data);
  const distanceSummary = asRecord(distanceData.summary);
  const caloriesData = asRecord(daily.calories_data || activity.calories_data);
  const sleepDurations = asRecord(sleep.sleep_durations_data);
  const asleep = asRecord(sleepDurations.asleep);
  const inBed = asRecord(sleepDurations.other);
  const heartRateData = asRecord(sleep.heart_rate_data || daily.heart_rate_data || activity.heart_rate_data);
  const heartRateSummary = asRecord(heartRateData.summary);
  const scores = asRecord(sleep.scores);
  const enrichment = asRecord(sleep.data_enrichment || daily.data_enrichment);
  const strain = asRecord(activity.strain_data || daily.strain_data);
  const drinks = Array.isArray(nutrition.drink_samples) ? nutrition.drink_samples.map(asRecord) : [];
  const userInfo = extractTerraUser(payload);

  const summaryDate = getDateKey(
    summary.summary_date,
    daily.summary_date,
    sleep.summary_date,
    nutrition.summary_date,
    activity.summary_date,
    metadata.start_time,
    metadata.end_time,
    data.start_time,
    payload.start_time,
    payload.created_at,
  );

  const base = {
    summary_date: summaryDate,
    providers: uniqueProviders(userInfo.provider),
    sleep_minutes: getNumber(
      sleep.sleep_minutes,
      asleep.duration_asleep_state_seconds ? Number(asleep.duration_asleep_state_seconds) / 60 : null,
      inBed.duration_in_bed_seconds ? Number(inBed.duration_in_bed_seconds) / 60 : null,
      sleep.duration_in_bed_seconds ? Number(sleep.duration_in_bed_seconds) / 60 : null,
      sleep.total_sleep_duration_seconds ? Number(sleep.total_sleep_duration_seconds) / 60 : null,
      summary.sleep_minutes,
    ),
    sleep_score: getNumber(sleep.score, sleep.sleep_score, scores.sleep, enrichment.sleep_score, summary.sleep_score),
    hrv_ms: getNumber(sleep.hrv_ms, sleep.avg_hrv, heartRateSummary.avg_hrv_rmssd, heartRateSummary.avg_hrv_sdnn, daily.hrv_ms, summary.hrv_ms),
    resting_hr_bpm: getNumber(sleep.resting_hr_bpm, heartRateSummary.resting_hr_bpm, daily.resting_hr_bpm, daily.resting_heart_rate, summary.resting_hr_bpm),
    steps: getNumber(daily.steps, activity.steps, distanceData.steps, distanceSummary.steps, summary.steps),
    active_calories: getNumber(daily.active_calories, activity.active_calories, activity.calories, caloriesData.net_activity_calories, summary.active_calories),
    total_calories_burned: getNumber(daily.total_calories_burned, daily.calories_burned, caloriesData.total_burned_calories, summary.total_calories_burned),
    training_load: getNumber(activity.training_load, daily.training_load, strain.strain_level, summary.training_load),
    workout_count: getNumber(
      activity.workout_count,
      daily.workout_count,
      summary.workout_count,
      userInfo.eventType.toLowerCase() === "activity" ? 1 : null,
    ),
    nutrition_calories: getNumber(nutrition.calories, nutrition.energy_kcal, macros.calories, summary.nutrition_calories),
    protein_g: getNumber(nutrition.protein_g, nutrition.protein, macros.protein_g, summary.protein_g),
    carbs_g: getNumber(nutrition.carbs_g, nutrition.carbohydrates_g, nutrition.carbs, macros.carbohydrates_g, summary.carbs_g),
    fat_g: getNumber(nutrition.fat_g, nutrition.fat, macros.fat_g, summary.fat_g),
    water_ml: getNumber(
      nutrition.water_ml,
      nutrition.water,
      summary.water_ml,
      summary.drink_ml,
      sumNumbers(drinks.map((drink) => drink.drink_volume)),
    ),
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

export function normaliseTerraPayloads(payload: AnyRecord) {
  const entries = Array.isArray(payload.data) ? payload.data.map(asRecord) : [];
  if (!entries.length) {
    const summary = normaliseTerraEntry(payload);
    return summary ? [summary] : [];
  }

  return entries
    .map((entry) => normaliseTerraEntry({ ...payload, data: entry }))
    .filter((summary): summary is NonNullable<typeof summary> => summary !== null);
}

export function normaliseTerraPayload(payload: AnyRecord) {
  return normaliseTerraPayloads(payload)[0] || null;
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
