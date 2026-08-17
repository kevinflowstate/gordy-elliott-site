import { addDaysToKey } from "@/lib/storm-warning";

export const STRENGTH_METRIC_TYPES = ["load_reps", "reps", "duration"] as const;
export type StrengthMetricType = (typeof STRENGTH_METRIC_TYPES)[number];

export type StrengthSetInput = {
  weight?: unknown;
  reps?: unknown;
  notes?: unknown;
  completed?: unknown;
};

export type StrengthLogInput = {
  exercise_item_id?: string;
  exercise_id: string;
  exercise_name?: string;
  session_id: string | null;
  log_date: string;
  completed: boolean;
  sets_data: StrengthSetInput[];
};

export type CompletedSessionSet = {
  setNumber: number;
  displayValue: string;
  weightKg: number | null;
  reps: number | null;
  tonnageKg: number;
};

export type CompletedSessionExercise = {
  exerciseId: string;
  exerciseName: string;
  completedSets: number;
  totalReps: number;
  totalTonnageKg: number;
  sets: CompletedSessionSet[];
};

export type SessionPerformance = {
  sessionId: string;
  sessionName: string;
  date: string;
  durationSeconds: number | null;
  totalTonnageKg: number;
  completedSets: number;
  totalReps: number;
  exercises: CompletedSessionExercise[];
  comparison: {
    previousDate: string;
    tonnageChangeKg: number;
    durationChangeSeconds: number | null;
    repsChange: number;
  } | null;
};

export type SessionSummaryInput = {
  session_id: string;
  log_date: string;
  duration_seconds: number | null;
};

export type StrengthProgressPoint = {
  date: string;
  value: number;
  setLabel: string;
  isPersonalBest: boolean;
};

export type StrengthTrackerProgress = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  metricType: StrengthMetricType;
  metricLabel: string;
  unit: string;
  currentValue: number | null;
  bestValue: number | null;
  change: number | null;
  latestSetLabel: string | null;
  latestDate: string | null;
  points: StrengthProgressPoint[];
};

export type TrainingConsistency = {
  completedSessions: number;
  plannedSessions: number;
  completedPlannedSessions: number;
  completionRate: number | null;
  currentWeekCompleted: number;
  currentWeekPlanned: number;
  activeWeekStreak: number;
  weeks: Array<{
    weekStart: string;
    planned: number;
    completed: number;
  }>;
};

export type StrengthProgressPayload = {
  today: string;
  consistency: TrainingConsistency;
  sessions: SessionPerformance[];
  trackers: StrengthTrackerProgress[];
};

