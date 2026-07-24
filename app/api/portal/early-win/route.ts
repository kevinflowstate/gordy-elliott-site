import { loadActiveEarlyWinView } from "@/lib/early-win-server";
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
  if (profileError) {
    console.error("early-win profile load failed:", profileError.message);
    return NextResponse.json({ error: "Early win could not be loaded" }, { status: 500 });
  }
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  if (profile.experience_mode !== "founder_dashboard") {
    return NextResponse.json({ error: "The early win view is not available in this experience" }, { status: 403 });
  }

  try {
    const view = await loadActiveEarlyWinView(admin, profile.id);
    return NextResponse.json(view || { earlyWin: null });
  } catch (error) {
    console.error("early-win view load failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Early win could not be loaded" }, { status: 500 });
  }
}
