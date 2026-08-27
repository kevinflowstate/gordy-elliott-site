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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  // Get client profile
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "No profile found" }, { status: 404 });

  const [plansResult, nutritionResult, connectionResult] = await Promise.all([
    admin
      .from("client_nutrition_plans")
      .select("*")
      .eq("client_id", profile.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("client_wearable_daily_summaries")
      .select("summary_date, providers, nutrition_calories, protein_g, carbs_g, fat_g, water_ml, updated_at")
      .eq("client_id", profile.id)
      .eq("summary_date", date)
      .contains("providers", ["myfitnesspal"])
      .maybeSingle(),
    admin
      .from("client_wearable_connections")
      .select("status, last_sync_at")
      .eq("client_id", profile.id)
      .eq("provider", "myfitnesspal")
      .maybeSingle(),
  ]);

  if (plansResult.error) return NextResponse.json({ error: plansResult.error.message }, { status: 500 });
  if (nutritionResult.error) return NextResponse.json({ error: nutritionResult.error.message }, { status: 500 });
  if (connectionResult.error) return NextResponse.json({ error: connectionResult.error.message }, { status: 500 });

  const nutrition = nutritionResult.data;
  const myFitnessPalConnection = {
    connected: connectionResult.data?.status === "connected",
    lastSyncAt: connectionResult.data?.last_sync_at || null,
  };
  const hasNutritionSignal = nutrition && [
    nutrition.nutrition_calories,
    nutrition.protein_g,
    nutrition.carbs_g,
    nutrition.fat_g,
    nutrition.water_ml,
  ].some((value) => value !== null);
  const syncedNutrition = hasNutritionSignal ? {
    provider: "myfitnesspal" as const,
    summaryDate: nutrition.summary_date,
    calories: nutrition.nutrition_calories,
    proteinG: nutrition.protein_g,
    carbsG: nutrition.carbs_g,
    fatG: nutrition.fat_g,
    waterMl: nutrition.water_ml,
    summaryUpdatedAt: nutrition.updated_at,
    lastSyncAt: connectionResult.data?.last_sync_at || null,
    connectionStatus: connectionResult.data?.status || null,
  } : null;

  const plans = plansResult.data;
  if (!plans || plans.length === 0) {
    return NextResponse.json({ plan: null, tracking: [], syncedNutrition, myFitnessPalConnection });
  }

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
        .select("*, food:foods(id, name, category, serving_size, calories, protein_g, carbs_g, fat_g, fibre_g, sugar_g, photo_url)")
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
    syncedNutrition,
    myFitnessPalConnection,
  });
}
