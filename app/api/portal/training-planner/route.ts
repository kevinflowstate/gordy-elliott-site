import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  loadWeeklyTrainingAssignments,
  normaliseWeekStart,
  parsePlannerDate,
  plannedDateIsInWeek,
} from "@/lib/training-planner";
import { NextResponse } from "next/server";

async function getPortalClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return { error: NextResponse.json({ error: "No profile found" }, { status: 404 }) };
  return { admin, profile };
}

async function getActivePlan(admin: ReturnType<typeof createAdminClient>, clientId: string, planId?: string | null) {
  let query = admin
    .from("client_exercise_plans")
    .select("id, client_id, status")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (planId) query = query.eq("id", planId);

  const { data: plans, error } = await query.limit(1);
  if (error) return { plan: null, error: error.message };
  return { plan: plans?.[0] || null, error: null };
}

async function getPlanSessionIds(admin: ReturnType<typeof createAdminClient>, planId: string) {
  const { data: sessions, error } = await admin
    .from("client_exercise_sessions")
    .select("id")
    .eq("plan_id", planId)
    .order("day_number", { ascending: true });

  return {
    sessionIds: (sessions || []).map((session: { id: string }) => session.id),
    error: error?.message || null,
  };
}

export async function GET(request: Request) {
  const portal = await getPortalClient();
  if ("error" in portal) return portal.error;

  const { searchParams } = new URL(request.url);
  const weekStart = normaliseWeekStart(searchParams.get("week_start"));
  const requestedPlanId = searchParams.get("plan_id");

  const { plan, error: planError } = await getActivePlan(portal.admin, portal.profile.id, requestedPlanId);
  if (planError) return NextResponse.json({ error: planError }, { status: 500 });
  if (!plan) return NextResponse.json({ assignments: [], plan_id: null, week_start: weekStart });

  const { sessionIds, error: sessionError } = await getPlanSessionIds(portal.admin, plan.id);
  if (sessionError) return NextResponse.json({ error: sessionError }, { status: 500 });

  const { assignments, error } = await loadWeeklyTrainingAssignments(portal.admin, {
    clientId: portal.profile.id,
    planId: plan.id,
    weekStart,
    sessionIds,
  });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ assignments, plan_id: plan.id, week_start: weekStart });
}

export async function POST(request: Request) {
  const portal = await getPortalClient();
  if ("error" in portal) return portal.error;

  const body = await request.json().catch(() => ({}));
  const weekStart = normaliseWeekStart(body.week_start);
  const plannedDate = typeof body.planned_date === "string" && body.planned_date.length > 0 ? body.planned_date : null;
  const planId = typeof body.plan_id === "string" ? body.plan_id : null;
  const sessionId = typeof body.session_id === "string" ? body.session_id : null;
  const isRecurring = Boolean(body.is_recurring);
  const recurrenceStopped = Boolean(body.recurrence_stopped);

  if (!sessionId) return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  if (plannedDate && !parsePlannerDate(plannedDate)) return NextResponse.json({ error: "planned_date is invalid" }, { status: 400 });
  if (!plannedDateIsInWeek(weekStart, plannedDate)) {
    return NextResponse.json({ error: "planned_date must be in the selected week" }, { status: 400 });
  }

  const { plan, error: planError } = await getActivePlan(portal.admin, portal.profile.id, planId);
  if (planError) return NextResponse.json({ error: planError }, { status: 500 });
  if (!plan) return NextResponse.json({ error: "Active plan not found" }, { status: 404 });

  const { sessionIds, error: sessionError } = await getPlanSessionIds(portal.admin, plan.id);
  if (sessionError) return NextResponse.json({ error: sessionError }, { status: 500 });
  if (!sessionIds.includes(sessionId)) return NextResponse.json({ error: "Session not found on active plan" }, { status: 404 });

  if (plannedDate) {
    const { data: existingDayAssignment, error: existingDayError } = await portal.admin
      .from("client_training_weekly_assignments")
      .select("session_id")
      .eq("client_id", portal.profile.id)
      .eq("plan_id", plan.id)
      .eq("week_start", weekStart)
      .eq("planned_date", plannedDate)
      .neq("session_id", sessionId)
      .maybeSingle();

    if (existingDayError) return NextResponse.json({ error: existingDayError.message }, { status: 500 });
    if (existingDayAssignment) {
      return NextResponse.json({ error: "That day already has a planned session" }, { status: 409 });
    }
  }

  const { data, error } = await portal.admin
    .from("client_training_weekly_assignments")
    .upsert(
      {
        client_id: portal.profile.id,
        plan_id: plan.id,
        session_id: sessionId,
        week_start: weekStart,
        planned_date: plannedDate,
        is_recurring: plannedDate ? isRecurring : false,
        recurrence_stopped: recurrenceStopped,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,plan_id,session_id,week_start" },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: { ...data, source: "explicit" } });
}
