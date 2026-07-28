import type { CapacityMetrics } from "@/lib/capacity-baseline";
import { dateKeyOrdinal, londonDateKey } from "@/lib/early-win";
import { addDaysToKey, isoWeekKey } from "@/lib/storm-warning";

export const COMPLIANCE_WINDOW_WEEKS = 8;

export type CallType = "coaching_call" | "strategy_call";

export const CALL_TYPES: readonly CallType[] = ["coaching_call", "strategy_call"];

export const CALL_TYPE_LABELS: Record<CallType, string> = {
  coaching_call: "Coaching call",
  strategy_call: "Strategy call",
};

export function isCallType(value: unknown): value is CallType {
  return value === "coaching_call" || value === "strategy_call";
}

export const WEEK_KEY_PATTERN = /^\d{4}-W\d{2}$/;

export function trimmedOrNull(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? undefined : trimmed;
}

/** Valid real-calendar yyyy-mm-dd key, or null. Rejects normalised dates like 2026-02-31. */
export function parseDateKey(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (dateKeyOrdinal(value) === null) return null;
  return addDaysToKey(value, 0) === value ? value : null;
}

export function weekKeyForDateKey(dateKey: string) {
  return isoWeekKey(dateKey.slice(0, 10));
}

/** ISO week key of the Europe/London civil day containing the instant. */
export function londonWeekKey(now: Date) {
  return isoWeekKey(londonDateKey(now));
}

export function mondayOfLondonWeek(now: Date) {
  const todayKey = londonDateKey(now);
  const ordinal = dateKeyOrdinal(todayKey);
  if (ordinal === null) return todayKey;
  const mondayIndexed = (ordinal + 3) % 7; // 1970-01-01 was a Thursday
  return addDaysToKey(todayKey, -mondayIndexed);
}

/** Monday date key for a week key, e.g. "2026-W30" -> "2026-07-20". */
export function weekKeyStartDateKey(weekKey: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return null;
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const jan4 = `${match[1]}-01-04`;
  const ordinal = dateKeyOrdinal(jan4);
  if (ordinal === null) return null;
  const mondayOfWeek1 = addDaysToKey(jan4, -((ordinal + 3) % 7));
  return addDaysToKey(mondayOfWeek1, (week - 1) * 7);
}

/**
 * The `count` most recent complete Monday-Sunday weeks before the current
 * London week, oldest first. The in-progress week is never included - a week
 * that has not finished cannot honestly be counted as met or missed.
 */
export function recentCompleteWeekKeys(now: Date, count: number) {
  const monday = mondayOfLondonWeek(now);
  const keys: string[] = [];
  for (let offset = count; offset >= 1; offset--) {
    keys.push(isoWeekKey(addDaysToKey(monday, -7 * offset)));
  }
  return keys;
}

export type CheckinAdherence = {
  window_weeks: number;
  expected_weeks: number;
  submitted_weeks: number;
  missed_week_keys: string[];
  current_week_key: string;
  current_week_submitted: boolean;
  start_date: string | null;
};

/**
 * Weekly check-in adherence from existing check-in records. Weeks run Monday
 * to Sunday on Europe/London civil days, matching the portal's
 * `submittedThisWeek` convention. Expected weeks are the complete weeks in
 * the window on or after the week containing the client's start date; the
 * start week itself counts. With no usable start date every window week is
 * expected, and `start_date` is null so callers can state that honestly.
 */
export function checkinAdherence(params: {
  startDate: string | null | undefined;
  checkins: Array<{ created_at: string }>;
  now: Date;
  windowWeeks?: number;
}): CheckinAdherence {
  const windowWeeks = params.windowWeeks ?? COMPLIANCE_WINDOW_WEEKS;
  const submitted = new Set<string>();
  for (const checkin of params.checkins) {
    const at = new Date(checkin.created_at);
    if (Number.isNaN(at.getTime())) continue;
    submitted.add(londonWeekKey(at));
  }

  const startDateKey = typeof params.startDate === "string" ? parseDateKey(params.startDate.slice(0, 10)) : null;
  const startWeekKey = startDateKey ? isoWeekKey(startDateKey) : null;
  const expected = recentCompleteWeekKeys(params.now, windowWeeks).filter(
    (week) => startWeekKey === null || week >= startWeekKey,
  );
  const missed = expected.filter((week) => !submitted.has(week));
  const currentWeekKey = londonWeekKey(params.now);

  return {
    window_weeks: windowWeeks,
    expected_weeks: expected.length,
    submitted_weeks: expected.length - missed.length,
    missed_week_keys: missed,
    current_week_key: currentWeekKey,
    current_week_submitted: submitted.has(currentWeekKey),
    start_date: startDateKey,
  };
}

