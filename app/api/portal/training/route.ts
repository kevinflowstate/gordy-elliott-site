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
  const programme = normalizeProgrammeType(profile?.programme_type);

  const { data: modules } = await admin
    .from("training_modules")
    .select("*, content:module_content(*)")
    .eq("is_published", true)
    .contains("programme_audiences", [programme])
    .order("order_index");

  return NextResponse.json({ modules: modules || [], programme });
}
