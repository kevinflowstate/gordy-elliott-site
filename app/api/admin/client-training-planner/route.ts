import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadWeeklyTrainingAssignments, normaliseWeekStart } from "@/lib/training-planner";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const requestedPlanId = searchParams.get("planId");
  const weekStart = normaliseWeekStart(searchParams.get("weekStart") || searchParams.get("week_start"));

  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  const admin = createAdminClient();
  let planQuery = admin
    .from("client_exercise_plans")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (requestedPlanId) planQuery = planQuery.eq("id", requestedPlanId);

  const { data: plans, error: planError } = await planQuery.limit(1);
  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

  const plan = plans?.[0] || null;
  if (!plan) return NextResponse.json({ assignments: [], plan_id: null, week_start: weekStart });

  const { data: sessions, error: sessionError } = await admin
    .from("client_exercise_sessions")
    .select("id")
    .eq("plan_id", plan.id)
    .order("day_number", { ascending: true });

  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });

  const { assignments, error } = await loadWeeklyTrainingAssignments(admin, {
    clientId,
    planId: plan.id,
    weekStart,
    sessionIds: (sessions || []).map((session: { id: string }) => session.id),
  });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ assignments, plan_id: plan.id, week_start: weekStart });
}
