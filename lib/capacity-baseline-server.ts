import { averageWearableMetrics, compareCapacityMetrics, type CapacityBaseline, type CapacityMetrics } from "@/lib/capacity-baseline";
import { createAdminClient } from "@/lib/supabase/admin";

export function dateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function defaultBaselinePeriod(startDate: string | null | undefined, now = new Date()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const startDateKey = typeof startDate === "string" ? startDate.slice(0, 10) : "";
  const parsedStart = new Date(`${startDateKey}T00:00:00.000Z`);
  const start = Number.isNaN(parsedStart.getTime()) || parsedStart > today ? today : parsedStart;
  const intendedEnd = new Date(start);
  intendedEnd.setUTCDate(start.getUTCDate() + 29);
  return {
    periodStart: dateKey(start),
    periodEnd: dateKey(intendedEnd > today ? today : intendedEnd),
  };
}

export async function loadCapacitySnapshot(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  periodStart: string,
  periodEnd: string,
) {
  const [{ data: summaries, error: summariesError }, { data: measurements, error: measurementsError }] = await Promise.all([
    admin
      .from("client_wearable_daily_summaries")
      .select("hrv_ms, resting_hr_bpm, sleep_minutes, sleep_score")
      .eq("client_id", clientId)
      .gte("summary_date", periodStart)
      .lte("summary_date", periodEnd)
      .order("summary_date", { ascending: true }),
    admin
      .from("client_body_measurements")
      .select("weight_kg, waist_cm, measured_date")
      .eq("client_id", clientId)
      .gte("measured_date", periodStart)
      .lte("measured_date", periodEnd)
      .order("measured_date", { ascending: false })
      .limit(1),
  ]);

  if (summariesError) throw summariesError;
  if (measurementsError) throw measurementsError;

  const wearable = averageWearableMetrics(summaries || []);
  const latestBody = measurements?.[0] || null;
  const metrics: CapacityMetrics = {
    hrv_ms: wearable.hrv_ms,
    resting_hr_bpm: wearable.resting_hr_bpm,
    sleep_minutes: wearable.sleep_minutes,
    sleep_score: wearable.sleep_score,
    weight_kg: latestBody?.weight_kg === null || latestBody?.weight_kg === undefined ? null : Number(latestBody.weight_kg),
    body_fat_percentage: null,
    waist_cm: latestBody?.waist_cm === null || latestBody?.waist_cm === undefined ? null : Number(latestBody.waist_cm),
  };

  return {
    metrics,
    wearableSourceDays: wearable.wearable_source_days,
    latestBodyMeasurementDate: latestBody?.measured_date || null,
  };
}

export async function loadBaselineComparison(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
) {
  const { data: baseline, error } = await admin
    .from("client_capacity_baselines")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;

  const today = new Date();
  const periodEnd = dateKey(today);
  const periodStartDate = new Date(today);
  periodStartDate.setUTCDate(today.getUTCDate() - 13);
  const periodStart = dateKey(periodStartDate);
  const current = await loadCapacitySnapshot(admin, clientId, periodStart, periodEnd);

  return {
    baseline: (baseline as CapacityBaseline | null) || null,
    current: {
      period_start: periodStart,
      period_end: periodEnd,
      ...current,
    },
    comparison: baseline
      ? compareCapacityMetrics(baseline as CapacityMetrics, current.metrics)
      : null,
  };
}
