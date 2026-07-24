import { calendarEventOccursOn, dateKeyInTimeZone } from "./founder-dashboard";
import type { CalendarEvent, RecurrenceType } from "./types";

/**
 * Storm Warning rules engine.
 *
 * Deterministic and pure: the same events + the same `now` always produce the
 * same evaluation, the same explanations, and the same input hash. No AI, no
 * keyword-sniffing of titles, no Date.now() inside the logic.
 *
 * Travel: the only travel signal used is the structured `category = 'travel'`
 * on client-created events (a CHECK-constrained column the client set
 * deliberately). Synced calendar events carry no safe travel signal - titles
 * are not inspected and descriptions/attendees are never stored - so travel
 * is intentionally not inferred for them.
 */

// ---------------------------------------------------------------------------
// Tunable thresholds. This is the single place Gordy-tuning happens.
// ---------------------------------------------------------------------------
export const STORM_THRESHOLDS = {
  /** Length of the forward evaluation window, in days, starting today. */
  WINDOW_DAYS: 7,
  /** A day is "dense" at this many busy timed meetings. */
  DENSE_DAY_MEETINGS: 4,
  /** Dense days needed to trigger the density rule (amber). */
  DENSE_DAYS_AMBER: 2,
  /** Dense days at which the density rule escalates to red. */
  DENSE_DAYS_RED: 4,
  /** A single day with this many meetings makes the density rule red on its own. */
  HEAVY_DAY_MEETINGS: 7,
  /** A day counts towards the consecutive-run rule at this many meetings. */
  BUSY_DAY_MEETINGS: 3,
  /** Consecutive busy days needed to trigger (amber). */
  CONSECUTIVE_BUSY_AMBER: 4,
  /** Consecutive busy days at which the rule escalates to red. */
  CONSECUTIVE_BUSY_RED: 6,
  /** A meeting starting before this local time counts as an early start. */
  EARLY_START_TIME: "07:30",
  /** Early-start days needed to trigger (amber). */
  EARLY_START_DAYS: 3,
  /** Back-to-back meetings closer than this many minutes count as tight. */
  MIN_GAP_MINUTES: 15,
  /** Tight transitions needed to trigger the gap rule (amber). */
  TIGHT_GAPS_AMBER: 3,
  /** Tight transitions at which the gap rule escalates to red. */
  TIGHT_GAPS_RED: 6,
  /** Week meeting total needed before scheduled travel adds a warning. */
  TRAVEL_WEEK_MEETINGS: 10,
  /** Trailing history window, in days, ending yesterday. */
  HISTORY_TRAILING_DAYS: 28,
  /** Distinct days with stored events required before pattern comparison runs. */
  HISTORY_MIN_DISTINCT_DAYS: 14,
  /** Week must hold this multiple of the recent weekly average to trigger. */
  HISTORY_LOAD_MULTIPLIER: 1.5,
  /** Absolute floor: the pattern rule never fires below this week total. */
  HISTORY_MIN_WEEK_MEETINGS: 10,
  /** This many rules triggering at once escalates the overall severity to red. */
  STACKED_RULES_FOR_RED: 3,
} as const;

/**
 * Client-created event categories that mark a date rather than commit time
 * (structured data, not title inspection). They are excluded from meeting
 * counts but still count as calendar history.
 */
export const NON_MEETING_CATEGORIES = new Set(["birthday", "anniversary", "reminder"]);

export type StormRuleId =
  | "meeting_density"
  | "consecutive_busy_days"
  | "early_starts"
  | "insufficient_gaps"
  | "travel_load"
  | "above_recent_pattern";

export type StormSeverity = "none" | "amber" | "red";

