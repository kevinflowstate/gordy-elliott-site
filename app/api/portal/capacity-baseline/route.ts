import { loadBaselineComparison } from "@/lib/capacity-baseline-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("client_profiles")
    .select("id, experience_mode")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  if (profile.experience_mode !== "founder_dashboard") {
    return NextResponse.json({ error: "Baseline comparison is not available in this experience" }, { status: 403 });
  }

  try {
    const result = await loadBaselineComparison(admin, profile.id);
    if (result.baseline?.status !== "locked") {
      return NextResponse.json({
        baseline: null,
        current: result.current,
        comparison: null,
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Baseline could not be loaded" }, { status: 500 });
  }
}
