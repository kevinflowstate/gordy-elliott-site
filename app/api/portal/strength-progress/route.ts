import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadClientStrengthProgress } from "@/lib/strength-progress-server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });

  try {
    return NextResponse.json(await loadClientStrengthProgress(admin, profile.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Strength progress could not be loaded" },
      { status: 500 },
    );
  }
}
