export const WEEKLY_CAPACITY_MINIMUM_DAYS = 28;
export const WEEKLY_CAPACITY_MINIMUM_SLEEP_DAYS = 14;

export type WeeklyCapacityStatus = "collecting" | "setup_required" | "ready";
export type WeeklyCapacityRequirementId = "history" | "calendar" | "sleep" | "training";

export interface WeeklyCapacityRequirement {
  id: WeeklyCapacityRequirementId;
  label: string;
  met: boolean;
  detail: string;
  href: string | null;
}

export interface WeeklyCapacitySleepSignal {
  date: string;
  sleepMinutes: number | null;
  sleepScore: number | null;
}

export interface WeeklyCapacityInput {
  now: Date;
  collectionStartedAt: string;
  calendarConnected: boolean;
  calendarLastSyncAt: string | null;
  calendarMeetingsByDay: number[];
  sleepSignals: WeeklyCapacitySleepSignal[];
  activePlanSessions: number;
  plannedSessions: number;
}

export interface WeeklyCapacityResult {
  status: WeeklyCapacityStatus;
  score: number | null;
  label: string;
  message: string;
  availableAt: string;
  daysRemaining: number;
  requirements: WeeklyCapacityRequirement[];
  signals: {
    sleepLoad: number | null;
    calendarLoad: number | null;
    trainingLoad: number | null;
    calendarMeetings: number;
    plannedSessions: number;
    sleepDays: number;
  };
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function usableSleepCapacity(signal: WeeklyCapacitySleepSignal) {
  if (typeof signal.sleepScore === "number" && Number.isFinite(signal.sleepScore)) {
    return clamp(signal.sleepScore);
  }
  if (typeof signal.sleepMinutes !== "number" || !Number.isFinite(signal.sleepMinutes)) return null;
  // Seven hours is already a useful night; the curve stays deliberately lenient.
  return clamp(35 + ((signal.sleepMinutes - 300) / 240) * 55);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreCalendarLoad(meetingsByDay: number[]) {
  const normalized = Array.from({ length: 7 }, (_, index) => Math.max(0, meetingsByDay[index] || 0));
  const total = normalized.reduce((sum, value) => sum + value, 0);
  const busiestDay = Math.max(0, ...normalized);
  const totalLoad = clamp(((total - 7) / 21) * 100);
  const busiestDayLoad = clamp(((busiestDay - 2) / 5) * 100);
  return {
    load: Math.round(totalLoad * 0.7 + busiestDayLoad * 0.3),
    total,
  };
}

function scoreTrainingLoad(plannedSessions: number) {
  if (plannedSessions <= 0) return 10;
  if (plannedSessions === 1) return 25;
  if (plannedSessions === 2) return 40;
  if (plannedSessions === 3) return 55;
  if (plannedSessions === 4) return 70;
  return 85;
}

function readyMessage(score: number) {
  if (score >= 70) {
    return {
      label: "Plenty in the tank",
      message: "This week looks open enough. There is no capacity reason your planned sessions cannot be done.",
    };
  }
  if (score >= 50) {
    return {
      label: "Balanced week",
      message: "This week looks workable. Keep the planned sessions where they are and protect the basics around them.",
    };
  }
  if (score >= 35) {
    return {
      label: "A tighter week",
      message: "The week looks busy but manageable. Is there anything you can reschedule to keep training on track?",
    };
  }
  return {
    label: "Protect the week",
    message: "The coming week is heavily loaded. Simplify what you can and grab a chat with Gordy before dropping sessions.",
  };
}

export function evaluateWeeklyCapacity(input: WeeklyCapacityInput): WeeklyCapacityResult {
  const createdAt = new Date(input.collectionStartedAt);
  const validCreatedAt = Number.isFinite(createdAt.getTime()) ? createdAt : input.now;
  const availableAtDate = addUtcDays(validCreatedAt, WEEKLY_CAPACITY_MINIMUM_DAYS);
  const daysRemaining = Math.max(
    0,
    Math.ceil((startOfUtcDay(availableAtDate) - startOfUtcDay(input.now)) / 86_400_000),
  );

  const sleepCapacities = input.sleepSignals
    .map(usableSleepCapacity)
    .filter((value): value is number => value !== null);
  const calendarSyncDate = input.calendarLastSyncAt ? new Date(input.calendarLastSyncAt) : null;
  const calendarSynced = input.calendarConnected
    && Boolean(
      calendarSyncDate
      && Number.isFinite(calendarSyncDate.getTime())
      && input.now.getTime() - calendarSyncDate.getTime() <= 72 * 60 * 60 * 1000,
    );
  const hasTrainingPlan = input.activePlanSessions > 0;
  const hasSleepHistory = sleepCapacities.length >= WEEKLY_CAPACITY_MINIMUM_SLEEP_DAYS;

  const requirements: WeeklyCapacityRequirement[] = [
    {
      id: "history",
      label: "Four weeks of signals",
      met: daysRemaining === 0,
      detail: daysRemaining === 0 ? "Collection window complete" : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`,
      href: null,
    },
    {
      id: "calendar",
      label: "Calendar",
      met: calendarSynced,
      detail: calendarSynced
        ? "Connected and syncing"
        : input.calendarConnected
          ? "Calendar needs a fresh sync"
          : "Connect and sync a calendar",
      href: "/portal/connected-apps",
    },
    {
      id: "sleep",
      label: "Sleep",
      met: hasSleepHistory,
      detail: hasSleepHistory
        ? `${sleepCapacities.length} recent nights`
        : `${sleepCapacities.length}/${WEEKLY_CAPACITY_MINIMUM_SLEEP_DAYS} recent nights`,
      href: "/portal/daily-tracker",
    },
    {
      id: "training",
      label: "Training plan",
      met: hasTrainingPlan,
      detail: hasTrainingPlan ? `${input.activePlanSessions} active session${input.activePlanSessions === 1 ? "" : "s"}` : "No active plan",
      href: "/portal/exercise-plan",
    },
  ];

  const calendar = scoreCalendarLoad(input.calendarMeetingsByDay);
  const effectivePlannedSessions = input.plannedSessions;
  const trainingLoad = hasTrainingPlan ? scoreTrainingLoad(effectivePlannedSessions) : null;
  const sleepLoad = sleepCapacities.length > 0 ? Math.round(100 - average(sleepCapacities)) : null;
  const baseSignals = {
    sleepLoad,
    calendarLoad: calendarSynced ? calendar.load : null,
    trainingLoad,
    calendarMeetings: calendar.total,
    plannedSessions: effectivePlannedSessions,
    sleepDays: sleepCapacities.length,
  };

  if (daysRemaining > 0) {
    return {
      status: "collecting",
      score: null,
      label: "Learning your normal",
      message: "Your weekly Capacity Checker unlocks after four weeks, once it has enough sleep, calendar and training context to be useful.",
      availableAt: availableAtDate.toISOString(),
      daysRemaining,
      requirements,
      signals: baseSignals,
    };
  }

  if (!calendarSynced || !hasSleepHistory || !hasTrainingPlan || sleepLoad === null || trainingLoad === null) {
    return {
      status: "setup_required",
      score: null,
      label: "A few signals are missing",
      message: "Add the missing calendar, sleep or training signal and the weekly score will switch on automatically.",
      availableAt: availableAtDate.toISOString(),
      daysRemaining: 0,
      requirements,
      signals: baseSignals,
    };
  }

  let combinedLoad = Math.round(sleepLoad * 0.35 + calendar.load * 0.35 + trainingLoad * 0.3);
  // One difficult signal should prompt awareness, not declare the whole week maxed.
  const highPressureSignals = [sleepLoad, calendar.load, trainingLoad].filter((load) => load >= 70).length;
  if (highPressureSignals < 2) combinedLoad = Math.min(combinedLoad, 64);

  const score = clamp(100 - combinedLoad);
  const copy = readyMessage(score);
  return {
    status: "ready",
    score,
    label: copy.label,
    message: copy.message,
    availableAt: availableAtDate.toISOString(),
    daysRemaining: 0,
    requirements,
    signals: baseSignals,
  };
}
