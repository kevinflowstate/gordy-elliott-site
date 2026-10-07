import { dateKeyInTimeZone } from "@/lib/founder-dashboard";

const DAY_MS = 86_400_000;
export function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function addNutritionDays(date: string, days: number) {
  if (!isDateKey(date)) throw new Error("Invalid nutrition date");
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function nutritionWeek(startDate: string, week: number) {
  const start = new Date(`${startDate.slice(0, 10)}T12:00:00.000Z`);
  const monday = addNutritionDays(startDate.slice(0, 10), -((start.getUTCDay() + 6) % 7));
  const from = addNutritionDays(monday, (week - 1) * 7);
  const dates = Array.from({ length: 7 }, (_, i) => addNutritionDays(from, i));
  return { from, to: dates[6], dates };
}
export function nutritionWeekCount(startDate: string, today = dateKeyInTimeZone(new Date(), "Europe/London")) {
  const first = nutritionWeek(startDate, 1).from;
  return Math.max(1, Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / (7 * DAY_MS)) + 1);
}
export type NutritionValues = { calories: number | null; protein: number | null; carbs: number | null; fat: number | null };
export type NutritionTargetRecord = {
  id?: string;
  name: string;
  start_date?: string | null;
  created_at?: string;
  status: string;
  target_calories: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
};
export type NutritionLogDay = {
  date: string;
  imported: NutritionValues | null;
  partial: boolean;
  isToday: boolean;
  targets: (NutritionValues & { name: string; basis: "recorded_plan" }) | null;
};
function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
export function nutritionTargetsForDate(date: string, plans: NutritionTargetRecord[], today?: string): NutritionLogDay["targets"] {
  const selected = plans.filter((plan) => (plan.start_date || plan.created_at?.slice(0, 10) || "9999") <= date)
    .sort((a, b) => (b.start_date || b.created_at?.slice(0, 10) || "").localeCompare(a.start_date || a.created_at?.slice(0, 10) || "") || (b.created_at || "").localeCompare(a.created_at || ""))[0];
  if (!selected || (today && date >= today && selected.status !== "active")) return null;
  return {
    name: selected.name,
    basis: "recorded_plan",
    calories: finite(selected.target_calories), protein: finite(selected.target_protein_g),
    carbs: finite(selected.target_carbs_g), fat: finite(selected.target_fat_g),
  };
}
export function buildNutritionLogDays(dates: string[], summaries: Array<{
  summary_date: string; nutrition_calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null;
}>, plans: NutritionTargetRecord[], today: string): NutritionLogDay[] {
  const byDate = new Map(summaries.map((summary) => [summary.summary_date, summary]));
  return dates.map((date) => {
    const summary = byDate.get(date);
    const values = summary ? { calories: finite(summary.nutrition_calories), protein: finite(summary.protein_g), carbs: finite(summary.carbs_g), fat: finite(summary.fat_g) } : null;
    const imported = values && Object.values(values).some((value) => value !== null) ? values : null;
    return { date, imported, partial: Boolean(imported && Object.values(imported).some((value) => value === null)), isToday: date === today, targets: nutritionTargetsForDate(date, plans, today) };
  });
}
