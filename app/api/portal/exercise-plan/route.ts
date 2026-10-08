import { loadExerciseSessionItems } from "@/lib/exercise-session-load";
import { programmeToday, programmeWeek, programmeWeeksInRange, programmeCalendarWeekStart, programmeAddDays } from "@/lib/exercise-programme";
import { createExerciseSectionDivider } from "@/lib/exercise-section";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();

  // Get client profile
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "No profile found" }, { status: 404 });

  // Get active exercise plan
  const { data: plans } = await admin
    .from("client_exercise_plans")
    .select("*")
    .eq("client_id", profile.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!plans || plans.length === 0) return NextResponse.json({ plan: null });

  const plan = plans[0];

  const search = new URL(request.url).searchParams;
  const today = programmeToday(plan.programme_timezone);
  const defaultFrom = programmeCalendarWeekStart(today);
  const from = search.get("from") || defaultFrom;
  let to: string;
  let weeks: number[];
  try { to = search.get("to") || programmeAddDays(from, 6); weeks = programmeWeeksInRange({ ...plan, sessions: [] }, from, to); }
  catch { return NextResponse.json({ error: "Choose up to seven valid workout dates." }, { status: 400 }); }

  // Load only the requested programme dates, including historical weeks. Static plans remain unchanged.
  let sessionQuery = admin
    .from("client_exercise_sessions")
    .select("*")
    .eq("plan_id", plan.id)
    .order("day_number", { ascending: true });
  if (plan.programme_weeks) sessionQuery = sessionQuery.in("week_number", weeks);
  const { data: sessions, error: sessionError } = await sessionQuery;
  if (sessionError) return NextResponse.json({ error: "Couldn't load training sessions." }, { status: 500 });

  const sessionIds = (sessions || []).map((s) => s.id);

  // Get items joined with exercises
  const { data: items, error: itemsError } = await loadExerciseSessionItems(admin, sessionIds);
  if (itemsError) return NextResponse.json({ error: "Couldn't load training exercises." }, { status: 500 });

  // Assemble (reconstruct section dividers from section_label)
  const itemsBySession = new Map<string, typeof items>();
  for (const item of items || []) {
    const list = itemsBySession.get(item.session_id) || [];
    if (item.section_label) {
      list.push(createExerciseSectionDivider({ ...item, section_label: item.section_label }));
    }
    list.push(item);
    itemsBySession.set(item.session_id, list);
  }

  const assembled = {
    ...plan,
    current_week: programmeWeek({ ...plan, sessions: [] }, programmeToday(plan.programme_timezone)),
    sessions: (sessions || []).map((s) => ({
      ...s,
      items: itemsBySession.get(s.id) || [],
    })),
  };

  return NextResponse.json({ plan: assembled, from, to, today });
}
