import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeProgrammeType } from "@/lib/programmes";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await admin
    .from("client_profiles")
    .select("programme_type")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  const programme = normalizeProgrammeType(profile?.programme_type);

  const { data: modules, error } = await admin
    .from("training_modules")
    .select("*, content:module_content(*)")
    .eq("is_published", true)
    .contains("programme_audiences", [programme])
    .order("order_index");

  if (error) return NextResponse.json({ error: "Could not load education hub" }, { status: 500 });
  return NextResponse.json({ modules: modules || [], programme });
}
