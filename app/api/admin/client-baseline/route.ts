import { requireAdmin } from "@/lib/admin-auth";
import {
  hasCapacityMetric,
  parseBoundedCapacityMetric,
  type CapacityMetrics,
} from "@/lib/capacity-baseline";
import {
  defaultBaselinePeriod,
  loadBaselineComparison,
  loadCapacitySnapshot,
} from "@/lib/capacity-baseline-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getProfile(admin: ReturnType<typeof createAdminClient>, clientId: string) {
  return admin
    .from("client_profiles")
    .select("id, start_date, experience_mode")
    .eq("id", clientId)
    .maybeSingle();
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const clientId = new URL(request.url).searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await getProfile(admin, clientId);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    const period = defaultBaselinePeriod(profile.start_date);
    const [result, suggested] = await Promise.all([
      loadBaselineComparison(admin, clientId),
      loadCapacitySnapshot(admin, clientId, period.periodStart, period.periodEnd),
    ]);
    return NextResponse.json({
      ...result,
      suggested: {
        period_start: period.periodStart,
        period_end: period.periodEnd,
        ...suggested,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Baseline could not be loaded" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await getProfile(admin, clientId);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const existing = await admin
    .from("client_capacity_baselines")
    .select("id, status")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
  if (existing.data?.status === "locked") {
    return NextResponse.json({ error: "This baseline is locked and cannot be changed" }, { status: 409 });
  }

  const defaultPeriod = defaultBaselinePeriod(profile.start_date);
  const periodStart = typeof body.period_start === "string" ? body.period_start : defaultPeriod.periodStart;
  const periodEnd = typeof body.period_end === "string" ? body.period_end : defaultPeriod.periodEnd;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodEnd < periodStart) {
    return NextResponse.json({ error: "Invalid baseline period" }, { status: 400 });
  }

  const bodyMetrics = {
    weight_kg: parseBoundedCapacityMetric(body.weight_kg, 20, 400),
    body_fat_percentage: parseBoundedCapacityMetric(body.body_fat_percentage, 1, 75),
    waist_cm: parseBoundedCapacityMetric(body.waist_cm, 30, 250),
  };
  if (Object.values(bodyMetrics).some((value) => value === undefined)) {
    return NextResponse.json({ error: "One or more body measurements are outside the allowed range" }, { status: 400 });
  }

  try {
    const wearable = await loadCapacitySnapshot(admin, clientId, periodStart, periodEnd);
    const snapshotBodyMetrics = {
      weight_kg: parseBoundedCapacityMetric(wearable.metrics.weight_kg, 20, 400),
      waist_cm: parseBoundedCapacityMetric(wearable.metrics.waist_cm, 30, 250),
    };
    if (Object.values(snapshotBodyMetrics).some((value) => value === undefined)) {
      return NextResponse.json(
        { error: "A stored body measurement is outside the allowed baseline range" },
        { status: 400 },
      );
    }
    const metrics: CapacityMetrics = {
      ...wearable.metrics,
      weight_kg: bodyMetrics.weight_kg ?? snapshotBodyMetrics.weight_kg ?? null,
      body_fat_percentage: bodyMetrics.body_fat_percentage ?? null,
      waist_cm: bodyMetrics.waist_cm ?? snapshotBodyMetrics.waist_cm ?? null,
    };
    if (!hasCapacityMetric(metrics)) {
      return NextResponse.json({ error: "At least one baseline metric is required" }, { status: 400 });
    }

    const payload = {
      client_id: clientId,
      period_start: periodStart,
      period_end: periodEnd,
      ...metrics,
      wearable_source_days: wearable.wearableSourceDays,
      updated_at: new Date().toISOString(),
    };
    const query = existing.data
      ? admin.from("client_capacity_baselines").update(payload).eq("id", existing.data.id)
      : admin.from("client_capacity_baselines").insert(payload);
    const { data, error } = await query.select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ baseline: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Baseline could not be saved" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const { data: baseline, error: baselineError } = await admin
    .from("client_capacity_baselines")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (baselineError) return NextResponse.json({ error: baselineError.message }, { status: 500 });
  if (!baseline) return NextResponse.json({ error: "Save a draft baseline before locking it" }, { status: 404 });
  if (baseline.status === "locked") return NextResponse.json({ baseline });

  const metrics: CapacityMetrics = {
    hrv_ms: baseline.hrv_ms === null ? null : Number(baseline.hrv_ms),
    resting_hr_bpm: baseline.resting_hr_bpm === null ? null : Number(baseline.resting_hr_bpm),
    sleep_minutes: baseline.sleep_minutes === null ? null : Number(baseline.sleep_minutes),
    sleep_score: baseline.sleep_score === null ? null : Number(baseline.sleep_score),
    weight_kg: baseline.weight_kg === null ? null : Number(baseline.weight_kg),
    body_fat_percentage: baseline.body_fat_percentage === null ? null : Number(baseline.body_fat_percentage),
    waist_cm: baseline.waist_cm === null ? null : Number(baseline.waist_cm),
  };
  if (!hasCapacityMetric(metrics)) return NextResponse.json({ error: "At least one baseline metric is required" }, { status: 400 });

  const { data, error } = await admin
    .from("client_capacity_baselines")
    .update({
      status: "locked",
      locked_at: new Date().toISOString(),
      locked_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", baseline.id)
    .eq("status", "draft")
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ baseline: data });
}