export interface StormEventInput {
  id: string;
  source: "coach" | "client" | "connected";
  /** YYYY-MM-DD Europe/London date key (a longer ISO string is sliced). */
  event_date: string;
  /** HH:MM Europe/London local start time. */
  event_time: string | null;
  recurrence: RecurrenceType;
  recurrence_day?: number | null;
  /** Client-created events only. */
  category?: string | null;
  all_day?: boolean;
  /** Synced events only; exactly "free" excludes the event. */
  busy_status?: string | null;
  is_cancelled?: boolean;
  is_active?: boolean;
  /** Synced events only: reliable ISO instants. */
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface StormRuleResult {
  id: StormRuleId;
  /** False when the rule was skipped because the data cannot support it. */
  evaluated: boolean;
  triggered: boolean;
  severity: "amber" | "red" | null;
  explanation: string;
  inputs: Record<string, unknown>;
}

export interface StormDaySnapshot {
  date: string;
  meetings: number;
  allDayEvents: number;
  travelEvents: number;
  earliestStart: string | null;
}

export interface StormInputSnapshot {
  windowStart: string;
  windowEnd: string;
  days: StormDaySnapshot[];
  windowMeetings: number;
  history: {
    trailingDays: number;
    distinctEventDays: number;
    weeklyAverageMeetings: number | null;
  };
  thresholds: typeof STORM_THRESHOLDS;
}

export interface StormWarningEvaluation {
  warning: boolean;
  severity: StormSeverity;
  windowKey: string;
  windowStart: string;
  windowEnd: string;
  evaluatedAt: string;
  rules: StormRuleResult[];
  overallExplanation: string;
  usedHistory: boolean;
  historyDistinctDays: number;
  inputSnapshot: StormInputSnapshot;
  inputHash: string;
}

export interface StormDismissal {
  window_key: string;
  severity: "amber" | "red";
  dismissed_at?: string;
}

export interface StormWarningClientState {
  evaluation: StormWarningEvaluation;
  dismissed: StormDismissal | null;
  silenced: boolean;
}

// ---------------------------------------------------------------------------
// Date-key helpers (machine-timezone independent).
// ---------------------------------------------------------------------------

export function addDaysToKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** ISO-8601 week key, e.g. "2026-W30". Stable for a full Monday-Sunday week. */
export function isoWeekKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const mondayIndexed = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayIndexed + 3);
  const isoYear = date.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4 - ((jan4.getUTCDay() + 6) % 7) + 3));
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export function formatDayLabel(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Local-noon Date whose local date parts equal the key, for occurrence checks. */
function dateAtLocalNoon(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function fnv1a32(input: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function fnv1aHash(input: string) {
  const left = fnv1a32(input, 0x811c9dc5);
  const right = fnv1a32(input, 0x811c9dc5 ^ 0x9e3779b9);
  return left.toString(16).padStart(8, "0") + right.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// Occurrence expansion.
// ---------------------------------------------------------------------------

interface MeetingOccurrence {
  eventId: string;
  source: StormEventInput["source"];
  time: string;
  startsAt: string | null;
  endsAt: string | null;
}

interface DayOccurrences {
  dateKey: string;
  meetings: MeetingOccurrence[];
  allDayCount: number;
  travelCount: number;
  storedCount: number;
}

function isExcluded(event: StormEventInput) {
  return event.is_cancelled === true || event.is_active === false;
}

function isFree(event: StormEventInput) {
  return typeof event.busy_status === "string" && event.busy_status.trim().toLowerCase() === "free";
}

function isMeeting(event: StormEventInput) {
  if (isExcluded(event) || isFree(event) || event.all_day === true) return false;
  if (event.category && NON_MEETING_CATEGORIES.has(event.category)) return false;
  return typeof event.event_time === "string" && /^\d{2}:\d{2}$/.test(event.event_time);
}

function toOccurrenceEvent(event: StormEventInput): CalendarEvent {
  return {
    id: event.id,
    title: "",
    event_date: event.event_date,
    event_time: event.event_time || "09:00",
    recurrence: event.recurrence,
    recurrence_day: event.recurrence_day ?? null,
    is_active: true,
    created_at: "",
  };
}

function expandDays(events: StormEventInput[], startKey: string, length: number): DayOccurrences[] {
  const days: DayOccurrences[] = [];
  for (let offset = 0; offset < length; offset++) {
    const dateKey = addDaysToKey(startKey, offset);
    const date = dateAtLocalNoon(dateKey);
    const day: DayOccurrences = { dateKey, meetings: [], allDayCount: 0, travelCount: 0, storedCount: 0 };
    for (const event of events) {
      if (isExcluded(event)) continue;
      if (!calendarEventOccursOn(toOccurrenceEvent(event), date)) continue;
      day.storedCount += 1;
      if (event.category === "travel") day.travelCount += 1;
      if (event.all_day === true) {
        day.allDayCount += 1;
        continue;
      }
      if (!isMeeting(event)) continue;
      day.meetings.push({
        eventId: event.id,
        source: event.source,
        time: event.event_time as string,
        startsAt: event.starts_at || null,
        endsAt: event.ends_at || null,
      });
    }
    day.meetings.sort((a, b) => (a.time === b.time ? a.eventId.localeCompare(b.eventId) : a.time < b.time ? -1 : 1));
    days.push(day);
  }
  return days;
}

// ---------------------------------------------------------------------------
// Rules.
// ---------------------------------------------------------------------------

const T = STORM_THRESHOLDS;

function listDays(keys: string[]) {
  return keys.map(formatDayLabel).join(", ");
}

function ruleMeetingDensity(days: DayOccurrences[]): StormRuleResult {
  const denseDays = days.filter((day) => day.meetings.length >= T.DENSE_DAY_MEETINGS);
  const maxDay = days.reduce((max, day) => (day.meetings.length > max.meetings.length ? day : max), days[0]);
  const heavy = maxDay && maxDay.meetings.length >= T.HEAVY_DAY_MEETINGS;
  const triggered = denseDays.length >= T.DENSE_DAYS_AMBER || Boolean(heavy);
  const severity = !triggered ? null : denseDays.length >= T.DENSE_DAYS_RED || heavy ? "red" : "amber";
  let explanation = `Meeting load looks manageable across the next ${T.WINDOW_DAYS} days.`;
  if (triggered) {
    const parts: string[] = [];
    if (denseDays.length >= T.DENSE_DAYS_AMBER) {
      parts.push(`${T.DENSE_DAY_MEETINGS}+ meetings on ${denseDays.length} of the next ${T.WINDOW_DAYS} days (${listDays(denseDays.map((day) => day.dateKey))})`);
    }
    if (heavy) {
      parts.push(`${maxDay.meetings.length} meetings on ${formatDayLabel(maxDay.dateKey)} alone`);
    }
    explanation = parts.join(", including ");
  }
  return {
    id: "meeting_density",
    evaluated: true,
    triggered,
    severity,
    explanation,
    inputs: {
      denseDayThreshold: T.DENSE_DAY_MEETINGS,
      denseDays: denseDays.map((day) => ({ date: day.dateKey, meetings: day.meetings.length })),
      maxDayMeetings: maxDay ? maxDay.meetings.length : 0,
    },
  };
}

function ruleConsecutiveBusyDays(days: DayOccurrences[]): StormRuleResult {
  let bestRun: string[] = [];
  let run: string[] = [];
  for (const day of days) {
    if (day.meetings.length >= T.BUSY_DAY_MEETINGS) {
      run.push(day.dateKey);
      if (run.length > bestRun.length) bestRun = [...run];
    } else {
      run = [];
    }
  }
  const triggered = bestRun.length >= T.CONSECUTIVE_BUSY_AMBER;
  const severity = !triggered ? null : bestRun.length >= T.CONSECUTIVE_BUSY_RED ? "red" : "amber";
  const explanation = triggered
    ? `${T.BUSY_DAY_MEETINGS}+ meetings every day for ${bestRun.length} days running (${formatDayLabel(bestRun[0])} - ${formatDayLabel(bestRun[bestRun.length - 1])})`
    : "No long unbroken run of busy days ahead.";
  return {
    id: "consecutive_busy_days",
    evaluated: true,
    triggered,
    severity,
    explanation,
    inputs: {
      busyDayThreshold: T.BUSY_DAY_MEETINGS,
      longestRunDays: bestRun.length,
      runDates: bestRun,
    },
  };
}

function ruleEarlyStarts(days: DayOccurrences[]): StormRuleResult {
  const earlyDays = days.filter((day) => day.meetings.length > 0 && day.meetings[0].time < T.EARLY_START_TIME);
  const triggered = earlyDays.length >= T.EARLY_START_DAYS;
  const explanation = triggered
    ? `Starts before ${T.EARLY_START_TIME} on ${earlyDays.length} of the next ${T.WINDOW_DAYS} days (${listDays(earlyDays.map((day) => day.dateKey))})`
    : `No repeated starts before ${T.EARLY_START_TIME} ahead.`;
  return {
    id: "early_starts",
    evaluated: true,
    triggered,
    severity: triggered ? "amber" : null,
    explanation,
    inputs: {
      earlyStartTime: T.EARLY_START_TIME,
      earlyDays: earlyDays.map((day) => ({ date: day.dateKey, firstStart: day.meetings[0].time })),
    },
  };
}

function ruleInsufficientGaps(days: DayOccurrences[]): StormRuleResult {
  let checkedPairs = 0;
  let tight = 0;
  let daysWithStackedMeetings = 0;
  let daysWithMeasurableTimes = 0;
  for (const day of days) {
    if (day.meetings.length >= 2) daysWithStackedMeetings += 1;
    const timed = day.meetings
      .filter((meeting) => meeting.startsAt && meeting.endsAt)
      .sort((a, b) => (new Date(a.startsAt as string).getTime() - new Date(b.startsAt as string).getTime()));
    if (timed.length >= 2) daysWithMeasurableTimes += 1;
    for (let index = 1; index < timed.length; index++) {
      checkedPairs += 1;
      const gapMinutes = (new Date(timed[index].startsAt as string).getTime()
        - new Date(timed[index - 1].endsAt as string).getTime()) / 60000;
      if (gapMinutes < T.MIN_GAP_MINUTES) tight += 1;
    }
  }
  // Manual events store no end times, so gaps can only be measured where the
  // connected calendar provides both instants. If stacked days exist but none
  // are measurable, skip honestly instead of guessing.
  if (daysWithStackedMeetings > 0 && checkedPairs === 0) {
    return {
      id: "insufficient_gaps",
      evaluated: false,
      triggered: false,
      severity: null,
      explanation: "Gap checks were skipped - they need connected-calendar end times, which are not available for these events.",
      inputs: { checkedPairs, daysWithStackedMeetings, daysWithMeasurableTimes },
    };
  }
  const triggered = tight >= T.TIGHT_GAPS_AMBER;
  const severity = !triggered ? null : tight >= T.TIGHT_GAPS_RED ? "red" : "amber";
  const explanation = triggered
    ? `Less than ${T.MIN_GAP_MINUTES} minutes between back-to-back meetings ${tight} times across the week`
    : "Back-to-back spacing looks workable where meeting times are known.";
  return {
    id: "insufficient_gaps",
    evaluated: true,
    triggered,
    severity,
    explanation,
    inputs: { minGapMinutes: T.MIN_GAP_MINUTES, checkedPairs, tightTransitions: tight },
  };
}

function ruleTravelLoad(days: DayOccurrences[], windowMeetings: number): StormRuleResult {
  const travelDays = days.filter((day) => day.travelCount > 0);
  const triggered = travelDays.length >= 1 && windowMeetings >= T.TRAVEL_WEEK_MEETINGS;
  const explanation = triggered
    ? `Travel is scheduled on ${listDays(travelDays.map((day) => day.dateKey))} alongside ${windowMeetings} meetings this week`
    : travelDays.length >= 1
      ? "Travel is scheduled, but the week around it has room."
      : "No travel is marked for the week ahead.";
  return {
    id: "travel_load",
    evaluated: true,
    triggered,
    severity: triggered ? "amber" : null,
    explanation,
    inputs: {
      travelDays: travelDays.map((day) => day.dateKey),
      windowMeetings,
      signal: "client-set travel category only; synced events carry no safe travel signal",
    },
  };
}

function ruleAboveRecentPattern(
  windowMeetings: number,
  distinctHistoryDays: number,
  historyMeetings: number,
): StormRuleResult {
  if (distinctHistoryDays < T.HISTORY_MIN_DISTINCT_DAYS) {
    return {
      id: "above_recent_pattern",
      evaluated: false,
      triggered: false,
      severity: null,
      explanation: `Pattern comparison was skipped - only ${distinctHistoryDays} of the ${T.HISTORY_MIN_DISTINCT_DAYS} days of calendar history it needs are stored.`,
      inputs: { distinctHistoryDays, requiredDays: T.HISTORY_MIN_DISTINCT_DAYS },
    };
  }
  const weeklyAverage = historyMeetings / (T.HISTORY_TRAILING_DAYS / 7);
  const triggered = windowMeetings >= T.HISTORY_MIN_WEEK_MEETINGS
    && windowMeetings >= T.HISTORY_LOAD_MULTIPLIER * weeklyAverage;
  const rounded = Math.round(weeklyAverage * 10) / 10;
  const explanation = triggered
    ? `The next ${T.WINDOW_DAYS} days hold ${windowMeetings} meetings against a recent average of ${rounded} a week`
    : `This week sits close to the recent average of ${rounded} meetings a week.`;
  return {
    id: "above_recent_pattern",
    evaluated: true,
    triggered,
    severity: triggered ? "amber" : null,
    explanation,
    inputs: {
      windowMeetings,
      weeklyAverageMeetings: rounded,
      multiplier: T.HISTORY_LOAD_MULTIPLIER,
      distinctHistoryDays,
    },
  };
}

// ---------------------------------------------------------------------------
// Evaluation.
// ---------------------------------------------------------------------------

export function evaluateStormWarning({
  events,
  now,
  timeZone = "Europe/London",
}: {
  events: StormEventInput[];
  now: Date;
  timeZone?: string;
}): StormWarningEvaluation {
  const todayKey = dateKeyInTimeZone(now, timeZone);
  const windowStart = todayKey;
  const windowEnd = addDaysToKey(todayKey, T.WINDOW_DAYS - 1);
  const windowKey = isoWeekKey(windowStart);

  const days = expandDays(events, windowStart, T.WINDOW_DAYS);
  const windowMeetings = days.reduce((total, day) => total + day.meetings.length, 0);

  const historyStart = addDaysToKey(todayKey, -T.HISTORY_TRAILING_DAYS);
  const historyDays = expandDays(events, historyStart, T.HISTORY_TRAILING_DAYS);
  const distinctHistoryDays = historyDays.filter((day) => day.storedCount > 0).length;
  const historyMeetings = historyDays.reduce((total, day) => total + day.meetings.length, 0);

  const rules: StormRuleResult[] = [
    ruleMeetingDensity(days),
    ruleConsecutiveBusyDays(days),
    ruleEarlyStarts(days),
    ruleInsufficientGaps(days),
    ruleTravelLoad(days, windowMeetings),
    ruleAboveRecentPattern(windowMeetings, distinctHistoryDays, historyMeetings),
  ];

  const triggeredRules = rules.filter((rule) => rule.triggered);
  const warning = triggeredRules.length > 0;
  const severity: StormSeverity = !warning
    ? "none"
    : triggeredRules.some((rule) => rule.severity === "red") || triggeredRules.length >= T.STACKED_RULES_FOR_RED
      ? "red"
      : "amber";

  const usedHistory = distinctHistoryDays >= T.HISTORY_MIN_DISTINCT_DAYS;
  const historyNote = usedHistory
    ? ""
    : " This is based on the week's calendar alone - there is not enough history yet to compare against a usual pattern.";
  const overallExplanation = warning
    ? `${triggeredRules.length === 1 ? "One pressure signal" : `${triggeredRules.length} pressure signals`} for the week ahead: ${triggeredRules.map((rule) => rule.explanation).join("; ")}.${historyNote}`
    : `No storm signals in the next ${T.WINDOW_DAYS} days.${historyNote}`;

  const inputSnapshot: StormInputSnapshot = {
    windowStart,
    windowEnd,
    days: days.map((day) => ({
      date: day.dateKey,
      meetings: day.meetings.length,
      allDayEvents: day.allDayCount,
      travelEvents: day.travelCount,
      earliestStart: day.meetings[0]?.time ?? null,
    })),
    windowMeetings,
    history: {
      trailingDays: T.HISTORY_TRAILING_DAYS,
      distinctEventDays: distinctHistoryDays,
      weeklyAverageMeetings: usedHistory ? Math.round((historyMeetings / (T.HISTORY_TRAILING_DAYS / 7)) * 10) / 10 : null,
    },
    thresholds: T,
  };

  const inputHash = fnv1aHash(stableStringify({
    snapshot: inputSnapshot,
    triggered: triggeredRules.map((rule) => rule.id),
    severity,
  }));

  return {
    warning,
    severity,
    windowKey,
    windowStart,
    windowEnd,
    evaluatedAt: now.toISOString(),
    rules,
    overallExplanation,
    usedHistory,
    historyDistinctDays: distinctHistoryDays,
    inputSnapshot,
    inputHash,
  };
}

// ---------------------------------------------------------------------------
// Dismissal semantics.
// ---------------------------------------------------------------------------

export function severityRank(severity: StormSeverity) {
  return severity === "red" ? 2 : severity === "amber" ? 1 : 0;
}

/**
 * A dismissal keeps the dashboard quiet while the situation is materially the
 * same: the same ISO-week window and no higher severity than was dismissed.
 * A new week or an escalation (amber to red) re-raises the warning.
 */
export function dismissalSilencesWarning(
  evaluation: StormWarningEvaluation,
  dismissal: StormDismissal | null | undefined,
) {
  if (!evaluation.warning || !dismissal) return false;
  return dismissal.window_key === evaluation.windowKey
    && severityRank(evaluation.severity) <= severityRank(dismissal.severity);
}

// Re-exported so callers share the exact same date semantics as the engine.
export { dateKeyInTimeZone };
