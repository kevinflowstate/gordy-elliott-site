import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { programmeShowsPortalPath } from "@/lib/programmes";
import { isDateKey } from "@/lib/nutrition-history";
import { loadPreviousExerciseLoads } from "@/lib/workout-previous-loads-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const sessionId = params.get("session_id") || "";
  const before = params.get("before") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId) || !isDateKey(before)) return NextResponse.json({ error: "Choose a valid workout and date." }, { status: 400 });
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin.from("client_profiles")
    .select("id, programme_type, fitness_plans_enabled").eq("user_id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Couldn't verify your account." }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  if (!programmeShowsPortalPath(profile.programme_type, "/portal/exercise-plan", profile.fitness_plans_enabled === true)) return NextResponse.json({ error: "Plans are not enabled for your programme" }, { status: 403 });
  const { data: session, error: sessionError } = await admin.from("client_exercise_sessions").select("plan_id").eq("id", sessionId).maybeSingle();
  if (sessionError) return NextResponse.json({ error: "Couldn't verify the workout." }, { status: 500 });
  const { data: plan, error: planError } = session ? await admin.from("client_exercise_plans").select("id")
    .eq("id", session.plan_id).eq("client_id", profile.id).eq("status", "active").maybeSingle() : { data: null, error: null };
  if (planError) return NextResponse.json({ error: "Couldn't verify the training plan." }, { status: 500 });
  if (!plan) return NextResponse.json({ error: "Workout not found" }, { status: 404 });
  try {
    const previousLoads = await loadPreviousExerciseLoads(admin, profile.id, plan.id, sessionId, before);
    return NextResponse.json({ previousLoads }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Previous weights could not load." }, { status: 500 });
  }
}
