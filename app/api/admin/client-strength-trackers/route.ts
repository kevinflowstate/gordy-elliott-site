import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  STRENGTH_METRIC_TYPES,
  type StrengthMetricType,
} from "@/lib/strength-progress";
import {
  loadAvailableStrengthExercises,
  loadClientStrengthProgress,
} from "@/lib/strength-progress-server";
import { NextResponse } from "next/server";

function isMetricType(value: unknown): value is StrengthMetricType {
  return typeof value === "string" &&
    (STRENGTH_METRIC_TYPES as readonly string[]).includes(value);
}

async function validateClientExercise(clientId: string, exerciseId: string) {
  const admin = createAdminClient();
  const available = await loadAvailableStrengthExercises(admin, clientId);
  return available.some((exercise) => exercise.id === exerciseId);
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  const admin = createAdminClient();
  try {
    const [availableExercises, progress] = await Promise.all([
      loadAvailableStrengthExercises(admin, clientId),
      loadClientStrengthProgress(admin, clientId),
    ]);
    return NextResponse.json({ availableExercises, ...progress });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Strength trackers could not be loaded" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const exerciseId = typeof body.exercise_id === "string" ? body.exercise_id : "";
  const metricType = body.metric_type;
  if (!clientId || !exerciseId || !isMetricType(metricType)) {
    return NextResponse.json({ error: "client_id, exercise_id and a valid metric_type are required" }, { status: 400 });
  }

  try {
    if (!await validateClientExercise(clientId, exerciseId)) {
      return NextResponse.json({ error: "Choose an exercise from this client's active plan" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: active, error: activeError } = await admin
      .from("client_strength_trackers")
      .select("id, exercise_id, order_index")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("order_index", { ascending: true });
    if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 });
    if ((active || []).length >= 5 && !(active || []).some((tracker) => tracker.exercise_id === exerciseId)) {
      return NextResponse.json({ error: "Choose no more than five active movements" }, { status: 409 });
    }

    const existingOrder = (active || []).find((tracker) => tracker.exercise_id === exerciseId)?.order_index;
    const nextOrder = existingOrder ?? Math.min(4, (active || []).length);
    const { data, error } = await admin
      .from("client_strength_trackers")
      .upsert({
        client_id: clientId,
        exercise_id: exerciseId,
        metric_type: metricType,
        order_index: nextOrder,
        is_active: true,
        retired_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_id,exercise_id" })
      .select("*")
      .single();
    if (error) {
      const status = error.message.includes("at most five") ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ tracker: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Movement could not be tracked" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const trackerId = typeof body.id === "string" ? body.id : "";
  if (!clientId || !trackerId || !isMetricType(body.metric_type)) {
    return NextResponse.json({ error: "client_id, id and a valid metric_type are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_strength_trackers")
    .update({ metric_type: body.metric_type, updated_at: new Date().toISOString() })
    .eq("id", trackerId)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Tracked movement not found" }, { status: 404 });
  return NextResponse.json({ tracker: data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const trackerId = typeof body.id === "string" ? body.id : "";
  if (!clientId || !trackerId) {
    return NextResponse.json({ error: "client_id and id are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_strength_trackers")
    .update({
      is_active: false,
      retired_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", trackerId)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Tracked movement not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
