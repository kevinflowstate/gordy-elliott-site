import { requireAdmin } from "@/lib/admin-auth";
import { londonDateKey } from "@/lib/early-win";
import { parseDateKey, trimmedOrNull } from "@/lib/founder-compliance";
import { buildMonth4Snapshot } from "@/lib/founder-compliance-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getProfile(admin: ReturnType<typeof createAdminClient>, clientId: string) {
  return admin
    .from("client_profiles")
    .select("id, start_date, experience_mode")
    .eq("id", clientId)
    .maybeSingle();
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const clientId = new URL(request.url).searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await getProfile(admin, clientId);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    const [{ data: review, error: reviewError }, liveResult] = await Promise.all([
      admin.from("client_month4_reviews").select("*").eq("client_id", clientId).maybeSingle(),
      buildMonth4Snapshot(admin, clientId, profile.start_date || null),
    ]);
    if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 });
    return NextResponse.json({
      review: review || null,
      live: "snapshot" in liveResult ? liveResult.snapshot : null,
      liveBlockedReason: "error" in liveResult ? liveResult.error : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Month 4 review could not be loaded" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await getProfile(admin, clientId);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const existing = await admin
    .from("client_month4_reviews")
    .select("id, status")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
  if (existing.data) {
    return NextResponse.json({ error: "This client already has a Month 4 review" }, { status: 409 });
  }

  const today = londonDateKey(new Date());
  const reviewDate = body.review_date === undefined || body.review_date === "" ? today : parseDateKey(body.review_date);
  if (!reviewDate) return NextResponse.json({ error: "Invalid review date" }, { status: 400 });

  const { data, error } = await admin
    .from("client_month4_reviews")
    .insert({ client_id: clientId, review_date: reviewDate })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: data });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const reviewId = typeof body.review_id === "string" ? body.review_id : "";
  if (!reviewId) return NextResponse.json({ error: "review_id is required" }, { status: 400 });
  if (body.action !== "complete") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const outcomeNote = trimmedOrNull(body.outcome_note, 1000);
  if (!outcomeNote) {
    return NextResponse.json({ error: "An outcome note (up to 1000 characters) is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: review, error: reviewError } = await admin
    .from("client_month4_reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();
  if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 });
  if (!review) return NextResponse.json({ error: "Month 4 review not found" }, { status: 404 });
  if (review.status !== "draft") {
    return NextResponse.json({ error: "This review is already completed and cannot be changed" }, { status: 409 });
  }

  const { data: profile, error: profileError } = await getProfile(admin, review.client_id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    const snapshotResult = await buildMonth4Snapshot(admin, review.client_id, profile.start_date || null);
    if ("error" in snapshotResult) {
      return NextResponse.json({ error: snapshotResult.error }, { status: 409 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await admin
      .from("client_month4_reviews")
      .update({
        status: "completed",
        baseline_comparison: snapshotResult.snapshot.baseline_comparison,
        compliance_summary: snapshotResult.snapshot.compliance_summary,
        outcome_note: outcomeNote,
        completed_at: new Date().toISOString(),
        completed_by: user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .eq("status", "draft")
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ review: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Month 4 review could not be completed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const reviewId = new URL(request.url).searchParams.get("review_id");
  if (!reviewId) return NextResponse.json({ error: "review_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: review, error: reviewError } = await admin
    .from("client_month4_reviews")
    .select("id, status")
    .eq("id", reviewId)
    .maybeSingle();
  if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 });
  if (!review) return NextResponse.json({ error: "Month 4 review not found" }, { status: 404 });
  if (review.status !== "draft") {
    return NextResponse.json({ error: "Completed reviews are kept as history and cannot be removed" }, { status: 409 });
  }

  const { error } = await admin.from("client_month4_reviews").delete().eq("id", reviewId).eq("status", "draft");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ removed: true });
}