export type CallAttendanceSummary = {
  recorded: number;
  attended: number;
  missed: number;
  by_type: Record<CallType, { recorded: number; attended: number }>;
};

export function summariseCallAttendance(
  records: Array<{ call_type: string; attended: boolean }>,
): CallAttendanceSummary {
  const summary: CallAttendanceSummary = {
    recorded: 0,
    attended: 0,
    missed: 0,
    by_type: {
      coaching_call: { recorded: 0, attended: 0 },
      strategy_call: { recorded: 0, attended: 0 },
    },
  };
  for (const record of records) {
    if (!isCallType(record.call_type)) continue;
    summary.recorded += 1;
    if (record.attended) summary.attended += 1;
    else summary.missed += 1;
    summary.by_type[record.call_type].recorded += 1;
    if (record.attended) summary.by_type[record.call_type].attended += 1;
  }
  return summary;
}

export type WhatsappHelpSummary = {
  window_weeks: number;
  weeks_recorded: number;
  weeks_helped: number;
  current_week_key: string;
  current_week_recorded: boolean;
  current_week_helped: boolean | null;
};

export function summariseWhatsappHelp(
  records: Array<{ week_key: string; helped: boolean }>,
  now: Date,
  windowWeeks = COMPLIANCE_WINDOW_WEEKS,
): WhatsappHelpSummary {
  const byWeek = new Map<string, boolean>();
  for (const record of records) {
    if (WEEK_KEY_PATTERN.test(record.week_key)) byWeek.set(record.week_key, record.helped);
  }
  let recorded = 0;
  let helped = 0;
  for (const week of recentCompleteWeekKeys(now, windowWeeks)) {
    if (!byWeek.has(week)) continue;
    recorded += 1;
    if (byWeek.get(week)) helped += 1;
  }
  const currentWeekKey = londonWeekKey(now);
  return {
    window_weeks: windowWeeks,
    weeks_recorded: recorded,
    weeks_helped: helped,
    current_week_key: currentWeekKey,
    current_week_recorded: byWeek.has(currentWeekKey),
    current_week_helped: byWeek.has(currentWeekKey) ? Boolean(byWeek.get(currentWeekKey)) : null,
  };
}

export type FounderComplianceSummary = {
  generated_at: string;
  window_weeks: number;
  checkins: CheckinAdherence;
  calls: CallAttendanceSummary;
  whatsapp: WhatsappHelpSummary;
};

/**
 * Plain facts only. This never produces a score, grade, streak or
 * leaderboard value - missing data is reported as missing, and the reader
 * draws their own conclusion.
 */
export function composeComplianceSummary(params: {
  startDate: string | null | undefined;
  checkins: Array<{ created_at: string }>;
  callRecords: Array<{ call_type: string; attended: boolean }>;
  whatsappRecords: Array<{ week_key: string; helped: boolean }>;
  now: Date;
  windowWeeks?: number;
}): FounderComplianceSummary {
  const windowWeeks = params.windowWeeks ?? COMPLIANCE_WINDOW_WEEKS;
  return {
    generated_at: params.now.toISOString(),
    window_weeks: windowWeeks,
    checkins: checkinAdherence({
      startDate: params.startDate,
      checkins: params.checkins,
      now: params.now,
      windowWeeks,
    }),
    calls: summariseCallAttendance(params.callRecords),
    whatsapp: summariseWhatsappHelp(params.whatsappRecords, params.now, windowWeeks),
  };
}

export const GUARANTEE_METRIC_KEYS = [
  "hrv_ms",
  "resting_hr_bpm",
  "sleep_minutes",
  "sleep_score",
  "weight_kg",
  "body_fat_percentage",
  "waist_cm",
] as const;

export type GuaranteeMetricKey = (typeof GUARANTEE_METRIC_KEYS)[number];

