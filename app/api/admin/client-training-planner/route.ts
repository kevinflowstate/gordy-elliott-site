import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadWeeklyTrainingAssignments,
  normaliseWeekStart,
  parsePlannerDate,
  plannedDateIsInWeek,
} from "@/lib/training-planner";
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

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : null;
  const planId = typeof body.plan_id === "string" ? body.plan_id : null;
  if (!clientId || !planId) {
    return NextResponse.json({ error: "client_id and plan_id are required" }, { status: 400 });
  }

  const rawAssignments = Array.isArray(body.assignments) ? body.assignments : [body];
  if (rawAssignments.length === 0 || rawAssignments.length > 50) {
    return NextResponse.json({ error: "Provide between 1 and 50 assignments" }, { status: 400 });
  }

  const assignments = [];
  for (const item of rawAssignments) {
    const sessionId = typeof item.session_id === "string" ? item.session_id : null;
    const requestedWeekStart = typeof item.week_start === "string" ? item.week_start : null;
    if (!sessionId || !requestedWeekStart || !parsePlannerDate(requestedWeekStart)) {
      return NextResponse.json({ error: "Each assignment requires a valid session_id and week_start" }, { status: 400 });
    }

    const weekStart = normaliseWeekStart(requestedWeekStart);
    const plannedDate = typeof item.planned_date === "string" && item.planned_date ? item.planned_date : null;
    if (plannedDate && !parsePlannerDate(plannedDate)) {
      return NextResponse.json({ error: "planned_date is invalid" }, { status: 400 });
    }
    if (!plannedDateIsInWeek(weekStart, plannedDate)) {
      return NextResponse.json({ error: "planned_date must be in the selected week" }, { status: 400 });
    }

    assignments.push({
      session_id: sessionId,
      week_start: weekStart,
      planned_date: plannedDate,
      is_recurring: Boolean(item.is_recurring && plannedDate),
      recurrence_stopped: Boolean(item.recurrence_stopped),
    });
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("upsert_training_assignments_batch", {
    p_client_id: clientId,
    p_plan_id: planId,
    p_assignments: assignments,
  });

  if (error) {
    const status = error.code === "23505"
      ? 409
      : error.message.includes("not found")
        ? 404
        : error.message.includes("must") || error.message.includes("Assignments")
          ? 400
          : 500;
    const message = error.code === "23505" ? "A planned day can only contain one session" : error.message;
    return NextResponse.json({ error: message }, { status });
  }

  const sessionIds = assignments.map((assignment) => assignment.session_id);
  const weekStarts = [...new Set(assignments.map((assignment) => assignment.week_start))];
  const { data, error: loadError } = await admin
    .from("client_training_weekly_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("plan_id", planId)
    .in("session_id", sessionIds)
    .in("week_start", weekStarts);

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  const requestedPairs = new Set(assignments.map((assignment) => `${assignment.session_id}:${assignment.week_start}`));
  const savedAssignments = (data || [])
    .filter((assignment) => requestedPairs.has(`${assignment.session_id}:${assignment.week_start}`))
    .map((assignment) => ({ ...assignment, source: "explicit" }));
  return NextResponse.json({ assignments: savedAssignments, assignment: savedAssignments[0] || null });
}
