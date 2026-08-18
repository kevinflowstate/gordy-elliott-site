import { formatExercisePrescription, shouldUseSetLogging } from "@/lib/exercise-prescriptions";
import { getExerciseDemoUrl } from "@/lib/exercise-demo";
import type { WorkoutSetData } from "@/lib/workout-runner";
import type { ExerciseSession } from "@/lib/types";

export const NATIVE_WORKOUT_PENDING_EVENT = "atcapacity:native-workout-pending";
export const NATIVE_WORKOUT_CLOSED_EVENT = "atcapacity:native-workout-closed";
export const NATIVE_WORKOUT_UNAVAILABLE_EVENT = "atcapacity:native-workout-unavailable";
export const NATIVE_WORKOUT_SYNCED_EVENT = "atcapacity:native-workout-synced";

interface NativeWorkoutMessageHandler {
  postMessage: (message: unknown) => void;
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        ATCapacityWorkout?: NativeWorkoutMessageHandler;
      };
    };
  }
}

export interface NativeWorkoutSyncPayload {
  session_id: string;
  date: string;
  session_started_at?: string | null;
  entries: Array<{
    exercise_item_id: string;
    sets_data: WorkoutSetData[];
  }>;
}

export interface PendingNativeWorkout {
  id: string;
  createdAt?: number;
  payload: NativeWorkoutSyncPayload;
}

const MAX_SERVER_WORKOUT_AGE_MS = 6 * 60 * 60 * 1_000;

export function prepareNativeWorkoutSyncPayload(
  payload: NativeWorkoutSyncPayload,
  now = Date.now(),
): NativeWorkoutSyncPayload {
  if (!payload.session_started_at) return payload;
  const startedAt = Date.parse(payload.session_started_at);
  if (
    Number.isFinite(startedAt) &&
    startedAt <= now + 5 * 60_000 &&
    now - startedAt <= MAX_SERVER_WORKOUT_AGE_MS
  ) {
    return payload;
  }
  return { ...payload, session_started_at: null };
}

export interface NativeWorkoutLaunchOptions {
  session: ExerciseSession;
  date: string;
  dateLabel: string;
  mode: "workout" | "edit";
  sets: Record<string, WorkoutSetData[]>;
  startedAt: number | null;
}

export interface NativeWorkoutLaunchPayload {
  schemaVersion: 1;
  session: {
    id: string;
    name: string;
    notes: string | null;
    exercises: Array<{
      id: string;
      name: string;
      prescription: string;
      section: string | null;
      restSeconds: number | null;
      notes: string | null;
      demoURL: string | null;
      usesSetLogging: boolean;
    }>;
  };
  date: string;
  dateLabel: string;
  mode: "workout" | "edit";
  sets: Record<string, WorkoutSetData[]>;
  startedAt: number | null;
}

function handler() {
  if (typeof window === "undefined") return null;
  return window.webkit?.messageHandlers?.ATCapacityWorkout || null;
}

export function isNativeWorkoutAvailable() {
  return Boolean(handler());
}

export function buildNativeWorkoutLaunchPayload(options: NativeWorkoutLaunchOptions): NativeWorkoutLaunchPayload {
  let section: string | null = null;
  const exercises = options.session.items.flatMap((item) => {
    if (item.exercise_id === "__section__") {
      section = item.section_label?.trim() || "Next section";
      return [];
    }

    const name = item.exercise?.name || "Exercise";
    return [{
      id: item.id,
      name,
      prescription: formatExercisePrescription(item),
      section,
      restSeconds: item.rest_seconds || null,
      notes: item.notes || null,
      demoURL: getExerciseDemoUrl(item.exercise?.video_url, name),
      usesSetLogging: shouldUseSetLogging(item),
    }];
  });

  return {
    schemaVersion: 1,
    session: {
      id: options.session.id,
      name: options.session.name,
      notes: options.session.notes || null,
      exercises,
    },
    date: options.date,
    dateLabel: options.dateLabel,
    mode: options.mode,
    sets: options.sets,
    startedAt: options.startedAt,
  };
}

export function openNativeWorkout(options: NativeWorkoutLaunchOptions) {
  const nativeHandler = handler();
  if (!nativeHandler) return false;

  nativeHandler.postMessage({ action: "open", payload: buildNativeWorkoutLaunchPayload(options) });
  return true;
}

export function requestPendingNativeWorkouts() {
  handler()?.postMessage({ action: "requestPending" });
}

export function acknowledgePendingNativeWorkout(id: string) {
  handler()?.postMessage({ action: "ackPending", id });
}
