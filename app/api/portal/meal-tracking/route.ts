import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// POST: Toggle meal completion for today
export async function POST(request: Request) {
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

  const body = await request.json();
  const { meal_id, completed, date } = body;

  if (!meal_id || completed === undefined) {
    return NextResponse.json({ error: "meal_id and completed are required" }, { status: 400 });
  }

  const tracked_date = date || new Date().toISOString().split("T")[0];

  // Upsert tracking record
  const { data, error } = await admin
    .from("client_meal_tracking")
    .upsert(
      {
        client_id: profile.id,
        meal_id,
        tracked_date,
        completed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,meal_id,tracked_date" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tracking: data });
}
