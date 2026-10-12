import { programmeDateDay } from "@/lib/exercise-programme";
import { isWeightUnit, weightToKg } from "@/lib/weight-units";
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
    .select("id, weight_unit, programme_type")
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
  return NextResponse.json({ measurements: data || [], weightUnit: profile.weight_unit || "kg" });
}

// POST: Add a new measurement entry
export async function POST(request: Request) {
  const profile = await getClientProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const body = await request.json();
  const { measured_date, weight_kg } = body;

  if (profile.programme_type === "boardroom") return NextResponse.json({ error: "Body measurements do not apply to Boardroom" }, { status: 403 });
  if (body.weight !== undefined && (!isWeightUnit(body.weight_unit) || typeof body.weight !== "number" || !Number.isFinite(body.weight) || body.weight <= 0)) return NextResponse.json({ error: "Enter a positive weight and select kg or lb" }, { status: 400 });
  const canonicalWeight = body.weight !== undefined ? weightToKg(body.weight, body.weight_unit) : weight_kg;
  if (canonicalWeight !== undefined && canonicalWeight !== null && (typeof canonicalWeight !== "number" || !Number.isFinite(canonicalWeight) || canonicalWeight <= 0)) return NextResponse.json({ error: "Enter a valid weight" }, { status: 400 });
  const date = measured_date || new Date().toISOString().split("T")[0];

  if (typeof date !== "string" || programmeDateDay(date) === null) return NextResponse.json({ error: "Choose a valid measurement date" }, { status: 400 });
  const entry: Record<string, unknown> = { client_id: profile.id, measured_date: date };
  if (canonicalWeight !== undefined) entry.weight_kg = canonicalWeight;
  for (const column of ["waist_cm", "chest_cm", "hips_cm", "left_arm_cm", "right_arm_cm", "left_thigh_cm", "right_thigh_cm"]) {
    if (!(column in body)) continue;
    if (body[column] !== null && (typeof body[column] !== "number" || !Number.isFinite(body[column]) || body[column] <= 0)) return NextResponse.json({ error: "Enter valid positive body measurements" }, { status: 400 });
    entry[column] = body[column];
  }
  if ("notes" in body) {
    if (typeof body.notes !== "string" || body.notes.length > 10000) return NextResponse.json({ error: "Notes must be text up to 10,000 characters" }, { status: 400 });
    entry.notes = body.notes;
  }
  if (Object.keys(entry).length === 2) return NextResponse.json({ error: "Add a weight or measurement" }, { status: 400 });
  const { data, error } = await admin.from("client_body_measurements")
    .upsert(entry, { onConflict: "client_id,measured_date" })
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
