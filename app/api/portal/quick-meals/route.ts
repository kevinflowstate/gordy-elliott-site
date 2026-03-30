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

// GET: Fetch quick meals for a date + saved meal presets
export async function GET(request: Request) {
  const profile = await getClientProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  const [quickResult, savedResult] = await Promise.all([
    admin
      .from("client_quick_meals")
      .select("*")
      .eq("client_id", profile.id)
      .eq("tracked_date", date)
      .order("created_at", { ascending: true }),
    admin
      .from("client_saved_meals")
      .select("*")
      .eq("client_id", profile.id)
      .order("name", { ascending: true }),
  ]);

  return NextResponse.json({
    quickMeals: quickResult.data || [],
    savedMeals: savedResult.data || [],
  });
}

// POST: Add a quick meal to a day (optionally save as preset)
export async function POST(request: Request) {
  const profile = await getClientProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const body = await request.json();
  const { name, calories, protein_g, carbs_g, fat_g, date, saveAsPreset } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const tracked_date = date || new Date().toISOString().split("T")[0];

  // Insert quick meal
  const { data: quickMeal, error } = await admin
    .from("client_quick_meals")
    .insert({
      client_id: profile.id,
      tracked_date,
      name: name.trim(),
      calories: Number(calories) || 0,
      protein_g: Number(protein_g) || 0,
      carbs_g: Number(carbs_g) || 0,
      fat_g: Number(fat_g) || 0,
      completed: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optionally save as reusable preset
  if (saveAsPreset) {
    await admin.from("client_saved_meals").insert({
      client_id: profile.id,
      name: name.trim(),
      calories: Number(calories) || 0,
      protein_g: Number(protein_g) || 0,
      carbs_g: Number(carbs_g) || 0,
      fat_g: Number(fat_g) || 0,
    });
  }

  return NextResponse.json({ quickMeal });
}

// PATCH: Toggle quick meal completion
export async function PATCH(request: Request) {
  const profile = await getClientProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const body = await request.json();
  const { id, completed } = body;

  if (!id || completed === undefined) {
    return NextResponse.json({ error: "id and completed are required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("client_quick_meals")
    .update({ completed })
    .eq("id", id)
    .eq("client_id", profile.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quickMeal: data });
}

// DELETE: Remove a quick meal or saved preset
export async function DELETE(request: Request) {
  const profile = await getClientProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const body = await request.json();
  const { id, type } = body; // type: "quick" or "saved"

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const table = type === "saved" ? "client_saved_meals" : "client_quick_meals";
  const { error } = await admin.from(table).delete().eq("id", id).eq("client_id", profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
