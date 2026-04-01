import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

async function getClientProfile(userId: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", userId)
    .single();
  return profile;
}

// GET: fetch exercise logs for a client for a given date
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const profile = await getClientProfile(user.id);
  if (!profile) return NextResponse.json({ error: "No profile found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_exercise_logs")
    .select("*")
    .eq("client_id", profile.id)
    .eq("log_date", date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data || [] });
}

// POST: create/update an exercise log entry
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const profile = await getClientProfile(user.id);
  if (!profile) return NextResponse.json({ error: "No profile found" }, { status: 404 });

  const body = await request.json();
  const { exercise_item_id, session_id, date, sets_data, completed, notes } = body;

  if (!exercise_item_id) {
    return NextResponse.json({ error: "exercise_item_id is required" }, { status: 400 });
  }

  const log_date = date || new Date().toISOString().split("T")[0];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_exercise_logs")
    .upsert(
      {
        client_id: profile.id,
        exercise_item_id,
        session_id: session_id || null,
        log_date,
        sets_data: sets_data || [],
        completed: completed ?? false,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,exercise_item_id,log_date" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}
