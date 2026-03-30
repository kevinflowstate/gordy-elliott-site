import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
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

  // Get sessions
  const { data: sessions } = await admin
    .from("client_exercise_sessions")
    .select("*")
    .eq("plan_id", plan.id)
    .order("day_number", { ascending: true });

  const sessionIds = (sessions || []).map((s) => s.id);

  // Get items joined with exercises
  const { data: items } = sessionIds.length
    ? await admin
        .from("client_exercise_session_items")
        .select("*, exercise:exercises(id, name, muscle_group, equipment, description)")
        .in("session_id", sessionIds)
        .order("order_index", { ascending: true })
    : { data: [] };

  // Assemble
  const itemsBySession = new Map<string, typeof items>();
  for (const item of items || []) {
    const list = itemsBySession.get(item.session_id) || [];
    list.push(item);
    itemsBySession.set(item.session_id, list);
  }

  const assembled = {
    ...plan,
    sessions: (sessions || []).map((s) => ({
      ...s,
      items: itemsBySession.get(s.id) || [],
    })),
  };

  return NextResponse.json({ plan: assembled });
}
