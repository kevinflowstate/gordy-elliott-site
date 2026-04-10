import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ results: null });
  }

  // Get the most recent completed result
  const { data: results } = await admin
    .from("values_determination_results")
    .select("*")
    .eq("client_id", profile.id)
    .order("completed_at", { ascending: false })
    .limit(1);

  return NextResponse.json({
    results: results?.[0] || null,
    profileId: profile.id,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const body = await request.json();
  const { answers, valuesHierarchy, alignmentScore } = body;

  // Get profile
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("values_determination_results")
    .insert({
      client_id: profile.id,
      answers,
      values_hierarchy: valuesHierarchy,
      alignment_score: alignmentScore,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ result: data });
}