type TrainingAssignmentInput = {
  session_id: string;
  week_start: string;
  planned_date: string | null;
};

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.trim().replace(",", ".").match(/^-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateSessionTotals(sets: StrengthSetInput[]) {
  let totalTonnageKg = 0;
  let completedSets = 0;
  let totalReps = 0;

  for (const set of sets) {
    if (set.completed === false) continue;
    const weight = numberFrom(set.weight);
    const reps = numberFrom(set.reps);
    if (weight === null && reps === null) continue;
    completedSets += 1;
    if (reps !== null && reps > 0 && reps <= 10_000) totalReps += Math.round(reps);
    if (weight !== null && weight > 0 && reps !== null && reps > 0) {
      totalTonnageKg += weight * reps;
    }
  }

  return {
    totalTonnageKg: rounded(totalTonnageKg),
    completedSets,
    totalReps,
  };
}

export function buildSessionPerformance({
  logs,
  sessions,
  summaries,
}: {
  logs: StrengthLogInput[];
  sessions: Array<{ id: string; name: string }>;
  summaries: SessionSummaryInput[];
}): SessionPerformance[] {
  const sessionNames = new Map(sessions.map((session) => [session.id, session.name]));
  const durationByOccurrence = new Map(
    summaries.map((summary) => [
      `${summary.session_id}:${summary.log_date}`,
      Number.isFinite(Number(summary.duration_seconds)) ? Number(summary.duration_seconds) : null,
    ]),
  );
  const logsByOccurrence = new Map<string, StrengthLogInput[]>();

  for (const log of logs) {
    if (!log.completed || !log.session_id) continue;
    const key = `${log.session_id}:${log.log_date}`;
    logsByOccurrence.set(key, [...(logsByOccurrence.get(key) || []), log]);
  }

  const raw: SessionPerformance[] = [...logsByOccurrence.entries()].map(([key, occurrenceLogs]): SessionPerformance => {
    const [sessionId, date] = key.split(":");
    const exerciseMap = new Map<string, CompletedSessionExercise>();

    for (const log of occurrenceLogs) {
      const sets: CompletedSessionSet[] = [];
      for (const [index, set] of log.sets_data.entries()) {
        if (set.completed === false) continue;
        const weight = numberFrom(set.weight);
        const reps = numberFrom(set.reps);
        const rawWeight = typeof set.weight === "string" ? set.weight.trim() : weight === null ? "" : String(weight);
        const rawReps = typeof set.reps === "string" ? set.reps.trim() : reps === null ? "" : String(reps);
        if (weight === null && reps === null) continue;
        sets.push({
          setNumber: index + 1,
          displayValue: rawWeight
            ? `${rawWeight}${/kg$/i.test(rawWeight) ? "" : "kg"}${rawReps ? ` × ${rawReps}` : ""}`
            : rawReps
              ? /[a-z:]|\s/i.test(rawReps) ? rawReps : `${rawReps} reps`
              : "Completed",
          weightKg: weight !== null && weight >= 0 ? weight : null,
          reps: reps !== null && reps > 0 ? Math.round(reps) : null,
          tonnageKg: weight !== null && weight > 0 && reps !== null && reps > 0 ? rounded(weight * reps) : 0,
        });
      }
      if (!sets.length) continue;
      const totals = calculateSessionTotals(log.sets_data);
      const existing = exerciseMap.get(log.exercise_id);
      exerciseMap.set(log.exercise_id, {
        exerciseId: log.exercise_id,
        exerciseName: log.exercise_name || existing?.exerciseName || "Exercise",
        completedSets: (existing?.completedSets || 0) + totals.completedSets,
        totalReps: (existing?.totalReps || 0) + totals.totalReps,
        totalTonnageKg: rounded((existing?.totalTonnageKg || 0) + totals.totalTonnageKg),
        sets: [...(existing?.sets || []), ...sets],
      });
    }

    const exercises = [...exerciseMap.values()];
    return {
      sessionId,
      sessionName: sessionNames.get(sessionId) || "Training session",
      date,
      durationSeconds: durationByOccurrence.get(key) ?? null,
      totalTonnageKg: rounded(exercises.reduce((sum, exercise) => sum + exercise.totalTonnageKg, 0)),
      completedSets: exercises.reduce((sum, exercise) => sum + exercise.completedSets, 0),
      totalReps: exercises.reduce((sum, exercise) => sum + exercise.totalReps, 0),
      exercises,
      comparison: null,
    };
  }).sort((left, right) => left.date.localeCompare(right.date));

  const previousBySession = new Map<string, SessionPerformance>();
  for (const performance of raw) {
    const previous = previousBySession.get(performance.sessionId);
    if (previous) {
      performance.comparison = {
        previousDate: previous.date,
        tonnageChangeKg: rounded(performance.totalTonnageKg - previous.totalTonnageKg),
        durationChangeSeconds: performance.durationSeconds !== null && previous.durationSeconds !== null
          ? performance.durationSeconds - previous.durationSeconds
          : null,
        repsChange: performance.totalReps - previous.totalReps,
      };
    }
    previousBySession.set(performance.sessionId, performance);
  }

  return raw.reverse().slice(0, 12);
}

export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || weightKg <= 0 || reps < 1 || reps > 12) return 0;
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function parseDurationSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== "string") return null;
  const normalised = value.trim().toLowerCase();
  if (!normalised) return null;

  const clock = normalised.match(/^(\d{1,3}):([0-5]\d)$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const minutes = normalised.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/);
  const seconds = normalised.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/);
  if (minutes || seconds) {
    return Math.round((Number(minutes?.[1] || 0) * 60) + Number(seconds?.[1] || 0));
  }

  const plain = numberFrom(normalised);
  return plain !== null && plain > 0 ? Math.round(plain) : null;
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (minutes === 0) return `${remainder}s`;
  if (remainder === 0) return `${minutes}m`;
  return `${minutes}m ${remainder}s`;
}

function candidateForSet(metricType: StrengthMetricType, set: StrengthSetInput) {
  // Older workout rows pre-date the explicit set-completed flag. A false flag
  // is authoritative; a missing flag remains eligible when its parent log is complete.
  if (set.completed === false) return null;
  const reps = numberFrom(set.reps);

  if (metricType === "load_reps") {
    const weight = numberFrom(set.weight);
    if (weight === null || reps === null || weight <= 0 || reps < 1 || reps > 12) return null;
    const value = estimateOneRepMax(weight, reps);
    return value > 0 ? { value, label: `${weight}kg × ${Math.round(reps)}` } : null;
  }

  if (metricType === "reps") {
    if (reps === null || reps < 1 || reps > 500) return null;
    return { value: Math.round(reps), label: `${Math.round(reps)} reps` };
  }

  const duration = parseDurationSeconds(set.reps) ?? parseDurationSeconds(set.notes);
  if (duration === null || duration < 1 || duration > 86_400) return null;
  return { value: duration, label: formatDuration(duration) };
}

export function strengthMetricPresentation(metricType: StrengthMetricType) {
  if (metricType === "reps") return { label: "Best completed set", unit: "reps" };
  if (metricType === "duration") return { label: "Best completed hold", unit: "seconds" };
  return { label: "Estimated strength", unit: "kg e1RM" };
}

