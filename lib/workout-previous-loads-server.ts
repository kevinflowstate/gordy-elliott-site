import type { SupabaseClient } from "@supabase/supabase-js";
import { loadExercisePlanSessions, loadExerciseSessionItems } from "@/lib/exercise-session-load";
import { addNutritionDays } from "@/lib/nutrition-history";
import { previousExerciseLoads, type HistoryItem, type HistoryLog } from "@/lib/workout-previous-loads";

/** Caller verifies plan ownership. Every log query is additionally client-scoped. */
export async function loadPreviousExerciseLoads(admin: SupabaseClient, clientId: string, planId: string, sessionId: string, before: string) {
  const sessions = await loadExercisePlanSessions(admin, [planId]);
  if (sessions.error || !sessions.data) throw new Error("Couldn't load previous workout sessions.");
  const loaded = await loadExerciseSessionItems(admin, sessions.data.map(session => session.id));
  if (loaded.error || !loaded.data) throw new Error("Couldn't load previous workout exercises.");
  const days = new Map(sessions.data.map(session => [session.id, session.day_number]));
  const items: HistoryItem[] = loaded.data.map(item => ({ ...item, section_label: item.section_label || undefined, prescription_type: item.prescription_type || undefined, day_number: days.get(item.session_id)! }));
  const targets = items.filter(item => item.session_id === sessionId);
  const exercises = new Set(targets.map(item => item.exercise_id));
  const itemIds = items.filter(item => exercises.has(item.exercise_id)).map(item => item.id);
  const logs: HistoryLog[] = [];
  for (let offset = 0; offset < itemIds.length; offset += 50) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from("client_exercise_logs")
        .select("id, exercise_item_id, log_date, completed, performed_exercise_id, sets_data")
        .eq("client_id", clientId).in("exercise_item_id", itemIds.slice(offset, offset + 50))
        .lt("log_date", before).gte("log_date", addNutritionDays(before, -365))
        .order("log_date", { ascending: false }).order("id", { ascending: false }).range(from, from + 999);
      if (error) throw new Error("Couldn't load previous workout weights.");
      logs.push(...(data || []) as HistoryLog[]);
      if (!data || data.length < 1000) break;
    }
  }
  return previousExerciseLoads(targets, items, logs, before);
}
