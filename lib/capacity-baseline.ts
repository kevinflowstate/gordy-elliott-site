export type CapacityMetrics = {
  hrv_ms: number | null;
  resting_hr_bpm: number | null;
  sleep_minutes: number | null;
  sleep_score: number | null;
  weight_kg: number | null;
  body_fat_percentage: number | null;
  waist_cm: number | null;
};

export type CapacityBaseline = CapacityMetrics & {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  wearable_source_days: number;
  status: "draft" | "locked";
  locked_at: string | null;
  override_reason: string | null;
  created_at: string;
  updated_at: string;
};

type WearableMetricRow = {
  hrv_ms: number | null;
  resting_hr_bpm: number | null;
  sleep_minutes: number | null;
  sleep_score: number | null;
};

export function parseBoundedCapacityMetric(value: unknown, min: number, max: number) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return undefined;
  return Math.round(parsed * 100) / 100;
}

function average(values: Array<number | null | undefined>) {
  const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (present.length === 0) return null;
  return Math.round((present.reduce((sum, value) => sum + value, 0) / present.length) * 10) / 10;
}

export function averageWearableMetrics(rows: WearableMetricRow[]) {
  return {
    hrv_ms: average(rows.map((row) => row.hrv_ms)),
    resting_hr_bpm: average(rows.map((row) => row.resting_hr_bpm)),
    sleep_minutes: average(rows.map((row) => row.sleep_minutes)),
    sleep_score: average(rows.map((row) => row.sleep_score)),
    wearable_source_days: rows.length,
  };
}

export function compareCapacityMetrics(baseline: CapacityMetrics, current: CapacityMetrics) {
  const metric = (
    key: keyof CapacityMetrics,
    improvementDirection: "higher" | "lower",
  ) => {
    const from = baseline[key];
    const now = current[key];
    if (from === null || now === null) return { baseline: from, current: now, delta: null, direction: "missing" as const };
    const delta = Math.round((now - from) * 10) / 10;
    const improved = improvementDirection === "higher" ? delta > 0 : delta < 0;
    return {
      baseline: from,
      current: now,
      delta,
      direction: delta === 0 ? "unchanged" as const : improved ? "improved" as const : "declined" as const,
    };
  };

  return {
    hrv_ms: metric("hrv_ms", "higher"),
    resting_hr_bpm: metric("resting_hr_bpm", "lower"),
    sleep_minutes: metric("sleep_minutes", "higher"),
    sleep_score: metric("sleep_score", "higher"),
    weight_kg: metric("weight_kg", "lower"),
    body_fat_percentage: metric("body_fat_percentage", "lower"),
    waist_cm: metric("waist_cm", "lower"),
  };
}

export function hasCapacityMetric(metrics: CapacityMetrics) {
  return Object.values(metrics).some((value) => value !== null);
}