export function buildStrengthTrackerProgress({
  id,
  exerciseId,
  exerciseName,
  metricType,
  logs,
}: {
  id: string;
  exerciseId: string;
  exerciseName: string;
  metricType: StrengthMetricType;
  logs: StrengthLogInput[];
}): StrengthTrackerProgress {
  const bestByDate = new Map<string, { value: number; label: string }>();

  for (const log of logs) {
    if (!log.completed || log.exercise_id !== exerciseId || !Array.isArray(log.sets_data)) continue;
    for (const set of log.sets_data) {
      const candidate = candidateForSet(metricType, set);
      if (!candidate) continue;
      const current = bestByDate.get(log.log_date);
      if (!current || candidate.value > current.value) bestByDate.set(log.log_date, candidate);
    }
  }

  let runningBest = -Infinity;
  const points = [...bestByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, point]) => {
      const isPersonalBest = point.value > runningBest;
      runningBest = Math.max(runningBest, point.value);
      return { date, value: point.value, setLabel: point.label, isPersonalBest };
    });

  const latest = points.at(-1) || null;
  const first = points[0] || null;
  const presentation = strengthMetricPresentation(metricType);

  return {
    id,
    exerciseId,
    exerciseName,
    metricType,
    metricLabel: presentation.label,
    unit: presentation.unit,
    currentValue: latest?.value ?? null,
    bestValue: points.length ? Math.max(...points.map((point) => point.value)) : null,
    change: latest && first && latest.date !== first.date
      ? Math.round((latest.value - first.value) * 10) / 10
      : null,
    latestSetLabel: latest?.setLabel ?? null,
    latestDate: latest?.date ?? null,
    points: points.slice(-12),
  };
}

export function weekStartForDateKey(dateKey: string): string {
  const date = new Date(`${dateKey.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateKey.slice(0, 10);
  const day = date.getUTCDay();
  return addDaysToKey(dateKey.slice(0, 10), day === 0 ? -6 : 1 - day);
}

export function buildTrainingConsistency({
  assignments,
  logs,
  todayKey,
}: {
  assignments: TrainingAssignmentInput[];
  logs: Array<Pick<StrengthLogInput, "session_id" | "log_date" | "completed">>;
  todayKey: string;
}): TrainingConsistency {
  const currentWeek = weekStartForDateKey(todayKey);
  const weekStarts = Array.from({ length: 4 }, (_, index) => addDaysToKey(currentWeek, (index - 3) * 7));
  const earliestWeek = weekStarts[0];

  const completedSessionDates = new Set(
    logs
      .filter((log) => log.completed && log.session_id && log.log_date >= earliestWeek && log.log_date <= todayKey)
      .map((log) => `${log.session_id}:${log.log_date}`),
  );
  const completedWeekSessions = new Set(
    logs
      .filter((log) => log.completed && log.session_id && log.log_date <= todayKey)
      .map((log) => `${weekStartForDateKey(log.log_date)}:${log.session_id}`),
  );

  const relevantAssignments = assignments.filter((assignment) =>
    assignment.planned_date &&
    assignment.planned_date >= earliestWeek &&
    assignment.planned_date <= todayKey
  );
  const completedPlanned = relevantAssignments.filter((assignment) =>
    completedWeekSessions.has(`${assignment.week_start}:${assignment.session_id}`)
  );

  const weeks = weekStarts.map((weekStart) => {
    const planned = relevantAssignments.filter((assignment) => assignment.week_start === weekStart).length;
    const completed = new Set(
      logs
        .filter((log) =>
          log.completed &&
          log.session_id &&
          weekStartForDateKey(log.log_date) === weekStart &&
          log.log_date <= todayKey
        )
        .map((log) => `${log.session_id}:${log.log_date}`),
    ).size;
    return { weekStart, planned, completed };
  });

  const completedWeeks = new Set(
    logs
      .filter((log) => log.completed && log.session_id && log.log_date <= todayKey)
      .map((log) => weekStartForDateKey(log.log_date)),
  );
  let streakWeek = completedWeeks.has(currentWeek) ? currentWeek : addDaysToKey(currentWeek, -7);
  let activeWeekStreak = 0;
  while (activeWeekStreak < 52 && completedWeeks.has(streakWeek)) {
    activeWeekStreak += 1;
    streakWeek = addDaysToKey(streakWeek, -7);
  }

  const plannedSessions = relevantAssignments.length;
  const currentSummary = weeks.at(-1);
  return {
    completedSessions: completedSessionDates.size,
    plannedSessions,
    completedPlannedSessions: completedPlanned.length,
    completionRate: plannedSessions > 0
      ? Math.min(100, Math.round((completedPlanned.length / plannedSessions) * 100))
      : null,
    currentWeekCompleted: currentSummary?.completed || 0,
    currentWeekPlanned: currentSummary?.planned || 0,
    activeWeekStreak,
    weeks,
  };
}
