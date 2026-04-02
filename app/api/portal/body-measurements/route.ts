import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

async function getClientProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  return profile;
}

// GET: Fetch measurement history (most recent first)
export async function GET() {
  const profile = await getClientProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_body_measurements")
    .select("*")
    .eq("client_id", profile.id)
    .order("measured_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ measurements: data || [] });
}

// POST: Add a new measurement entry
export async function POST(request: Request) {
  const profile = await getClientProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const body = await request.json();
  const {
    measured_date,
    weight_kg,
    waist_cm,
    chest_cm,
    hips_cm,
    left_arm_cm,
    right_arm_cm,
    left_thigh_cm,
    right_thigh_cm,
    notes,
  } = body;

  const date = measured_date || new Date().toISOString().split("T")[0];

  const { data, error } = await admin
    .from("client_body_measurements")
    .insert({
      client_id: profile.id,
      measured_date: date,
      weight_kg: weight_kg ?? null,
      waist_cm: waist_cm ?? null,
      chest_cm: chest_cm ?? null,
      hips_cm: hips_cm ?? null,
      left_arm_cm: left_arm_cm ?? null,
      right_arm_cm: right_arm_cm ?? null,
      left_thigh_cm: left_thigh_cm ?? null,
      right_thigh_cm: right_thigh_cm ?? null,
      notes: notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ measurement: data });
}

// DELETE: Remove a measurement by id
export async function DELETE(request: Request) {
  const profile = await getClientProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await admin
    .from("client_body_measurements")
    .delete()
    .eq("id", body.id)
    .eq("client_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
