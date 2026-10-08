import type { ClientExercisePlan, ExerciseSession } from "@/lib/types";

type Programme = Pick<ClientExercisePlan, "start_date" | "programme_weeks" | "programme_timezone" | "sessions">;
const DAY = 86_400_000;

/** Date-only arithmetic, independent of the server/browser timezone and DST. */
export function programmeDateDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms / DAY : null;
}

export function programmeToday(timeZone = "Europe/London", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function programmeWeek(plan: Programme, date: string): number | null {
  if (!plan.programme_weeks) return null;
  const start = programmeDateDay(plan.start_date || "");
  const selected = programmeDateDay(date);
  if (start === null || selected === null) return null;
  // Preview week one before the start; after the programme, repeat its final week.
  return Math.min(plan.programme_weeks, Math.max(1, Math.floor((selected - start) / 7) + 1));
}

export function programmeSessionsForDate(plan: Programme, date: string): ExerciseSession[] {
  const week = programmeWeek(plan, date);
  return plan.sessions.filter((session) => !plan.programme_weeks || session.week_number === week)
    .sort((a, b) => a.day_number - b.day_number);
}

export function programmeSessionCanBePlanned(plan: Programme, sessionId: string, date: string): boolean {
  if (!plan.programme_weeks) return plan.sessions.some((session) => session.id === sessionId);
  const selected = programmeDateDay(date);
  const start = programmeDateDay(plan.start_date || "");
  return selected !== null && start !== null && selected >= start
    && programmeSessionsForDate(plan, date).some((session) => session.id === sessionId);
}

export function programmeSessionsForCalendarWeek(plan: Programme, weekStart: string): ExerciseSession[] {
  if (!plan.programme_weeks) return plan.sessions;
  const day = programmeDateDay(weekStart);
  if (day === null) return [];
  const ids = new Set<string>();
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date((day + offset) * DAY).toISOString().slice(0, 10);
    for (const session of programmeSessionsForDate(plan, date)) {
      if (programmeSessionCanBePlanned(plan, session.id, date)) ids.add(session.id);
    }
  }
  return plan.sessions.filter((session) => ids.has(session.id));
}

/** Copies are independent: editing week four must never mutate week one's logs. */
export function copyProgrammeWeek(sessions: ExerciseSession[], sourceWeek: number, targetWeeks: number[], makeId = () => crypto.randomUUID()): ExerciseSession[] {
  const source = sessions.filter((session) => session.week_number === sourceWeek);
  const targets = [...new Set(targetWeeks)].filter((week) => week !== sourceWeek);
  if (!source.length || targets.some((week) => !Number.isInteger(week) || week < 1 || sessions.some((session) => session.week_number === week))) {
    throw new Error("Choose an existing source week and empty destination weeks.");
  }
  const copies = targets.flatMap((week) => source.map((session) => {
    const sessionId = makeId();
    const groups = new Map<string, string>();
    return { ...session, id: sessionId, week_number: week, items: session.items.map((item) => {
      if (item.superset_group && !groups.has(item.superset_group)) groups.set(item.superset_group, makeId());
      return { ...item, id: makeId(), session_id: sessionId, superset_group: item.superset_group ? groups.get(item.superset_group) : undefined };
    }) };
  }));
  return [...sessions, ...copies];
}

const SESSION_DAYS: Record<number, number[]> = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 2, 4, 5], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
export function programmeScheduledSessionForDate(plan: Programme, date: string): ExerciseSession | null {
  const start = programmeDateDay(plan.start_date || "");
  const selected = programmeDateDay(date);
  if (!plan.programme_weeks || start === null || selected === null || selected < start) return null;
  const sessions = programmeSessionsForDate(plan, date);
  const pattern = SESSION_DAYS[sessions.length];
  if (!pattern) return null;
  const index = pattern.indexOf((selected - start) % 7);
  return index >= 0 ? sessions[index] : null;
}

export function programmeCalendarWeekStart(date: string): string {
  const day = programmeDateDay(date);
  if (day === null) throw new Error("Invalid programme date");
  const weekday = new Date(day * DAY).getUTCDay();
  return new Date((day - (weekday === 0 ? 6 : weekday - 1)) * DAY).toISOString().slice(0, 10);
}
export function programmeAddDays(date: string, days: number): string {
  const day = programmeDateDay(date);
  if (day === null) throw new Error("Invalid programme date");
  return new Date((day + days) * DAY).toISOString().slice(0, 10);
}
export function programmeWeeksInRange(plan: Programme, from: string, to: string): number[] {
  const start = programmeDateDay(from);
  const end = programmeDateDay(to);
  if (start === null || end === null || end < start || end - start > 6) throw new Error("Choose up to seven valid workout dates.");
  const weeks = new Set<number>();
  for (let day = start; day <= end; day++) {
    const week = programmeWeek(plan, new Date(day * DAY).toISOString().slice(0, 10));
    if (week !== null) weeks.add(week);
  }
  return [...weeks];
}
