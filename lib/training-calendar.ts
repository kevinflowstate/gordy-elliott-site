import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeeklyTrainingAssignment } from "@/lib/types";
import { programmeAddDays, programmeCalendarWeekStart, programmeDateDay } from "@/lib/exercise-programme";

export interface TrainingDateOverride {
  id: string;
  client_id: string;
  plan_id: string;
  session_id: string;
  source_week_start: string;
  planned_date: string;
  created_at: string;
  updated_at: string;
}

export const MANUAL_ACTIVITY_OPTIONS = [
  ["walking", "Walking"],
  ["running", "Running"],
  ["cycling", "Cycling"],
  ["swimming", "Swimming"],
  ["mobility", "Yoga / mobility"],
  ["sport", "Sport"],
  ["other", "Other workout"],
  ["rest", "Rest day"],
] as const;
export type ManualActivityKind = (typeof MANUAL_ACTIVITY_OPTIONS)[number][0];

export interface ManualTrainingActivity {
  id: string;
  activity_date: string;
  kind: ManualActivityKind;
  duration_minutes: number | null;
  notes: string;
  source: "manual";
  created_at: string;
  updated_at: string;
}

export function manualActivityLabel(kind: string): string {
  return MANUAL_ACTIVITY_OPTIONS.find(([value]) => value === kind)?.[1] || "Activity";
}

export function manualActivityError(date: unknown, kind: unknown, minutes: unknown, notes: unknown, today: string): string | null {
  if (typeof date !== "string" || programmeDateDay(date) === null || date > today || date < programmeAddDays(today, -365)) {
    return "Choose a date in the past year, up to today.";
  }
  if (!MANUAL_ACTIVITY_OPTIONS.some(([value]) => value === kind)) return "Choose an activity or rest day.";
  if (kind !== "rest" && minutes !== null && minutes !== "" && minutes !== undefined
    && (!Number.isInteger(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 1440)) {
    return "Enter minutes between 1 and 1,440.";
  }
  if (notes !== undefined && notes !== null && (typeof notes !== "string" || notes.length > 1000)) return "Keep notes within 1,000 characters.";
  return null;
}

/** Moves out of this Monday week, plus moves into any of its seven dates. */
export async function loadTrainingDateOverrides(db: SupabaseClient, clientId: string, planId: string, weekStart: string) {
  const end = programmeAddDays(weekStart, 6);
  const { data, error } = await db
    .from("client_training_date_overrides")
    .select("*")
    .eq("client_id", clientId)
    .eq("plan_id", planId)
    .or(`source_week_start.eq.${weekStart},and(planned_date.gte.${weekStart},planned_date.lte.${end})`);
  return { overrides: (data || []) as TrainingDateOverride[], error: error?.message || null };
}

export function overrideDatesInWeek(overrides: TrainingDateOverride[], weekStart: string): string[] {
  const end = programmeAddDays(weekStart, 6);
  return overrides.map((o) => o.planned_date).filter((date) => date >= weekStart && date <= end);
}

/**
 * Overlays one-off moves on a week's own occurrences. Own occurrences keep one entry per session
 * (moved ones carry moved_to); occurrences moved in from another week are returned separately so
 * consumers keyed by session id never see two entries for the same session.
 */
export function applyTrainingDateOverrides(
  assignments: WeeklyTrainingAssignment[],
  overrides: TrainingDateOverride[],
  weekStart: string,
  context: { clientId: string; planId: string },
): { assignments: WeeklyTrainingAssignment[]; movedIn: WeeklyTrainingAssignment[] } {
  const end = programmeAddDays(weekStart, 6);
  const inWeek = (date: string) => date >= weekStart && date <= end;
  const outgoing = new Map(overrides.filter((o) => o.source_week_start === weekStart).map((o) => [o.session_id, o]));
  const own: WeeklyTrainingAssignment[] = assignments.map((assignment) => {
    const move = outgoing.get(assignment.session_id);
    if (!move) return assignment;
    outgoing.delete(assignment.session_id);
    return {
      ...assignment,
      planned_date: inWeek(move.planned_date) ? move.planned_date : null,
      source: "date_override",
      override_id: move.id,
      source_week_start: weekStart,
      moved_to: move.planned_date,
      held_date: assignment.source === "explicit" ? assignment.planned_date : null,
    };
  });
  // Occurrences that had no placement when they were moved.
  for (const move of outgoing.values()) {
    own.push({
      id: null,
      client_id: context.clientId,
      plan_id: context.planId,
      session_id: move.session_id,
      week_start: weekStart,
      planned_date: inWeek(move.planned_date) ? move.planned_date : null,
      is_recurring: false,
      recurrence_stopped: false,
      source: "date_override",
      override_id: move.id,
      source_week_start: weekStart,
      moved_to: move.planned_date,
      held_date: null,
    });
  }
  const movedIn: WeeklyTrainingAssignment[] = overrides
    .filter((o) => o.source_week_start !== weekStart && inWeek(o.planned_date))
    .sort((a, b) => a.planned_date.localeCompare(b.planned_date))
    .map((o) => ({
      id: null,
      client_id: o.client_id,
      plan_id: o.plan_id,
      session_id: o.session_id,
      week_start: weekStart,
      planned_date: o.planned_date,
      is_recurring: false,
      recurrence_stopped: false,
      source: "date_override",
      override_id: o.id,
      source_week_start: o.source_week_start,
      moved_to: o.planned_date,
      held_date: null,
    }));
  return { assignments: own, movedIn };
}

/** Dates already taken in a week, mapped to the session using them (held originals included). */
export function occupiedTrainingDates(assignments: WeeklyTrainingAssignment[], movedIn: WeeklyTrainingAssignment[], exceptSessionId?: string) {
  const dates = new Map<string, string>();
  for (const assignment of assignments) {
    if (assignment.session_id === exceptSessionId) continue;
    if (assignment.planned_date) dates.set(assignment.planned_date, assignment.session_id);
    if (assignment.held_date) dates.set(assignment.held_date, assignment.session_id);
  }
  for (const assignment of movedIn) {
    if (assignment.planned_date) dates.set(assignment.planned_date, assignment.session_id);
  }
  return dates;
}

/** Programme-plan log guard: the moved occurrence may be logged on its new date, not elsewhere in its old week. */
export async function workoutDateMoveState(db: SupabaseClient, clientId: string, sessionId: string, date: string) {
  const sourceWeek = programmeCalendarWeekStart(date);
  const { data, error } = await db
    .from("client_training_date_overrides")
    .select("source_week_start,planned_date")
    .eq("client_id", clientId)
    .eq("session_id", sessionId)
    .or(`planned_date.eq.${date},source_week_start.eq.${sourceWeek}`);
  const rows = (data || []) as Pick<TrainingDateOverride, "source_week_start" | "planned_date">[];
  return {
    movedHere: rows.some((row) => row.planned_date === date),
    movedAwayTo: rows.find((row) => row.source_week_start === sourceWeek && row.planned_date !== date)?.planned_date || null,
    error: error?.message || null,
  };
}

export function formatTrainingDate(date: string, withYear = false): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
  });
}
