import { dateKeyInTimeZone } from "@/lib/founder-dashboard";

export const EARLY_WIN_WINDOW_DAYS = 14;
export const EARLY_WIN_STALE_AFTER_DAYS = 3;

export type EarlyWinSource = "wearable" | "body_measurement" | "manual";
export type EarlyWinMetricKey =
  | "hrv_ms"
  | "resting_hr_bpm"
  | "sleep_minutes"
  | "weight_kg"
  | "waist_cm"
  | "manual";

export const EARLY_WIN_SOURCED_METRICS: Record<
  Exclude<EarlyWinMetricKey, "manual">,
  { label: string; unit: string; source: Exclude<EarlyWinSource, "manual">; min: number; max: number }
> = {
  hrv_ms: { label: "HRV", unit: "ms", source: "wearable", min: 1, max: 300 },
  resting_hr_bpm: { label: "Resting heart rate", unit: "bpm", source: "wearable", min: 25, max: 150 },
  sleep_minutes: { label: "Sleep", unit: "min", source: "wearable", min: 0, max: 1440 },
  weight_kg: { label: "Weight", unit: "kg", source: "body_measurement", min: 20, max: 400 },
  waist_cm: { label: "Waist", unit: "cm", source: "body_measurement", min: 30, max: 250 },
};

export function isEarlyWinMetricKey(value: unknown): value is EarlyWinMetricKey {
  return value === "manual" || (typeof value === "string" && value in EARLY_WIN_SOURCED_METRICS);
}

export type EarlyWin = {
  id: string;
  client_id: string;
  metric_key: EarlyWinMetricKey;
  source: EarlyWinSource;
  display_label: string;
  unit: string;
  starting_value: number;
  target_value: number;
  start_date: string;
  coaching_note: string | null;
  status: "active" | "completed";
  review_outcome: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EarlyWinReading = {
  value: number | null;
  date: string | null;
  daysSince: number | null;
  stale: boolean;
};

export type EarlyWinProgress = {
  direction: "increase" | "decrease" | "maintain";
  delta: number;
  progressPercent: number | null;
  achieved: boolean;
};

export type EarlyWinView = {
  earlyWin: EarlyWin;
  dayNumber: number;
  windowDays: number;
  reading: EarlyWinReading;
  progress: EarlyWinProgress | null;
  reviewDue: boolean;
};

export function londonDateKey(date: Date) {
  return dateKeyInTimeZone(date, "Europe/London");
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function dateKeyOrdinal(dateKey: string) {
  const [year, month, day] = dateKey.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const ordinal = Date.UTC(year, month - 1, day) / DAY_MS;
  return Number.isFinite(ordinal) ? ordinal : null;
}

/**
 * Day 1 is the start date itself, counted in Europe/London civil days so the
 * count never slips at BST/GMT boundaries. Zero or negative means the win has
 * not started yet.
 */
export function earlyWinDayNumber(startDate: string, now = new Date()) {
  const start = dateKeyOrdinal(startDate);
  const today = dateKeyOrdinal(londonDateKey(now));
  if (start === null || today === null) return 0;
  return today - start + 1;
}

export function daysSinceReading(readingDate: string, now = new Date()) {
  const reading = dateKeyOrdinal(readingDate);
  const today = dateKeyOrdinal(londonDateKey(now));
  if (reading === null || today === null) return null;
  return today - reading;
}

export function buildEarlyWinReading(
  value: number | null,
  readingDate: string | null,
  now = new Date(),
): EarlyWinReading {
  if (value === null || readingDate === null) {
    return { value: null, date: null, daysSince: null, stale: false };
  }
  const daysSince = daysSinceReading(readingDate, now);
  return {
    value,
    date: readingDate.slice(0, 10),
    daysSince,
    stale: daysSince !== null && daysSince >= EARLY_WIN_STALE_AFTER_DAYS,
  };
}

export function improvementDirection(startingValue: number, targetValue: number) {
  if (targetValue > startingValue) return "increase" as const;
  if (targetValue < startingValue) return "decrease" as const;
  return "maintain" as const;
}

/**
 * Progress toward the target from an explicit starting value. A zero-range
 * goal (start equal to target) reports no percentage rather than a divide-by-
 * zero artefact. Returns null when there is no current reading at all - a
 * missing value is never treated as zero.
 */
export function earlyWinProgress(
  startingValue: number,
  targetValue: number,
  currentValue: number | null,
): EarlyWinProgress | null {
  if (currentValue === null || !Number.isFinite(currentValue)) return null;
  const direction = improvementDirection(startingValue, targetValue);
  const delta = Math.round((currentValue - startingValue) * 100) / 100;
  if (direction === "maintain") {
    return { direction, delta, progressPercent: null, achieved: currentValue === targetValue };
  }
  const raw = (currentValue - startingValue) / (targetValue - startingValue);
  const progressPercent = Math.round(Math.min(1, Math.max(0, raw)) * 100);
  const achieved = direction === "increase" ? currentValue >= targetValue : currentValue <= targetValue;
  return { direction, delta, progressPercent, achieved };
}

export function isEarlyWinReviewDue(earlyWin: Pick<EarlyWin, "status" | "start_date">, now = new Date()) {
  return earlyWin.status === "active" && earlyWinDayNumber(earlyWin.start_date, now) >= EARLY_WIN_WINDOW_DAYS;
}

export function buildEarlyWinView(
  earlyWin: EarlyWin,
  reading: { value: number | null; date: string | null },
  now = new Date(),
): EarlyWinView {
  const builtReading = buildEarlyWinReading(reading.value, reading.date, now);
  return {
    earlyWin,
    dayNumber: earlyWinDayNumber(earlyWin.start_date, now),
    windowDays: EARLY_WIN_WINDOW_DAYS,
    reading: builtReading,
    progress: earlyWinProgress(earlyWin.starting_value, earlyWin.target_value, builtReading.value),
    reviewDue: isEarlyWinReviewDue(earlyWin, now),
  };
}
