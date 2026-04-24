import { requireAdmin } from "@/lib/admin-auth";
import { notifyClientProfile } from "@/lib/client-notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// GET: Fetch a client's nutrition plans
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });

  const { data: plans, error } = await admin
    .from("client_nutrition_plans")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!plans || plans.length === 0) return NextResponse.json({ plans: [] });

  const planIds = plans.map((p) => p.id);

  // Fetch meals
  const { data: meals } = await admin
    .from("client_nutrition_meals")
    .select("*")
    .in("plan_id", planIds)
    .order("order_index", { ascending: true });

  const mealIds = (meals || []).map((m) => m.id);

  // Fetch meal items joined with foods
  const { data: items } = mealIds.length
    ? await admin
        .from("client_nutrition_meal_items")
        .select("*, food:foods(id, name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g)")
        .in("meal_id", mealIds)
        .order("order_index", { ascending: true })
    : { data: [] };

  // Assemble
  const itemsByMeal = new Map<string, typeof items>();
  for (const item of items || []) {
    const list = itemsByMeal.get(item.meal_id) || [];
    list.push(item);
    itemsByMeal.set(item.meal_id, list);
  }

  const mealsByPlan = new Map<string, typeof meals>();
  for (const meal of meals || []) {
    const list = mealsByPlan.get(meal.plan_id) || [];
    list.push({
      ...meal,
      items: itemsByMeal.get(meal.id) || [],
    });
    mealsByPlan.set(meal.plan_id, list);
  }

  const assembled = plans.map((plan) => ({
    ...plan,
    meals: mealsByPlan.get(plan.id) || [],
  }));

  return NextResponse.json({ plans: assembled });
}

// POST: Assign a nutrition template to a client (deep copy) or save directly
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();
  const { client_id, template_id, plan } = body;

  // Deep copy from template
  if (template_id && client_id) {
    const { data: template } = await admin
      .from("nutrition_templates")
      .select("*")
      .eq("id", template_id)
      .single();

    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const { data: meals } = await admin
      .from("nutrition_template_meals")
      .select("*")
      .eq("template_id", template_id)
      .order("order_index", { ascending: true });

    const mealIds = (meals || []).map((m) => m.id);

    const { data: items } = mealIds.length
      ? await admin
          .from("nutrition_template_meal_items")
          .select("*")
          .in("meal_id", mealIds)
          .order("order_index", { ascending: true })
      : { data: [] };

    // Archive existing active plans
    await admin
      .from("client_nutrition_plans")
      .update({ status: "archived" })
      .eq("client_id", client_id)
      .eq("status", "active");

    // Create client plan with macro targets from template (or overrides from body)
    const { data: newPlan, error: planError } = await admin
      .from("client_nutrition_plans")
      .insert({
        client_id,
        template_id,
        name: template.name,
        status: "active",
        target_calories: body.target_calories || template.target_calories,
        target_protein_g: body.target_protein_g || template.target_protein_g,
        target_carbs_g: body.target_carbs_g || template.target_carbs_g,
        target_fat_g: body.target_fat_g || template.target_fat_g,
        start_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

    // Deep copy meals and items
    const itemsByMeal = new Map<string, typeof items>();
    for (const item of items || []) {
      const list = itemsByMeal.get(item.meal_id) || [];
      list.push(item);
      itemsByMeal.set(item.meal_id, list);
    }

    for (const meal of meals || []) {
      const { data: newMeal } = await admin
        .from("client_nutrition_meals")
        .insert({
          plan_id: newPlan.id,
          name: meal.name,
          order_index: meal.order_index,
          notes: meal.notes,
        })
        .select()
        .single();

      if (!newMeal) continue;

      const mealItems = itemsByMeal.get(meal.id) || [];
      if (mealItems.length > 0) {
        await admin.from("client_nutrition_meal_items").insert(
          mealItems.map((item) => ({
            meal_id: newMeal.id,
            food_id: item.food_id,
            quantity: item.quantity,
            order_index: item.order_index,
            notes: item.notes,
          }))
        );
      }
    }

    await notifyClientProfile(client_id, {
      title: "Nutrition plan updated",
      message: "Gordy updated your nutrition plan. Have a look before your next meal.",
      link: "/portal/nutrition-plan",
      tag: `nutrition-plan-${newPlan.id}`,
    });

    return NextResponse.json({ success: true, plan_id: newPlan.id });
  }

  // Save plan directly
  if (plan && plan.client_id) {
    if (!plan.id) {
      await admin
        .from("client_nutrition_plans")
        .update({ status: "archived" })
        .eq("client_id", plan.client_id)
        .eq("status", "active");
    }

    const { data: savedPlan, error: planError } = await admin
      .from("client_nutrition_plans")
      .upsert({
        id: plan.id || undefined,
        client_id: plan.client_id,
        template_id: plan.template_id || null,
        name: plan.name,
        status: plan.status || "active",
        target_calories: plan.target_calories || null,
        target_protein_g: plan.target_protein_g || null,
        target_carbs_g: plan.target_carbs_g || null,
        target_fat_g: plan.target_fat_g || null,
        start_date: plan.start_date || new Date().toISOString().split("T")[0],
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (planError) return NextResponse.json({ error: planError.message }, { status: 500 });

    // Delete existing meals (cascade deletes items)
    if (plan.id) {
      await admin.from("client_nutrition_meals").delete().eq("plan_id", savedPlan.id);
    }

    for (const meal of plan.meals || []) {
      const { data: newMeal } = await admin
        .from("client_nutrition_meals")
        .insert({
          plan_id: savedPlan.id,
          name: meal.name,
          order_index: meal.order_index,
          notes: meal.notes || null,
        })
        .select()
        .single();

      if (!newMeal) continue;

      const mealItems = meal.items || [];
      if (mealItems.length > 0) {
        await admin.from("client_nutrition_meal_items").insert(
          mealItems.map((item: { food_id: string; quantity: number; order_index: number; notes?: string }) => ({
            meal_id: newMeal.id,
            food_id: item.food_id,
            quantity: item.quantity,
            order_index: item.order_index,
            notes: item.notes || null,
          }))
        );
      }
    }

    await notifyClientProfile(plan.client_id, {
      title: "Nutrition plan updated",
      message: "Gordy updated your nutrition plan. Have a look before your next meal.",
      link: "/portal/nutrition-plan",
      tag: `nutrition-plan-${savedPlan.id}`,
    });

    return NextResponse.json({ success: true, plan_id: savedPlan.id });
  }

  return NextResponse.json({ error: "Provide template_id + client_id, or a plan object" }, { status: 400 });
}

// PATCH: Update plan status
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const body = await request.json();
  const { id, status, target_calories, target_protein_g, target_carbs_g, target_fat_g } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (target_calories !== undefined) updates.target_calories = target_calories;
  if (target_protein_g !== undefined) updates.target_protein_g = target_protein_g;
  if (target_carbs_g !== undefined) updates.target_carbs_g = target_carbs_g;
  if (target_fat_g !== undefined) updates.target_fat_g = target_fat_g;

  const { data: existingPlan } = await admin
    .from("client_nutrition_plans")
    .select("client_id")
    .eq("id", id)
    .single();

  const { error } = await admin.from("client_nutrition_plans").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === "active" && existingPlan?.client_id) {
    await notifyClientProfile(existingPlan.client_id, {
      title: "Nutrition plan updated",
      message: "Gordy made a nutrition plan active for you.",
      link: "/portal/nutrition-plan",
      tag: `nutrition-plan-${id}`,
    });
  }

  return NextResponse.json({ success: true });
}
