import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// GET: Fetch all nutrition templates with nested meals + items (joined with foods)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();

  const { data: templates, error } = await admin
    .from("nutrition_templates")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!templates || templates.length === 0) return NextResponse.json({ templates: [] });

  const templateIds = templates.map((t) => t.id);

  const { data: meals } = await admin
    .from("nutrition_template_meals")
    .select("*")
    .in("template_id", templateIds)
    .order("order_index", { ascending: true });

  const mealIds = (meals || []).map((m) => m.id);

  const { data: items } = mealIds.length
    ? await admin
        .from("nutrition_template_meal_items")
        .select("*, food:foods(id, name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g)")
        .in("meal_id", mealIds)
        .order("order_index", { ascending: true })
    : { data: [] };

  // Assemble nested
  const itemsByMeal = new Map<string, typeof items>();
  for (const item of items || []) {
    const list = itemsByMeal.get(item.meal_id) || [];
    list.push(item);
    itemsByMeal.set(item.meal_id, list);
  }

  const mealsByTemplate = new Map<string, typeof meals>();
  for (const meal of meals || []) {
    const list = mealsByTemplate.get(meal.template_id) || [];
    list.push({
      ...meal,
      items: itemsByMeal.get(meal.id) || [],
    });
    mealsByTemplate.set(meal.template_id, list);
  }

  const assembled = templates.map((t) => ({
    ...t,
    meals: mealsByTemplate.get(t.id) || [],
  }));

  return NextResponse.json({ templates: assembled });
}

// POST: Create or update a nutrition template (upsert + delete-reinsert pattern)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();
  const { template } = body;

  if (!template) return NextResponse.json({ error: "template is required" }, { status: 400 });

  // Upsert template
  const { data: saved, error: tplError } = await admin
    .from("nutrition_templates")
    .upsert({
      id: template.id || undefined,
      name: template.name,
      description: template.description || null,
      calorie_range: template.calorie_range || "moderate",
      target_calories: template.target_calories || null,
      target_protein_g: template.target_protein_g || null,
      target_carbs_g: template.target_carbs_g || null,
      target_fat_g: template.target_fat_g || null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (tplError) return NextResponse.json({ error: tplError.message }, { status: 500 });

  // Delete existing meals (cascade deletes items)
  if (template.id) {
    await admin.from("nutrition_template_meals").delete().eq("template_id", saved.id);
  }

  // Insert meals and items
  for (const meal of template.meals || []) {
    const { data: newMeal, error: mealError } = await admin
      .from("nutrition_template_meals")
      .insert({
        template_id: saved.id,
        name: meal.name,
        order_index: meal.order_index,
        notes: meal.notes || null,
      })
      .select()
      .single();

    if (mealError) return NextResponse.json({ error: mealError.message }, { status: 500 });

    const mealItems = meal.items || [];
    if (mealItems.length > 0) {
      const { error: itemsError } = await admin
        .from("nutrition_template_meal_items")
        .insert(
          mealItems.map((item: { food_id: string; quantity: number; order_index: number; notes?: string }) => ({
            meal_id: newMeal.id,
            food_id: item.food_id,
            quantity: item.quantity || 1,
            order_index: item.order_index,
            notes: item.notes || null,
          }))
        );
      if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, template_id: saved.id });
}

// DELETE: Soft-delete a template
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await admin
    .from("nutrition_templates")
    .update({ is_active: false })
    .eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
