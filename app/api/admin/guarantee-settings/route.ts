import { requireAdmin } from "@/lib/admin-auth";
import {
  isGuaranteeConfigured,
  isGuaranteeMetricKey,
  trimmedOrNull,
} from "@/lib/founder-compliance";
import { loadGuaranteeSettings } from "@/lib/founder-compliance-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  try {
    const settings = await loadGuaranteeSettings(admin);
    return NextResponse.json({ settings, configured: isGuaranteeConfigured(settings) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Guarantee settings could not be loaded" },
      { status: 500 },
    );
  }
}

function nullableField(value: unknown, isValid: (candidate: unknown) => boolean) {
  if (value === null || value === "") return null;
  return isValid(value) ? value : undefined;
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (body.metric_key !== undefined) {
    const metricKey = nullableField(body.metric_key, isGuaranteeMetricKey);
    if (metricKey === undefined) return NextResponse.json({ error: "Unsupported guarantee metric" }, { status: 400 });
    updates.metric_key = metricKey;
  }
  if (body.comparison !== undefined) {
    const comparison = nullableField(
      body.comparison,
      (candidate) => candidate === "increase_at_least" || candidate === "decrease_at_least",
    );
    if (comparison === undefined) {
      return NextResponse.json({ error: "comparison must be 'increase_at_least' or 'decrease_at_least'" }, { status: 400 });
    }
    updates.comparison = comparison;
  }
  if (body.threshold_type !== undefined) {
    const thresholdType = nullableField(
      body.threshold_type,
      (candidate) => candidate === "absolute" || candidate === "percent",
    );
    if (thresholdType === undefined) {
      return NextResponse.json({ error: "threshold_type must be 'absolute' or 'percent'" }, { status: 400 });
    }
    updates.threshold_type = thresholdType;
  }
  if (body.threshold_value !== undefined) {
    if (body.threshold_value === null || body.threshold_value === "") {
      updates.threshold_value = null;
    } else {
      const parsed = Number(body.threshold_value);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100000) {
        return NextResponse.json({ error: "threshold_value must be a positive number" }, { status: 400 });
      }
      updates.threshold_value = Math.round(parsed * 100) / 100;
    }
  }
  if (body.remedy_text !== undefined) {
    const remedy = trimmedOrNull(body.remedy_text, 1000);
    if (remedy === undefined) {
      return NextResponse.json({ error: "The remedy text is limited to 1000 characters" }, { status: 400 });
    }
    updates.remedy_text = remedy;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const { error } = await admin
    .from("guarantee_settings")
    .upsert(
      {
        id: 1,
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      },
      { onConflict: "id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const settings = await loadGuaranteeSettings(admin);
    return NextResponse.json({ settings, configured: isGuaranteeConfigured(settings) });
  } catch (loadError) {
    return NextResponse.json(
      { error: loadError instanceof Error ? loadError.message : "Guarantee settings could not be reloaded" },
      { status: 500 },
    );
  }
}
