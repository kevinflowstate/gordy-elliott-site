import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getProgrammeAIUsage } from "@/lib/programme-ai";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id, programme_type")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  return NextResponse.json(await getProgrammeAIUsage(admin, profile.id, profile.programme_type || "capacity"));
}
