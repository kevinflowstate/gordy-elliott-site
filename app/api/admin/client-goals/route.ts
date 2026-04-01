import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_profiles")
    .select("primary_goal, target_date, goal_notes")
    .eq("id", clientId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ goals: data });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { client_id, primary_goal, target_date, goal_notes } = body;
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("client_profiles")
    .update({ primary_goal: primary_goal || null, target_date: target_date || null, goal_notes: goal_notes || null })
    .eq("id", client_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
