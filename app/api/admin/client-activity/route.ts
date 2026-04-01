import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

interface ActivityEvent {
  type: string;
  description: string;
  timestamp: string;
  color: string;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  const admin = createAdminClient();
  const events: ActivityEvent[] = [];

  // 1. Account created - from client_profiles
  const { data: profile } = await admin
    .from("client_profiles")
    .select("created_at")
    .eq("id", clientId)
    .single();

  if (profile?.created_at) {
    events.push({
      type: "account_created",
      description: "Account created",
      timestamp: profile.created_at,
      color: "bg-gray-400",
    });
  }

  // 2. Check-ins submitted + reviewed
  const { data: checkins } = await admin
    .from("checkins")
    .select("id, created_at, week_number, mood, admin_reply, replied_at, responses")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  for (const c of checkins || []) {
    const moodLabel = c.mood ? ` (${c.mood})` : "";
    events.push({
      type: "checkin_submitted",
      description: `Check-in submitted — Week ${c.week_number}${moodLabel}`,
      timestamp: c.created_at,
      color: "bg-blue-400",
    });

    if (c.admin_reply && c.replied_at) {
      events.push({
        type: "checkin_reviewed",
        description: `Check-in reviewed — Week ${c.week_number}`,
        timestamp: c.replied_at,
        color: "bg-emerald-400",
      });
    }

    // 6. Weight recorded - extract from checkin responses
    const responses = c.responses as Record<string, string> | null;
    const weightVal = responses?.weight || responses?.current_weight;
    if (weightVal && !isNaN(parseFloat(weightVal))) {
      events.push({
        type: "weight_recorded",
        description: `Weight recorded — ${parseFloat(weightVal).toFixed(1)} kg`,
        timestamp: c.created_at,
        color: "bg-teal-400",
      });
    }
  }

  // 3. Training plan assigned
  const { data: exercisePlans } = await admin
    .from("client_exercise_plans")
    .select("id, created_at, name")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  for (const p of exercisePlans || []) {
    events.push({
      type: "training_plan_assigned",
      description: `Training plan assigned — ${p.name || "Exercise Plan"}`,
      timestamp: p.created_at,
      color: "bg-[#E2B830]",
    });
  }

  // 4. Nutrition plan assigned
  const { data: nutritionPlans } = await admin
    .from("client_nutrition_plans")
    .select("id, created_at, name")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  for (const p of nutritionPlans || []) {
    events.push({
      type: "nutrition_plan_assigned",
      description: `Nutrition plan assigned — ${p.name || "Nutrition Plan"}`,
      timestamp: p.created_at,
      color: "bg-[#E2B830]",
    });
  }

  // 5. Exercise logged
  const { data: exerciseLogs } = await admin
    .from("client_exercise_logs")
    .select("id, log_date, created_at")
    .eq("client_id", clientId)
    .order("log_date", { ascending: false })
    .limit(30);

  // Group logs by date to avoid one event per exercise
  const logDates = new Map<string, string>();
  for (const l of exerciseLogs || []) {
    const dateKey = l.log_date || l.created_at?.split("T")[0];
    if (dateKey && !logDates.has(dateKey)) {
      logDates.set(dateKey, l.created_at || `${dateKey}T12:00:00.000Z`);
    }
  }

  for (const [dateKey, ts] of logDates.entries()) {
    const label = new Date(dateKey).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    events.push({
      type: "exercise_logged",
      description: `Exercise logged — ${label}`,
      timestamp: ts,
      color: "bg-purple-400",
    });
  }

  // Sort by timestamp descending, limit to 50
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const limited = events.slice(0, 50);

  return NextResponse.json({ events: limited });
}
