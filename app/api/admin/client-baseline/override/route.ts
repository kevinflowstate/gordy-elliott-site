import { requireAdmin } from "@/lib/admin-auth";
import {
  hasCapacityMetric,
  parseBoundedCapacityMetric,
  type CapacityMetrics,
} from "@/lib/capacity-baseline";
import { loadCapacitySnapshot } from "@/lib/capacity-baseline-server";
import { parseDateKey } from "@/lib/founder-compliance";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const clientId = new URL(request.url).searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_baseline_overrides")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ overrides: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "A written override reason is required" }, { status: 400 });
  if (reason.length > 500) {
    return NextResponse.json({ error: "The override reason is limited to 500 characters" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: baseline, error: baselineError } = await admin
    .from("client_capacity_baselines")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (baselineError) return NextResponse.json({ error: baselineError.message }, { status: 500 });
  if (!baseline) return NextResponse.json({ error: "No baseline exists for this client" }, { status: 404 });
  if (baseline.status !== "locked") {
    return NextResponse.json({ error: "Only a locked baseline can be overridden. Edit the draft directly." }, { status: 409 });
  }

  const periodStart = body.period_start === undefined || body.period_start === ""
    ? String(baseline.period_start).slice(0, 10)
    : parseDateKey(body.period_start);
  const periodEnd = body.period_end === undefined || body.period_end === ""
    ? String(baseline.period_end).slice(0, 10)
    : parseDateKey(body.period_end);
  if (!periodStart || !periodEnd || periodEnd < periodStart) {
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

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await admin.rpc("override_locked_capacity_baseline", {
      p_client_id: clientId,
      p_new_values: {
        period_start: periodStart,
        period_end: periodEnd,
        ...metrics,
        wearable_source_days: wearable.wearableSourceDays,
      },
      p_reason: reason,
      p_actor: user?.id || null,
    });
    if (error) {
      const status = /reason|metric|period/i.test(error.message) ? 400 : /locked|exists/i.test(error.message) ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ baseline: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Baseline could not be overridden" },
      { status: 500 },
    );
  }
}
