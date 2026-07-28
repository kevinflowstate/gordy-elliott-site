import {
  compareCapacityMetrics,
  type CapacityBaseline,
  type CapacityMetrics,
} from "@/lib/capacity-baseline";
import { loadBaselineComparison } from "@/lib/capacity-baseline-server";
import {
  composeComplianceSummary,
  evaluateGuarantee,
  type FounderComplianceSummary,
  type GuaranteeEvaluation,
  type GuaranteeSettings,
} from "@/lib/founder-compliance";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type CallAttendanceRow = {
  id: string;
  client_id: string;
  call_date: string;
  call_type: string;
  attended: boolean;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsappHelpRow = {
  id: string;
  client_id: string;
  week_key: string;
  helped: boolean;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function loadComplianceRecords(admin: AdminClient, clientId: string) {
  const [attendanceRes, whatsappRes] = await Promise.all([
    admin
      .from("client_call_attendance")
      .select("*")
      .eq("client_id", clientId)
      .order("call_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("client_whatsapp_help")
      .select("*")
      .eq("client_id", clientId)
      .order("week_key", { ascending: false })
      .limit(60),
  ]);
  if (attendanceRes.error) throw attendanceRes.error;
  if (whatsappRes.error) throw whatsappRes.error;

  const attendance = (attendanceRes.data || []).map((row) => ({
    ...row,
    call_date: String(row.call_date).slice(0, 10),
  })) as CallAttendanceRow[];
  return { attendance, whatsapp: (whatsappRes.data || []) as WhatsappHelpRow[] };
}

export async function loadComplianceSummary(
  admin: AdminClient,
  clientId: string,
  startDate: string | null,
  now = new Date(),
): Promise<FounderComplianceSummary> {
  const [checkinsRes, records] = await Promise.all([
    admin.from("checkins").select("created_at").eq("client_id", clientId),
    loadComplianceRecords(admin, clientId),
  ]);
  if (checkinsRes.error) throw checkinsRes.error;
  return composeComplianceSummary({
    startDate,
    checkins: checkinsRes.data || [],
    callRecords: records.attendance,
    whatsappRecords: records.whatsapp,
    now,
  });
}

export async function loadGuaranteeSettings(admin: AdminClient): Promise<GuaranteeSettings> {
  const { data, error } = await admin
    .from("guarantee_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return {
    metric_key: data?.metric_key ?? null,
    comparison: data?.comparison ?? null,
    threshold_type: data?.threshold_type ?? null,
    threshold_value:
      data?.threshold_value === null || data?.threshold_value === undefined
        ? null
        : Number(data.threshold_value),
    remedy_text: data?.remedy_text ?? null,
  };
}

export function baselineMetricsFromRow(baseline: CapacityBaseline): CapacityMetrics {
  const numberOrNull = (value: number | null) => (value === null ? null : Number(value));
  return {
    hrv_ms: numberOrNull(baseline.hrv_ms),
    resting_hr_bpm: numberOrNull(baseline.resting_hr_bpm),
    sleep_minutes: numberOrNull(baseline.sleep_minutes),
    sleep_score: numberOrNull(baseline.sleep_score),
    weight_kg: numberOrNull(baseline.weight_kg),
    body_fat_percentage: numberOrNull(baseline.body_fat_percentage),
    waist_cm: numberOrNull(baseline.waist_cm),
  };
}

export type Month4BaselineComparisonSnapshot = {
  source_period: { start: string; end: string; description: string };
  comparison_period: { start: string; end: string; description: string };
  baseline_metrics: CapacityMetrics;
  current_metrics: CapacityMetrics;
  comparison: ReturnType<typeof compareCapacityMetrics>;
  wearable_source_days: { baseline: number; current: number };
  guarantee: GuaranteeEvaluation | null;
};

export type Month4Snapshot = {
  baseline_comparison: Month4BaselineComparisonSnapshot;
  compliance_summary: FounderComplianceSummary;
};

/**
 * Builds the Month 4 review view from the same comparison logic as
 * Baseline-vs-Now: source period is the locked Month 1 baseline window,
 * comparison period is the latest 14 days. Both periods are stated
 * explicitly inside the snapshot. Fails plainly when no locked baseline
 * exists - the review cannot state a source period it does not have.
 */
export async function buildMonth4Snapshot(
  admin: AdminClient,
  clientId: string,
  startDate: string | null,
  now = new Date(),
): Promise<{ snapshot: Month4Snapshot } | { error: string }> {
  const [comparisonResult, summary, guaranteeSettings] = await Promise.all([
    loadBaselineComparison(admin, clientId),
    loadComplianceSummary(admin, clientId, startDate, now),
    loadGuaranteeSettings(admin),
  ]);

  const baseline = comparisonResult.baseline;
  if (!baseline || baseline.status !== "locked") {
    return { error: "A locked Month 1 baseline is required before the Month 4 review can show its comparison" };
  }

  const baselineMetrics = baselineMetricsFromRow(baseline);
  const currentMetrics = comparisonResult.current.metrics;

  return {
    snapshot: {
      baseline_comparison: {
        source_period: {
          start: String(baseline.period_start).slice(0, 10),
          end: String(baseline.period_end).slice(0, 10),
          description: "Locked Month 1 baseline window",
        },
        comparison_period: {
          start: comparisonResult.current.period_start,
          end: comparisonResult.current.period_end,
          description: "Latest 14 days at the time of the review",
        },
        baseline_metrics: baselineMetrics,
        current_metrics: currentMetrics,
        comparison: compareCapacityMetrics(baselineMetrics, currentMetrics),
        wearable_source_days: {
          baseline: baseline.wearable_source_days,
          current: comparisonResult.current.wearableSourceDays,
        },
        guarantee: evaluateGuarantee(guaranteeSettings, baselineMetrics, currentMetrics),
      },
      compliance_summary: summary,
    },
  };
}
