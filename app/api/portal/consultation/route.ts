import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api-errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("consultation_data, date_of_birth")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    consultation_data: profile?.consultation_data || null,
    date_of_birth: profile?.date_of_birth || "",
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();

  // Only allow known consultation fields
  const allowed = [
    "fitness_level",
    "primary_goal",
    "training_days",
    "equipment_access",
    "dietary_preferences",
    "injuries",
    "supplements",
    "additional_info",
    "date_of_birth",
  ];

  const consultationData: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) consultationData[key] = body[key];
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("client_profiles")
    .update({
      consultation_data: consultationData,
      date_of_birth: typeof body.date_of_birth === "string" && body.date_of_birth ? body.date_of_birth : null,
    })
    .eq("user_id", user.id);

  if (error) {
    return dbError(error, "Couldn't save your consultation. Try again.");
  }

  return NextResponse.json({ success: true });
}