export const GUARANTEE_METRIC_LABELS: Record<GuaranteeMetricKey, { label: string; unit: string }> = {
  hrv_ms: { label: "HRV", unit: "ms" },
  resting_hr_bpm: { label: "Resting heart rate", unit: "bpm" },
  sleep_minutes: { label: "Sleep", unit: "min" },
  sleep_score: { label: "Sleep score", unit: "" },
  weight_kg: { label: "Weight", unit: "kg" },
  body_fat_percentage: { label: "Body fat", unit: "%" },
  waist_cm: { label: "Waist", unit: "cm" },
};

export function isGuaranteeMetricKey(value: unknown): value is GuaranteeMetricKey {
  return typeof value === "string" && (GUARANTEE_METRIC_KEYS as readonly string[]).includes(value);
}

export type GuaranteeComparison = "increase_at_least" | "decrease_at_least";
export type GuaranteeThresholdType = "absolute" | "percent";

export type GuaranteeSettings = {
  metric_key: GuaranteeMetricKey | null;
  comparison: GuaranteeComparison | null;
  threshold_type: GuaranteeThresholdType | null;
  threshold_value: number | null;
  remedy_text: string | null;
};

export type ConfiguredGuarantee = GuaranteeSettings & {
  metric_key: GuaranteeMetricKey;
  comparison: GuaranteeComparison;
  threshold_type: GuaranteeThresholdType;
  threshold_value: number;
};

export function isGuaranteeConfigured(
  settings: GuaranteeSettings | null | undefined,
): settings is ConfiguredGuarantee {
  return Boolean(
    settings
      && settings.metric_key !== null
      && settings.comparison !== null
      && settings.threshold_type !== null
      && settings.threshold_value !== null
      && Number.isFinite(settings.threshold_value)
      && settings.threshold_value > 0,
  );
}

export type GuaranteeEvaluation = {
  metric_key: GuaranteeMetricKey;
  comparison: GuaranteeComparison;
  threshold_type: GuaranteeThresholdType;
  threshold_value: number;
  baseline_value: number | null;
  current_value: number | null;
  delta: number | null;
  change_percent: number | null;
  met: boolean | null;
  reason: string;
  remedy_text: string | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Evaluates the configured guarantee against baseline and comparison-period
 * metrics. Returns null unless every threshold field is configured - an
 * unconfigured or partially configured guarantee is never evaluated and
 * nothing is invented. Missing metric data yields `met: null` with a plain
 * reason, never a pass or fail.
 */
export function evaluateGuarantee(
  settings: GuaranteeSettings | null | undefined,
  baseline: CapacityMetrics | null,
  current: CapacityMetrics | null,
): GuaranteeEvaluation | null {
  if (!isGuaranteeConfigured(settings)) return null;

  const base = {
    metric_key: settings.metric_key,
    comparison: settings.comparison,
    threshold_type: settings.threshold_type,
    threshold_value: settings.threshold_value,
    remedy_text: settings.remedy_text,
  };
  const baselineValue = baseline?.[settings.metric_key] ?? null;
  const currentValue = current?.[settings.metric_key] ?? null;

  if (baselineValue === null || currentValue === null) {
    return {
      ...base,
      baseline_value: baselineValue,
      current_value: currentValue,
      delta: null,
      change_percent: null,
      met: null,
      reason:
        baselineValue === null
          ? "The locked baseline has no value for this metric, so the guarantee cannot be evaluated."
          : "The comparison period has no value for this metric, so the guarantee cannot be evaluated.",
    };
  }

  const delta = round2(currentValue - baselineValue);
  const changePercent = baselineValue === 0 ? null : round2((delta / Math.abs(baselineValue)) * 100);
  const change = settings.threshold_type === "absolute" ? delta : changePercent;

  if (change === null) {
    return {
      ...base,
      baseline_value: baselineValue,
      current_value: currentValue,
      delta,
      change_percent: changePercent,
      met: null,
      reason: "A percentage change cannot be measured from a baseline value of zero.",
    };
  }

  const met =
    settings.comparison === "increase_at_least"
      ? change >= settings.threshold_value
      : change <= -settings.threshold_value;
  const unit = settings.threshold_type === "percent" ? "%" : "";
  const requirement = settings.comparison === "increase_at_least" ? "increase" : "decrease";

  return {
    ...base,
    baseline_value: baselineValue,
    current_value: currentValue,
    delta,
    change_percent: changePercent,
    met,
    reason: `Measured change ${change > 0 ? "+" : ""}${change}${unit} against a required ${requirement} of at least ${settings.threshold_value}${unit}.`,
  };
}
