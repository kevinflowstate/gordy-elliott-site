import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

  // Get client profile
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "No profile found" }, { status: 404 });

  // Get active nutrition plan
  const { data: plans } = await admin
    .from("client_nutrition_plans")
    .select("*")
    .eq("client_id", profile.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!plans || plans.length === 0) return NextResponse.json({ plan: null, tracking: [], quickMeals: [] });

  const plan = plans[0];

  // Get meals
  const { data: meals } = await admin
    .from("client_nutrition_meals")
    .select("*")
    .eq("plan_id", plan.id)
    .order("order_index", { ascending: true });

  const mealIds = (meals || []).map((m: { id: string }) => m.id);

  // Get meal items joined with foods (include photo_url)
  const { data: items } = mealIds.length
    ? await admin
        .from("client_nutrition_meal_items")
        .select("*, food:foods(id, name, category, serving_size, calories, protein_g, carbs_g, fat_g, photo_url)")
        .in("meal_id", mealIds)
        .order("order_index", { ascending: true })
    : { data: [] };

  // Get tracking for the requested date
  const { data: tracking } = mealIds.length
    ? await admin
        .from("client_meal_tracking")
        .select("*")
        .eq("client_id", profile.id)
        .eq("tracked_date", date)
        .in("meal_id", mealIds)
    : { data: [] };

  // Get quick meals for the requested date
  const { data: quickMeals } = await admin
    .from("client_quick_meals")
    .select("*")
    .eq("client_id", profile.id)
    .eq("tracked_date", date)
    .order("created_at", { ascending: true });

  // Assemble
  const itemsByMeal = new Map<string, typeof items>();
  for (const item of items || []) {
    const list = itemsByMeal.get(item.meal_id) || [];
    list.push(item);
    itemsByMeal.set(item.meal_id, list);
  }

  const assembled = {
    ...plan,
    meals: (meals || []).map((m: { id: string }) => ({
      ...m,
      items: itemsByMeal.get(m.id) || [],
    })),
  };

  return NextResponse.json({
    plan: assembled,
    tracking: tracking || [],
    quickMeals: quickMeals || [],
  });
}
