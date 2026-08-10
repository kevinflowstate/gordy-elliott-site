import { dateKeyInTimeZone } from "@/lib/founder-dashboard";
import { requestTerraNutritionData } from "@/lib/terra/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });

  const { data: connection, error } = await admin
    .from("client_wearable_connections")
    .select("terra_user_id, status, consented_at")
    .eq("client_id", profile.id)
    .eq("provider", "myfitnesspal")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!connection?.consented_at || connection.status !== "connected" || !connection.terra_user_id) {
    return NextResponse.json({ error: "MyFitnessPal is not connected." }, { status: 409 });
  }

  const now = new Date();
  const startDate = dateKeyInTimeZone(new Date(now.getTime() - DAY_MS), "Europe/London");
  const endDate = dateKeyInTimeZone(now, "Europe/London");

  try {
    await requestTerraNutritionData(connection.terra_user_id, startDate, endDate);
    return NextResponse.json({ accepted: true, startDate, endDate }, { status: 202 });
  } catch (syncError) {
    console.error("Terra nutrition sync request failed", syncError);
    return NextResponse.json({ error: "MyFitnessPal data could not be requested yet." }, { status: 502 });
  }
}
