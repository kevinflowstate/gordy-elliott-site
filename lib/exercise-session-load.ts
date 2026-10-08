import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExerciseSessionItem, Exercise, PrescriptionType, ExerciseSession } from "@/lib/types";

type StoredItem = Omit<ExerciseSessionItem, "section_label" | "rest_seconds" | "tempo" | "notes" | "superset_group" | "prescription_type" | "exercise"> & {
  section_label: string | null; rest_seconds: number | null; tempo: string | null; notes: string | null;
  superset_group: string | null; prescription_type: PrescriptionType | null; exercise: Exercise | null;
};

/** Bound the PostgREST URL and paginate explicitly; its default row limit is not a complete plan. */
export async function loadExerciseSessionItems(admin: SupabaseClient, sessionIds: string[]) {
  const items: StoredItem[] = [];
  const uniqueIds = [...new Set(sessionIds)];
  for (let offset = 0; offset < uniqueIds.length; offset += 20) {
    const chunk = uniqueIds.slice(offset, offset + 20);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from("client_exercise_session_items")
        .select("*, exercise:exercises(id, name, muscle_group, equipment, description, video_url)")
        .in("session_id", chunk).order("id", { ascending: true }).range(from, from + 999);
      if (error) return { data: null, error: error.message };
      items.push(...(data || []) as StoredItem[]);
      if (!data || data.length < 1000) break;
    }
  }
  items.sort((a, b) => a.order_index - b.order_index);
  return { data: items, error: null };
}

type StoredSession = Omit<ExerciseSession, "items" | "plan_id"> & { plan_id: string };
export async function loadExercisePlanSessions(admin: SupabaseClient, planIds: string[]) {
  const sessions: StoredSession[] = [];
  const ids = [...new Set(planIds)];
  for (let offset = 0; offset < ids.length; offset += 20) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from("client_exercise_sessions").select("*")
        .in("plan_id", ids.slice(offset, offset + 20)).order("id", { ascending: true }).range(from, from + 999);
      if (error) return { data: null, error: error.message };
      sessions.push(...(data || []) as StoredSession[]);
      if (!data || data.length < 1000) break;
    }
  }
  sessions.sort((a, b) => (a.week_number || 0) - (b.week_number || 0) || a.day_number - b.day_number);
  return { data: sessions, error: null };
}
