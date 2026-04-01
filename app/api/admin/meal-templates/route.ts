import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// GET: Fetch all meal templates
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("meal_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meal_templates: data || [] });
}

// POST: Create a new meal template
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();
  const { name, foods, total_calories, total_protein, total_carbs, total_fat } = body;

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data, error } = await admin
    .from("meal_templates")
    .insert({
      name: name.trim(),
      foods: foods || [],
      total_calories: total_calories || 0,
      total_protein: total_protein || 0,
      total_carbs: total_carbs || 0,
      total_fat: total_fat || 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meal_template: data });
}

// DELETE: Remove a meal template
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();

  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await admin
    .from("meal_templates")
    .delete()
    .eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
