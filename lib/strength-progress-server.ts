import type { SupabaseClient } from "@supabase/supabase-js";
import { dateKeyInTimeZone } from "@/lib/founder-dashboard";
import {
  buildStrengthTrackerProgress,
  buildTrainingConsistency,
  type StrengthLogInput,
  type StrengthMetricType,
  weekStartForDateKey,
} from "@/lib/strength-progress";
import { addDaysToKey } from "@/lib/storm-warning";
import { loadWeeklyTrainingAssignments } from "@/lib/training-planner";

type ExerciseOption = {
  id: string;
  name: string;
  muscleGroup: string | null;
  equipment: string | null;
};

type TrackerRow = {
  id: string;
  client_id: string;
  exercise_id: string;
  metric_type: StrengthMetricType;
  order_index: number;
  is_active: boolean;
  retired_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function loadAvailableStrengthExercises(
  admin: SupabaseClient,
  clientId: string,
): Promise<ExerciseOption[]> {
  const { data: plans, error: planError } = await admin
    .from("client_exercise_plans")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  if (planError) throw new Error(planError.message);
  const plan = plans?.[0];
  if (!plan) return [];

  const { data: sessions, error: sessionError } = await admin
    .from("client_exercise_sessions")
    .select("id")
    .eq("plan_id", plan.id);
  if (sessionError) throw new Error(sessionError.message);
  const sessionIds = (sessions || []).map((session) => session.id);
  if (!sessionIds.length) return [];

  const { data: items, error: itemError } = await admin
    .from("client_exercise_session_items")
    .select("exercise_id, exercise:exercises(id, name, muscle_group, equipment)")
    .in("session_id", sessionIds);
  if (itemError) throw new Error(itemError.message);

  const exercises = new Map<string, ExerciseOption>();
  for (const item of items || []) {
    const exerciseValue = item.exercise as unknown;
    const exercise = (Array.isArray(exerciseValue) ? exerciseValue[0] : exerciseValue) as {
      id?: string;
      name?: string;
      muscle_group?: string | null;
      equipment?: string | null;
    } | null;
    if (!exercise?.id || !exercise.name) continue;
    exercises.set(exercise.id, {
      id: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscle_group || null,
      equipment: exercise.equipment || null,
    });
  }
  return [...exercises.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export async function loadClientStrengthProgress(
  admin: SupabaseClient,
  clientId: string,
  now = new Date(),
) {
  const todayKey = dateKeyInTimeZone(now, "Europe/London");
  const logCutoff = addDaysToKey(todayKey, -365);
  const [trackersResult, plansResult, logsResult] = await Promise.all([
    admin
      .from("client_strength_trackers")
      .select("*")
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
    admin
      .from("client_exercise_plans")
      .select("id, status, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    admin
      .from("client_exercise_logs")
      .select("exercise_item_id, session_id, log_date, sets_data, completed")
      .eq("client_id", clientId)
      .gte("log_date", logCutoff)
      .lte("log_date", todayKey)
      .order("log_date", { ascending: true }),
  ]);

  if (trackersResult.error) throw new Error(trackersResult.error.message);
  if (plansResult.error) throw new Error(plansResult.error.message);
  if (logsResult.error) throw new Error(logsResult.error.message);

  const trackers = (trackersResult.data || []) as TrackerRow[];
  const plans = plansResult.data || [];
  const planIds = plans.map((plan) => plan.id);
  const activePlan = plans.find((plan) => plan.status === "active") || null;

  const { data: sessions, error: sessionError } = planIds.length
    ? await admin
        .from("client_exercise_sessions")
        .select("id, plan_id")
        .in("plan_id", planIds)
    : { data: [], error: null };
  if (sessionError) throw new Error(sessionError.message);
  const sessionIds = (sessions || []).map((session) => session.id);

  const { data: items, error: itemError } = sessionIds.length
    ? await admin
        .from("client_exercise_session_items")
        .select("id, exercise_id, session_id")
        .in("session_id", sessionIds)
    : { data: [], error: null };
  if (itemError) throw new Error(itemError.message);
  const itemExercise = new Map((items || []).map((item) => [item.id, item.exercise_id]));

  const exerciseIds = trackers.map((tracker) => tracker.exercise_id);
  const { data: exercises, error: exerciseError } = exerciseIds.length
    ? await admin
        .from("exercises")
        .select("id, name")
        .in("id", exerciseIds)
    : { data: [], error: null };
  if (exerciseError) throw new Error(exerciseError.message);
  const exerciseNames = new Map((exercises || []).map((exercise) => [exercise.id, exercise.name]));

  const strengthLogs: StrengthLogInput[] = (logsResult.data || [])
    .map((log) => {
      const exerciseId = itemExercise.get(log.exercise_item_id);
      if (!exerciseId) return null;
      return {
        exercise_id: exerciseId,
        session_id: log.session_id,
        log_date: log.log_date,
        completed: Boolean(log.completed),
        sets_data: Array.isArray(log.sets_data) ? log.sets_data : [],
      };
    })
    .filter((log): log is StrengthLogInput => Boolean(log));

  const activeSessionIds = activePlan
    ? (sessions || []).filter((session) => session.plan_id === activePlan.id).map((session) => session.id)
    : [];
  const currentWeek = weekStartForDateKey(todayKey);
  const weekStarts = Array.from({ length: 4 }, (_, index) => addDaysToKey(currentWeek, (index - 3) * 7));
  const assignments = activePlan && activeSessionIds.length
    ? (await Promise.all(weekStarts.map((weekStart) =>
        loadWeeklyTrainingAssignments(admin, {
          clientId,
          planId: activePlan.id,
          weekStart,
          sessionIds: activeSessionIds,
        })
      ))).flatMap((result) => {
        if (result.error) throw new Error(result.error);
        return result.assignments;
      })
    : [];

  return {
    today: todayKey,
    consistency: buildTrainingConsistency({
      assignments,
      logs: (logsResult.data || []).map((log) => ({
        session_id: log.session_id,
        log_date: log.log_date,
        completed: Boolean(log.completed),
      })),
      todayKey,
    }),
    trackers: trackers.map((tracker) => buildStrengthTrackerProgress({
      id: tracker.id,
      exerciseId: tracker.exercise_id,
      exerciseName: exerciseNames.get(tracker.exercise_id) || "Tracked movement",
      metricType: tracker.metric_type,
      logs: strengthLogs,
    })),
  };
}
