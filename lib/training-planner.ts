import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeeklyTrainingAssignment } from "@/lib/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type AssignmentRow = {
  id: string;
  client_id: string;
  plan_id: string;
  session_id: string;
  week_start: string;
  planned_date: string | null;
  is_recurring: boolean;
  recurrence_stopped: boolean | null;
  created_at: string;
  updated_at: string;
};

export function formatPlannerDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parsePlannerDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime()) || formatPlannerDate(date) !== value) return null;
  return date;
}

export function getPlannerWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function normaliseWeekStart(value?: string | null): string {
  const parsed = value ? parsePlannerDate(value) : null;
  return formatPlannerDate(getPlannerWeekStart(parsed || new Date()));
}

export function addPlannerDays(dateString: string, days: number): string {
  const date = parsePlannerDate(dateString);
  if (!date) return dateString;
  date.setDate(date.getDate() + days);
  return formatPlannerDate(date);
}

export function plannedDateIsInWeek(weekStart: string, plannedDate: string | null): boolean {
  if (!plannedDate) return true;
  const start = parsePlannerDate(weekStart);
  const planned = parsePlannerDate(plannedDate);
  if (!start || !planned) return false;
  const diff = Math.round((planned.getTime() - start.getTime()) / MS_PER_DAY);
  return diff >= 0 && diff <= 6;
}

function weekdayOffset(weekStart: string, plannedDate: string): number {
  const start = parsePlannerDate(weekStart);
  const planned = parsePlannerDate(plannedDate);
  if (!start || !planned) return 0;
  const diff = Math.round((planned.getTime() - start.getTime()) / MS_PER_DAY);
  return Math.min(6, Math.max(0, diff));
}

function toAssignment(row: AssignmentRow): WeeklyTrainingAssignment {
  return {
    id: row.id,
    client_id: row.client_id,
    plan_id: row.plan_id,
    session_id: row.session_id,
    week_start: row.week_start,
    planned_date: row.planned_date,
    is_recurring: row.is_recurring,
    recurrence_stopped: Boolean(row.recurrence_stopped),
    source: "explicit",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function loadWeeklyTrainingAssignments(
  supabase: SupabaseClient,
  {
    clientId,
    planId,
    weekStart,
    sessionIds,
  }: {
    clientId: string;
    planId: string;
    weekStart: string;
    sessionIds: string[];
  },
): Promise<{ assignments: WeeklyTrainingAssignment[]; error: string | null }> {
  if (sessionIds.length === 0) return { assignments: [], error: null };

  const { data: explicitRows, error: explicitError } = await supabase
    .from("client_training_weekly_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("plan_id", planId)
    .eq("week_start", weekStart)
    .in("session_id", sessionIds);

  if (explicitError) return { assignments: [], error: explicitError.message };

  const explicitAssignments = ((explicitRows || []) as AssignmentRow[]).map(toAssignment);
  const explicitSessionIds = new Set(explicitAssignments.map((assignment) => assignment.session_id));
  const occupiedPlannedDates = new Set(
    explicitAssignments
      .map((assignment) => assignment.planned_date)
      .filter((plannedDate): plannedDate is string => Boolean(plannedDate)),
  );

  const { data: priorRows, error: priorError } = await supabase
    .from("client_training_weekly_assignments")
    .select("*")
    .eq("client_id", clientId)
    .eq("plan_id", planId)
    .lt("week_start", weekStart)
    .in("session_id", sessionIds)
    .order("week_start", { ascending: false });

  if (priorError) return { assignments: [], error: priorError.message };

  const recurringAssignments: WeeklyTrainingAssignment[] = [];
  const recurringSeen = new Set<string>();

  for (const row of (priorRows || []) as AssignmentRow[]) {
    if (explicitSessionIds.has(row.session_id) || recurringSeen.has(row.session_id)) {
      continue;
    }

    if (row.recurrence_stopped) {
      recurringSeen.add(row.session_id);
      continue;
    }

    if (!row.is_recurring || !row.planned_date) {
      continue;
    }

    recurringSeen.add(row.session_id);
    const plannedDate = addPlannerDays(weekStart, weekdayOffset(row.week_start, row.planned_date));
    if (occupiedPlannedDates.has(plannedDate)) {
      continue;
    }

    occupiedPlannedDates.add(plannedDate);
    recurringAssignments.push({
      id: null,
      client_id: row.client_id,
      plan_id: row.plan_id,
      session_id: row.session_id,
      week_start: weekStart,
      planned_date: plannedDate,
      is_recurring: true,
      recurrence_stopped: false,
      source: "recurring",
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  return {
    assignments: [...explicitAssignments, ...recurringAssignments],
    error: null,
  };
}
