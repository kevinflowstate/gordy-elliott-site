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
  if (profileError) {
    console.error("capacity-baseline profile load failed:", profileError.message);
    return NextResponse.json({ error: "Baseline could not be loaded" }, { status: 500 });
  }
  if (!profile) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  if (profile.experience_mode !== "founder_dashboard") {
    return NextResponse.json({ error: "Baseline comparison is not available in this experience" }, { status: 403 });
  }

  try {
    const [result, reviewRes] = await Promise.all([
      loadBaselineComparison(admin, profile.id),
      admin
        .from("client_month4_reviews")
        .select("review_date, outcome_note, completed_at, baseline_comparison")
        .eq("client_id", profile.id)
        .eq("status", "completed")
        .maybeSingle(),
    ]);
    if (reviewRes.error) {
      console.error("capacity-baseline month4 review load failed:", reviewRes.error.message);
      return NextResponse.json({ error: "Baseline could not be loaded" }, { status: 500 });
    }
    const review = reviewRes.data;
    const month4Review = review && review.outcome_note
      ? {
          review_date: String(review.review_date).slice(0, 10),
          outcome_note: review.outcome_note,
          completed_at: review.completed_at,
          source_period: review.baseline_comparison?.source_period ?? null,
          comparison_period: review.baseline_comparison?.comparison_period ?? null,
        }
      : null;
    if (result.baseline?.status !== "locked") {
      return NextResponse.json({
        baseline: null,
        current: result.current,
        comparison: null,
        month4Review,
      });
    }
    return NextResponse.json({ ...result, month4Review });
  } catch (error) {
    console.error("capacity-baseline load failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Baseline could not be loaded" }, { status: 500 });
  }
}
