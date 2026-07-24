import { requireAdmin } from "@/lib/admin-auth";
import { parseBoundedCapacityMetric } from "@/lib/capacity-baseline";
import {
  EARLY_WIN_SOURCED_METRICS,
  dateKeyOrdinal,
  isEarlyWinMetricKey,
  londonDateKey,
  type EarlyWinMetricKey,
} from "@/lib/early-win";
import { loadActiveEarlyWinView, loadCompletedEarlyWins } from "@/lib/early-win-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MANUAL_VALUE_BOUND = 100000;

function parseDateKey(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ordinal = dateKeyOrdinal(value);
  if (ordinal === null) return null;
  // Round-trip so rolled-over dates like 2026-02-30 are rejected as 400s
  // instead of surviving until Postgres rejects the literal with a 500.
  const roundTrip = new Date(ordinal * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return roundTrip === value ? value : null;
}

function parseMetricValue(metricKey: EarlyWinMetricKey, value: unknown) {
  if (metricKey === "manual") {
    return parseBoundedCapacityMetric(value, -MANUAL_VALUE_BOUND, MANUAL_VALUE_BOUND);
  }
  const bounds = EARLY_WIN_SOURCED_METRICS[metricKey];
  return parseBoundedCapacityMetric(value, bounds.min, bounds.max);
}

function trimmedOrNull(value: unknown, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? undefined : trimmed;
}

async function getProfile(admin: ReturnType<typeof createAdminClient>, clientId: string) {
  return admin
    .from("client_profiles")
    .select("id, experience_mode")
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
    const [active, completed] = await Promise.all([
      loadActiveEarlyWinView(admin, clientId),
      loadCompletedEarlyWins(admin, clientId),
    ]);
    return NextResponse.json({ active, completed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Early win could not be loaded" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  const metricKeyRaw: unknown = body.metric_key;
  if (!isEarlyWinMetricKey(metricKeyRaw)) {
    return NextResponse.json({ error: "Choose a supported metric" }, { status: 400 });
  }
  const metricKey = metricKeyRaw;

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await getProfile(admin, clientId);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const existing = await admin
    .from("client_early_wins")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
  if (existing.data) {
    return NextResponse.json({ error: "This client already has an active early win. Complete its review first." }, { status: 409 });
  }

  let source: string;
  let displayLabel: string | null | undefined;
  let unit: string | null | undefined;
  if (metricKey === "manual") {
    source = "manual";
    displayLabel = trimmedOrNull(body.display_label, 80);
    unit = trimmedOrNull(body.unit, 20);
    if (!displayLabel || !unit) {
      return NextResponse.json({ error: "A manual metric needs a label (up to 80 characters) and a unit (up to 20)" }, { status: 400 });
    }
  } else {
    const catalogue = EARLY_WIN_SOURCED_METRICS[metricKey];
    source = catalogue.source;
    displayLabel = trimmedOrNull(body.display_label, 80) ?? catalogue.label;
    unit = catalogue.unit;
    if (displayLabel === undefined) {
      return NextResponse.json({ error: "The display label is limited to 80 characters" }, { status: 400 });
    }
  }

  const startingValue = parseMetricValue(metricKey, body.starting_value);
  const targetValue = parseMetricValue(metricKey, body.target_value);
  if (startingValue === null || startingValue === undefined || targetValue === null || targetValue === undefined) {
    return NextResponse.json({ error: "Starting and target values are required and must be within the allowed range" }, { status: 400 });
  }

  const today = londonDateKey(new Date());
  const startDate = body.start_date === undefined || body.start_date === "" ? today : parseDateKey(body.start_date);
  if (!startDate) return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  const startOrdinal = dateKeyOrdinal(startDate);
  const todayOrdinal = dateKeyOrdinal(today);
  if (startOrdinal === null || todayOrdinal === null || Math.abs(startOrdinal - todayOrdinal) > 90) {
    return NextResponse.json({ error: "The start date must be within 90 days of today" }, { status: 400 });
  }

  const coachingNote = trimmedOrNull(body.coaching_note, 500);
  if (coachingNote === undefined) {
    return NextResponse.json({ error: "The coaching note is limited to 500 characters" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("client_early_wins")
    .insert({
      client_id: clientId,
      metric_key: metricKey,
      source,
      display_label: displayLabel,
      unit,
      starting_value: startingValue,
      target_value: targetValue,
      start_date: startDate,
      coaching_note: coachingNote,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ earlyWin: data });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const earlyWinId = typeof body.early_win_id === "string" ? body.early_win_id : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!earlyWinId) return NextResponse.json({ error: "early_win_id is required" }, { status: 400 });
  if (action !== "log_value" && action !== "complete_review") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: earlyWin, error: winError } = await admin
    .from("client_early_wins")
    .select("*")
    .eq("id", earlyWinId)
    .maybeSingle();
  if (winError) return NextResponse.json({ error: winError.message }, { status: 500 });
  if (!earlyWin) return NextResponse.json({ error: "Early win not found" }, { status: 404 });
  if (earlyWin.status !== "active") {
    return NextResponse.json({ error: "This early win is already completed and cannot be changed" }, { status: 409 });
  }

  if (action === "log_value") {
    if (earlyWin.source !== "manual") {
      return NextResponse.json({ error: "Values for this metric come from connected data, not manual entries" }, { status: 400 });
    }
    const value = parseMetricValue("manual", body.value);
    if (value === null || value === undefined) {
      return NextResponse.json({ error: "A value within the allowed range is required" }, { status: 400 });
    }
    const today = londonDateKey(new Date());
    const entryDate = body.entry_date === undefined || body.entry_date === "" ? today : parseDateKey(body.entry_date);
    if (!entryDate) return NextResponse.json({ error: "Invalid entry date" }, { status: 400 });
    if (entryDate > today || entryDate < String(earlyWin.start_date).slice(0, 10)) {
      return NextResponse.json({ error: "The entry date must be between the start date and today" }, { status: 400 });
    }

    const { error } = await admin
      .from("client_early_win_entries")
      .upsert({ early_win_id: earlyWinId, entry_date: entryDate, value }, { onConflict: "early_win_id,entry_date" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const view = await loadActiveEarlyWinView(admin, earlyWin.client_id).catch(() => null);
    return NextResponse.json({ active: view });
  }

  const outcome = trimmedOrNull(body.review_outcome, 1000);
  if (!outcome) {
    return NextResponse.json({ error: "A review outcome note (up to 1000 characters) is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await admin
    .from("client_early_wins")
    .update({
      status: "completed",
      review_outcome: outcome,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", earlyWinId)
    .eq("status", "active")
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ earlyWin: data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const earlyWinId = new URL(request.url).searchParams.get("early_win_id");
  if (!earlyWinId) return NextResponse.json({ error: "early_win_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: earlyWin, error: winError } = await admin
    .from("client_early_wins")
    .select("id, status")
    .eq("id", earlyWinId)
    .maybeSingle();
  if (winError) return NextResponse.json({ error: winError.message }, { status: 500 });
  if (!earlyWin) return NextResponse.json({ error: "Early win not found" }, { status: 404 });
  if (earlyWin.status !== "active") {
    return NextResponse.json({ error: "Completed early wins are kept as history and cannot be removed" }, { status: 409 });
  }

  const { error } = await admin.from("client_early_wins").delete().eq("id", earlyWinId).eq("status", "active");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ removed: true });
}
