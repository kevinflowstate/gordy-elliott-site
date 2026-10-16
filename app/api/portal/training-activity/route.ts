import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { manualActivityError } from "@/lib/training-calendar";
import { programmeAddDays, programmeDateDay, programmeToday } from "@/lib/exercise-programme";
import { NextResponse } from "next/server";

async function portalContext() {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const db = createAdminClient();
  const { data: profile } = await db
    .from("client_profiles")
    .select("id, programme_type, fitness_plans_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile || (profile.programme_type === "boardroom" && !profile.fitness_plans_enabled)) {
    return { error: NextResponse.json({ error: "Training access unavailable" }, { status: 403 }) };
  }
  const { data: plan } = await db
    .from("client_exercise_plans")
    .select("programme_timezone")
    .eq("client_id", profile.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { db, profile, user, today: programmeToday(plan?.programme_timezone || "Europe/London") };
}

export async function GET(request: Request) {
  const context = await portalContext();
  if ("error" in context) return context.error;
  const search = new URL(request.url).searchParams;
  const to = search.get("to") || context.today;
  const from = search.get("from") || programmeAddDays(to, -6);
  const fromDay = programmeDateDay(from);
  const toDay = programmeDateDay(to);
  if (fromDay === null || toDay === null || toDay < fromDay || toDay - fromDay > 366) {
    return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
  }
  const { data, error } = await context.db
    .from("client_manual_training_activity")
    .select("*")
    .eq("client_id", context.profile.id)
    .gte("activity_date", from)
    .lte("activity_date", to)
    .order("activity_date", { ascending: false });
  if (error) return NextResponse.json({ error: "Couldn't load your activity." }, { status: 500 });
  return NextResponse.json({ activities: data || [], today: context.today });
}

export async function POST(request: Request) {
  const context = await portalContext();
  if ("error" in context) return context.error;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Choose activity details." }, { status: 400 });
  const invalid = manualActivityError(body.activity_date, body.kind, body.duration_minutes, body.notes, context.today);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  const minutes = body.kind === "rest" || body.duration_minutes === null || body.duration_minutes === "" || body.duration_minutes === undefined
    ? null
    : Number(body.duration_minutes);
  const { data, error } = await context.db.rpc("save_manual_training_activity", {
    p_user_id: context.user.id,
    p_date: body.activity_date,
    p_kind: body.kind,
    p_minutes: minutes,
    p_notes: typeof body.notes === "string" ? body.notes.trim() : "",
    p_today: context.today,
  });
  if (error) {
    if (error.code === "P0001") return NextResponse.json({ error: `${error.message}.` }, { status: 409 });
    console.error("manual training activity save failed:", error.message);
    return NextResponse.json({ error: "Couldn't save this entry. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ activity: data });
}

export async function DELETE(request: Request) {
  const context = await portalContext();
  if ("error" in context) return context.error;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.activity_date !== "string" || programmeDateDay(body.activity_date) === null) {
    return NextResponse.json({ error: "Choose a valid date." }, { status: 400 });
  }
  const { error } = await context.db
    .from("client_manual_training_activity")
    .delete()
    .eq("client_id", context.profile.id)
    .eq("activity_date", body.activity_date);
  if (error) return NextResponse.json({ error: "Couldn't remove this entry." }, { status: 500 });
  return NextResponse.json({ success: true });
}
