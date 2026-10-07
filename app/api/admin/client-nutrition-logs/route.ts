import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateKeyInTimeZone } from "@/lib/founder-dashboard";
import { addNutritionDays, buildNutritionLogDays, isDateKey, type NutritionTargetRecord } from "@/lib/nutrition-history";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const params = new URL(request.url).searchParams;
  const clientId = params.get("clientId") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId) || !isDateKey(from) || !isDateKey(to) || to < from || to > addNutritionDays(from, 92)) {
    return NextResponse.json({ error: "Provide a client and valid date range of at most 93 days." }, { status: 400 });
  }
  const admin = createAdminClient();
  const results = await Promise.all([
    admin.from("client_wearable_daily_summaries").select("summary_date, nutrition_calories, protein_g, carbs_g, fat_g").eq("client_id", clientId).contains("providers", ["myfitnesspal"]).gte("summary_date", from).lte("summary_date", to).order("summary_date"),
    admin.from("client_wearable_daily_summaries").select("summary_date, nutrition_calories, protein_g, carbs_g, fat_g").eq("client_id", clientId).contains("providers", ["myfitnesspal"]).lte("summary_date", dateKeyInTimeZone(new Date(), "Europe/London")).or("nutrition_calories.not.is.null,protein_g.not.is.null,carbs_g.not.is.null,fat_g.not.is.null").order("summary_date", { ascending: false }).limit(1),
    admin.from("client_wearable_connections").select("status, last_sync_at").eq("client_id", clientId).eq("provider", "myfitnesspal").maybeSingle(),
    admin.from("client_nutrition_plans").select("id, name, status, start_date, created_at, target_calories, target_protein_g, target_carbs_g, target_fat_g").eq("client_id", clientId),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) return NextResponse.json({ error: "Could not load nutrition history. Please try again." }, { status: 500 });
  const [summaries, latest, connection, plans] = results;
  const dates: string[] = [];
  for (let date = from; date <= to; date = addNutritionDays(date, 1)) dates.push(date);
  return NextResponse.json({
    source: "myfitnesspal",
    days: buildNutritionLogDays(dates, summaries.data || [], (plans.data || []) as NutritionTargetRecord[], dateKeyInTimeZone(new Date(), "Europe/London")),
    latestDataDate: latest.data?.[0]?.summary_date || null,
    connection: connection.data || null,
  });
}
