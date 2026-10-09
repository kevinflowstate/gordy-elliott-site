import { dateKeyInTimeZone } from "@/lib/founder-dashboard";
import { weekStartForDateKey } from "@/lib/strength-progress";

export type DashboardSessionSummary = {
  session_id: string;
  log_date: string;
  completed_at: string | null;
  completed_sets: number;
};

type SessionLog = { session_id: string | null; log_date: string; completed: boolean };

/** A finish summary plus completed work is evidence, even when weight/reps were left blank. */
export function dashboardSavedWorkouts(logs: SessionLog[], summaries: DashboardSessionSummary[]) {
  const completedLogs = new Set(logs.filter((log) => log.session_id && log.completed)
    .map((log) => `${log.session_id}:${log.log_date}`));
  const saved = summaries.filter((summary) => summary.session_id && summary.completed_at && (
    summary.completed_sets > 0 || completedLogs.has(`${summary.session_id}:${summary.log_date}`)
  ));
  return [...new Map(saved.map((summary) => [`${summary.session_id}:${summary.log_date}`, summary])).values()];
}

/** Individual exercise rows alone cannot establish that a workout was saved. */
export function dashboardWorkoutWeek(logs: SessionLog[], summaries: DashboardSessionSummary[], now = new Date()) {
  const today = dateKeyInTimeZone(now, "Europe/London");
  const start = weekStartForDateKey(today);
  const inWeek = (date: string) => date >= start && date <= today;
  const finished = new Set(dashboardSavedWorkouts(logs, summaries)
    .filter((summary) => inWeek(summary.log_date))
    .map((summary) => `${summary.session_id}:${summary.log_date}`));
  const partial = new Set(logs
    .filter((log) => log.session_id && log.completed && inWeek(log.log_date))
    .map((log) => `${log.session_id}:${log.log_date}`)
    .filter((key) => !finished.has(key)));
  return { completed: finished.size, partial: partial.size, start, today };
}

export function dashboardWeightHistory(checkins: Array<{ id: string; created_at: string; responses?: Record<string, string> | null }>) {
  return checkins.flatMap((checkin) => {
    const raw = checkin.responses?.weight || checkin.responses?.current_weight;
    if (typeof raw !== "string" || !raw.trim()) return [];
    // Keep units in legacy answers, but reject partial strings such as "80ish".
    const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(?:kg)?$/i);
    const value = match ? Number(match[1]) : NaN;
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(Date.parse(checkin.created_at))) return [];
    return [{ id: checkin.id, timestamp: checkin.created_at, value,
      date: new Date(checkin.created_at).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "2-digit" }) }];
  }).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}
