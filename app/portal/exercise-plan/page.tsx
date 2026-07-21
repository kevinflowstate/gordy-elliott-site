"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import CyclingStatusText from "@/components/ui/CyclingStatusText";
import { formatExercisePrescription, shouldUseSetLogging } from "@/lib/exercise-prescriptions";
import type { ClientExercisePlan, ExerciseSession, WeeklyTrainingAssignment } from "@/lib/types";

interface SetData {
  set_number: number;
  weight: string;
  reps: string;
  notes: string;
}

interface ExerciseLog {
  id: string;
  exercise_item_id: string;
  session_id: string;
  log_date: string;
  sets_data: SetData[];
  completed: boolean;
  notes: string | null;
}

// ---- date helpers ----

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday anchor
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function isToday(date: Date): boolean {
  return date.toDateString() === new Date().toDateString();
}

function isFuture(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
}

function weekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${weekStart.toLocaleDateString("en-GB", opts)} - ${end.toLocaleDateString("en-GB", opts)}`;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function sessionTimerKey(planId: string, sessionId: string, date: string) {
  return `shift-session-timer:${planId}:${sessionId}:${date}`;
}

function activeSessionPointerKey(planId: string) {
  return `shift-active-session:${planId}`;
}

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return formatElapsed(now - startedAt);
}

// ---- rotation logic ----

function getNextSession(sessions: ExerciseSession[], allLogs: ExerciseLog[]): ExerciseSession {
  const sortedLogs = allLogs
    .filter((l) => l.session_id)
    .sort((a, b) => b.log_date.localeCompare(a.log_date));

  if (sortedLogs.length === 0) return sessions[0];

  const lastSessionId = sortedLogs[0].session_id;
  const lastIndex = sessions.findIndex((s) => s.id === lastSessionId);
  const nextIndex = (lastIndex + 1) % sessions.length;
  return sessions[nextIndex];
}

// Evenly-spaced training days within a Mon-anchored week, by sessions/week.
const WEEK_PATTERNS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 2, 4, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

function buildVirtualSchedule(plan: ClientExercisePlan): Map<string, ExerciseSession> {
  const map = new Map<string, ExerciseSession>();
  if (!plan.sessions?.length) return map;
  const startRaw = plan.start_date || plan.created_at;
  const start = startRaw ? new Date(startRaw) : new Date();
  if (Number.isNaN(start.getTime())) return map;
  start.setHours(0, 0, 0, 0);

  const queue = [...plan.sessions].sort((a, b) => (a.day_number || 0) - (b.day_number || 0));
  const perWeekCounts = new Map<number, number>();

  for (const session of queue) {
    const week = Math.floor((Math.max(1, session.day_number || 1) - 1) / 7);
    perWeekCounts.set(week, (perWeekCounts.get(week) || 0) + 1);
  }

  const sessionsPerWeek = Math.min(7, Math.max(1, ...perWeekCounts.values()));
  const pattern = WEEK_PATTERNS[sessionsPerWeek];
  const startWeek = getWeekStart(start);
  const startDayIdx = Math.round((start.getTime() - startWeek.getTime()) / 86400000);

  let weekIndex = 0;
  while (queue.length > 0 && weekIndex < 80) {
    const days = weekIndex === 0 ? pattern.filter((idx) => idx >= startDayIdx) : pattern;
    for (const dayIdx of days) {
      const session = queue.shift();
      if (!session) break;
      const d = new Date(startWeek);
      d.setDate(d.getDate() + weekIndex * 7 + dayIdx);
      map.set(formatDate(d), session);
    }
    weekIndex += 1;
  }

  return map;
}

// ---- component ----

export default function PortalExercisePlanPage() {
  const [plan, setPlan] = useState<ClientExercisePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [allLogs, setAllLogs] = useState<ExerciseLog[]>([]);
  const [weeklyAssignments, setWeeklyAssignments] = useState<WeeklyTrainingAssignment[]>([]);
  const [plannerLoadedWeek, setPlannerLoadedWeek] = useState<string | null>(null);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [plannerSavingSessionId, setPlannerSavingSessionId] = useState<string | null>(null);
  const plannerRequestIdRef = useRef(0);
  const resumePointerHandledRef = useRef<string | null>(null);

  // Calendar state
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // Per-day session view
  const [activeSession, setActiveSession] = useState<ExerciseSession | null>(null);
  const [viewMode, setViewMode] = useState<"log" | "readonly">("log");
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [manuallyPicked, setManuallyPicked] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);

  // Draft inputs: exerciseItemId -> SetData[]
  const [draftSets, setDraftSets] = useState<Record<string, SetData[]>>({});
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch plan once
  useEffect(() => {
    fetch("/api/portal/exercise-plan")
      .then((r) => r.json())
      .then((data) => {
        setPlan(data.plan ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch logs for the visible week
  const fetchWeekLogs = useCallback(
    (ws: Date) => {
      const from = formatDate(ws);
      const end = new Date(ws);
      end.setDate(end.getDate() + 6);
      const to = formatDate(end);
      fetch(`/api/portal/exercise-log?from=${from}&to=${to}`)
        .then((r) => r.json())
        .then((data) => {
          setAllLogs((prev) => {
            // Merge: remove old logs in this range, add new ones
            const filtered = prev.filter((l) => l.log_date < from || l.log_date > to);
            return [...filtered, ...(data.logs || [])];
          });
        })
        .catch(console.error);
    },
    []
  );

  useEffect(() => {
    fetchWeekLogs(weekStart);
  }, [weekStart, fetchWeekLogs]);

  const fetchWeekPlanner = useCallback(
    (ws: Date) => {
      if (!plan?.id) {
        setWeeklyAssignments([]);
        setPlannerLoadedWeek(null);
        return;
      }
      const week = formatDate(ws);
      const requestId = plannerRequestIdRef.current + 1;
      plannerRequestIdRef.current = requestId;
      setWeeklyAssignments([]);
      setPlannerLoadedWeek(null);
      setPlannerError(null);
      setPlannerLoading(true);
      fetch(`/api/portal/training-planner?plan_id=${plan.id}&week_start=${week}`)
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw new Error(data?.error || "Weekly planner could not load");
          }
          return data;
        })
        .then((data) => {
          if (requestId !== plannerRequestIdRef.current) return;
          setWeeklyAssignments(data.assignments || []);
          setPlannerLoadedWeek(week);
          setPlannerError(null);
        })
        .catch((err) => {
          if (requestId !== plannerRequestIdRef.current) return;
          console.error("Failed to fetch weekly planner:", err);
          setWeeklyAssignments([]);
          setPlannerLoadedWeek(null);
          setPlannerError("Weekly planner could not load. Try refreshing the page.");
        })
        .finally(() => {
          if (requestId === plannerRequestIdRef.current) {
            setPlannerLoading(false);
          }
        });
    },
    [plan?.id],
  );

  useEffect(() => {
    fetchWeekPlanner(weekStart);
  }, [weekStart, fetchWeekPlanner]);

  const sortedSessions = useMemo(
    () => [...(plan?.sessions || [])].sort((a, b) => (a.day_number || 0) - (b.day_number || 0)),
    [plan?.sessions],
  );
  const plannerLoadedForVisibleWeek = plannerLoadedWeek === formatDate(weekStart);
  const visibleWeeklyAssignments = useMemo(
    () => (plannerLoadedForVisibleWeek ? weeklyAssignments : []),
    [plannerLoadedForVisibleWeek, weeklyAssignments],
  );

  const assignmentBySessionId = useMemo(() => {
    const map = new Map<string, WeeklyTrainingAssignment>();
    for (const assignment of visibleWeeklyAssignments) {
      map.set(assignment.session_id, assignment);
    }
    return map;
  }, [visibleWeeklyAssignments]);

  const plannedSessionsByDate = useMemo(() => {
    const map = new Map<string, ExerciseSession[]>();
    if (!plan?.sessions?.length) return map;

    for (const assignment of visibleWeeklyAssignments) {
      if (!assignment.planned_date) continue;
      const session = plan.sessions.find((s) => s.id === assignment.session_id);
      if (!session) continue;
      const list = map.get(assignment.planned_date) || [];
      list.push(session);
      map.set(assignment.planned_date, list);
    }

    for (const sessions of map.values()) {
      sessions.sort((a, b) => (a.day_number || 0) - (b.day_number || 0));
    }

    return map;
  }, [plan?.sessions, visibleWeeklyAssignments]);

  const fallbackSessionsByDate = useMemo(() => {
    const map = new Map<string, ExerciseSession[]>();
    if (!plan || !plannerLoadedForVisibleWeek || visibleWeeklyAssignments.length > 0) return map;

    const virtualSchedule = buildVirtualSchedule(plan);
    for (const [date, session] of virtualSchedule.entries()) {
      map.set(date, [session]);
    }

    return map;
  }, [plan, plannerLoadedForVisibleWeek, visibleWeeklyAssignments.length]);

  const calendarSessionsByDate = visibleWeeklyAssignments.length > 0 ? plannedSessionsByDate : fallbackSessionsByDate;

  // When selected date changes, figure out what session to show
  useEffect(() => {
    if (!plan?.sessions?.length) return;

    const dateStr = formatDate(selectedDate);
    const dayLogs = allLogs.filter((l) => l.log_date === dateStr && l.session_id);

    if (dayLogs.length > 0) {
      // Day already has a logged session — find which session
      const sessionId = dayLogs[0].session_id;
      const session = plan.sessions.find((s) => s.id === sessionId) ?? plan.sessions[0];
      setActiveSession(session);
      setViewMode("readonly");
      setManuallyPicked(false);
      setSessionOpen(false);
    } else {
      // No log for this day — use the auto-populated calendar (unless the
      // user explicitly picked a session). Days with nothing scheduled are
      // rest days and get Start Next Session / Add Session instead.
      if (!manuallyPicked) {
        const scheduled = calendarSessionsByDate.get(dateStr)?.[0] || null;
        if (scheduled) {
          setActiveSession(scheduled);
          initDrafts(scheduled);
        } else {
          setActiveSession(null);
          setSessionOpen(false);
        }
      }
      setViewMode("log");
    }
  }, [selectedDate, allLogs, plan, manuallyPicked, calendarSessionsByDate]);

  function initDrafts(session: ExerciseSession) {
    const drafts: Record<string, SetData[]> = {};
    for (const item of session.items) {
      if (item.exercise_id === "__section__") continue;
      const setsCount = shouldUseSetLogging(item) ? Number(item.sets) || 3 : 1;
      drafts[item.id] = Array.from({ length: setsCount }, (_, i) => ({
        set_number: i + 1,
        weight: "",
        reps: "",
        notes: "",
      }));
    }
    setDraftSets(drafts);
  }

  function updateSet(itemId: string, setIdx: number, field: keyof SetData, value: string) {
    setDraftSets((prev) => {
      const sets = [...(prev[itemId] || [])];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      return { ...prev, [itemId]: sets };
    });
  }

  function addSet(itemId: string) {
    setDraftSets((prev) => {
      const sets = prev[itemId] || [];
      return {
        ...prev,
        [itemId]: [...sets, { set_number: sets.length + 1, weight: "", reps: "", notes: "" }],
      };
    });
  }

  async function saveSession() {
    if (!activeSession) return;
    const dateStr = formatDate(selectedDate);
    setSaving(true);
    setSaveError(null);
    try {
      const exercises = activeSession.items.filter((i) => i.exercise_id !== "__section__");
      const results = await Promise.all(
        exercises.map((item) => {
          const sets = draftSets[item.id] || [];
          const completed = sets.some((s) => s.reps.trim() !== "");
          return fetch("/api/portal/exercise-log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              exercise_item_id: item.id,
              session_id: activeSession.id,
              date: dateStr,
              sets_data: sets,
              completed,
            }),
          }).then(async (response) => {
            const data = await response.json().catch(() => ({}));
            return { ok: response.ok, data };
          });
        })
      );

      const failed = results.find((result) => !result.ok);
      if (failed) {
        throw new Error(failed.data?.error || "We couldn't save this session. Please try again.");
      }

      // Refresh week logs
      await fetchWeekLogs(weekStart);
      finishSessionTimer(activeSession.id, dateStr);
      setViewMode("readonly");
      setSessionOpen(false);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (err) {
      console.error("Failed to save session:", err);
      setSaveError(err instanceof Error ? err.message : "We couldn't save this session.");
    } finally {
      setSaving(false);
    }
  }

  // Derived
  const weekDays = getWeekDays(weekStart);

  function hasLogOnDay(date: Date): boolean {
    const dateStr = formatDate(date);
    return allLogs.some((l) => l.log_date === dateStr && l.completed);
  }

  function navigateWeek(delta: number) {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }

  function selectDay(day: Date) {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
    setManuallyPicked(false);
    setSessionOpen(false);
  }

  function pickSession(session: ExerciseSession) {
    setActiveSession(session);
    initDrafts(session);
    setViewMode("log");
    setManuallyPicked(true);
    setSessionOpen(true);
    setShowSessionPicker(false);
  }

  async function savePlannerAssignment(
    sessionId: string,
    plannedDate: string | null,
    isRecurring?: boolean,
    recurrenceStopped?: boolean,
  ) {
    if (!plan) return;
    const existing = assignmentBySessionId.get(sessionId);
    const nextRecurring = Boolean(plannedDate && (isRecurring ?? existing?.is_recurring));
    const nextRecurrenceStopped = Boolean(recurrenceStopped ?? existing?.recurrence_stopped);

    setPlannerSavingSessionId(sessionId);
    setPlannerError(null);
    try {
      const response = await fetch("/api/portal/training-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: plan.id,
          session_id: sessionId,
          week_start: formatDate(weekStart),
          planned_date: plannedDate,
          is_recurring: nextRecurring,
          recurrence_stopped: nextRecurring ? false : nextRecurrenceStopped,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Planner update failed");
      }

      const assignment = data.assignment as WeeklyTrainingAssignment;
      setPlannerLoadedWeek(formatDate(weekStart));
      setWeeklyAssignments((prev) => [
        ...prev.filter((item) => item.session_id !== sessionId),
        assignment,
      ]);

      if (!manuallyPicked) {
        const selected = formatDate(selectedDate);
        const movedSession = plan.sessions.find((session) => session.id === sessionId);
        const wasActive = activeSession?.id === sessionId;
        if (plannedDate === selected && movedSession) {
          setActiveSession(movedSession);
          initDrafts(movedSession);
          setViewMode("log");
        } else if (wasActive && existing?.planned_date === selected) {
          setActiveSession(null);
          setSessionOpen(false);
        }
      }
    } catch (err) {
      console.error("Failed to save weekly planner assignment:", err);
      setPlannerError(err instanceof Error ? err.message : "Planner update failed");
    } finally {
      setPlannerSavingSessionId(null);
    }
  }

  const selectedDateStr = formatDate(selectedDate);
  const dayLogs = allLogs.filter((l) => l.log_date === selectedDateStr);
  const isPast = !isToday(selectedDate) && !isFuture(selectedDate);

  // Keep the picker aligned with the active plan order.
  const weekSessions = sortedSessions;

  // Sessions logged in the visible week (for weekly summary trust signal)
  const weekStartStr = formatDate(weekStart);
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEndStr = formatDate(weekEndDate);
  const sessionsThisWeek = new Set(
    allLogs
      .filter((l) => l.log_date >= weekStartStr && l.log_date <= weekEndStr && l.completed && l.session_id)
      .map((l) => `${l.log_date}:${l.session_id}`),
  ).size;
  const totalPlanSessions = plan?.sessions?.length || 0;
  const placedSessionsCount = sortedSessions.filter((session) => Boolean(assignmentBySessionId.get(session.id)?.planned_date)).length;
  const unassignedSessions = sortedSessions.filter((session) => !assignmentBySessionId.get(session.id)?.planned_date);
  const nextSession = sortedSessions.length > 0
    ? getNextSession(sortedSessions, allLogs.filter((log) => log.log_date <= selectedDateStr))
    : null;
  const primarySession = activeSession || nextSession;

  useEffect(() => {
    if (!plan?.id || resumePointerHandledRef.current === plan.id) return;
    resumePointerHandledRef.current = plan.id;
    try {
      const raw = window.localStorage.getItem(activeSessionPointerKey(plan.id));
      const pointer = raw ? JSON.parse(raw) as {
        sessionId?: string;
        date?: string;
        startedAt?: number;
        draftSets?: Record<string, SetData[]>;
      } : null;
      const session = pointer?.sessionId ? plan.sessions.find((item) => item.id === pointer.sessionId) : null;
      const date = pointer?.date ? new Date(`${pointer.date}T00:00:00`) : null;
      const valid = session && date && !Number.isNaN(date.getTime()) && pointer?.startedAt && Date.now() - pointer.startedAt < 6 * 60 * 60 * 1000;
      if (!valid || !session || !date) {
        window.localStorage.removeItem(activeSessionPointerKey(plan.id));
        return;
      }
      setWeekStart(getWeekStart(date));
      setSelectedDate(date);
      setActiveSession(session);
      if (pointer.draftSets && typeof pointer.draftSets === "object") {
        setDraftSets(pointer.draftSets);
      } else {
        initDrafts(session);
      }
      setViewMode("log");
      setManuallyPicked(true);
      setSessionOpen(true);
    } catch {
      window.localStorage.removeItem(activeSessionPointerKey(plan.id));
    }
  }, [plan]);

  useEffect(() => {
    if (!plan?.id || !activeSession || !sessionStartedAt || viewMode !== "log") return;
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(activeSessionPointerKey(plan.id), JSON.stringify({
          sessionId: activeSession.id,
          date: selectedDateStr,
          startedAt: sessionStartedAt,
          draftSets,
        }));
      } catch {
        // Draft persistence is best-effort when storage is unavailable.
      }
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [activeSession, draftSets, plan?.id, selectedDateStr, sessionStartedAt, viewMode]);

  useEffect(() => {
    if (!plan?.id || !activeSession || viewMode !== "log") {
      setSessionStartedAt(null);
      return;
    }

    let startedAt: number | null = null;
    try {
      const raw = window.localStorage.getItem(sessionTimerKey(plan.id, activeSession.id, selectedDateStr));
      const parsed = raw ? Number(raw) : NaN;
      startedAt = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      if (startedAt && Date.now() - startedAt > 6 * 60 * 60 * 1000) {
        window.localStorage.removeItem(sessionTimerKey(plan.id, activeSession.id, selectedDateStr));
        window.localStorage.removeItem(activeSessionPointerKey(plan.id));
        startedAt = null;
      }
    } catch {
      startedAt = null;
    }
    setSessionStartedAt(startedAt);
    if (startedAt) setSessionOpen(true);
  }, [activeSession, plan?.id, selectedDateStr, viewMode]);

  function startSessionTimer(session: ExerciseSession) {
    if (!plan?.id || viewMode === "readonly") return;
    if (activeSession?.id !== session.id) {
      setActiveSession(session);
      initDrafts(session);
      setViewMode("log");
      setManuallyPicked(true);
    }
    const startedAt = Date.now();
    setSessionStartedAt(startedAt);
    setSessionOpen(true);
    try {
      const pointerRaw = window.localStorage.getItem(activeSessionPointerKey(plan.id));
      const pointer = pointerRaw ? JSON.parse(pointerRaw) as { sessionId?: string; date?: string } : null;
      if (pointer?.sessionId && pointer.date && (pointer.sessionId !== session.id || pointer.date !== selectedDateStr)) {
        window.localStorage.removeItem(sessionTimerKey(plan.id, pointer.sessionId, pointer.date));
      }
      window.localStorage.setItem(sessionTimerKey(plan.id, session.id, selectedDateStr), String(startedAt));
      window.localStorage.setItem(activeSessionPointerKey(plan.id), JSON.stringify({
        sessionId: session.id,
        date: selectedDateStr,
        startedAt,
        draftSets,
      }));
    } catch {
      // The timer still works for this visit when local storage is unavailable.
    }
  }

  function finishSessionTimer(sessionId: string, dateStr: string) {
    if (!plan?.id) return;
    setSessionStartedAt(null);
    try {
      window.localStorage.removeItem(sessionTimerKey(plan.id, sessionId, dateStr));
      const pointerRaw = window.localStorage.getItem(activeSessionPointerKey(plan.id));
      const pointer = pointerRaw ? JSON.parse(pointerRaw) as { sessionId?: string; date?: string } : null;
      if (pointer?.sessionId === sessionId && pointer.date === dateStr) {
        window.localStorage.removeItem(activeSessionPointerKey(plan.id));
      }
    } catch {
      // Completion persistence is best-effort.
    }
  }

  function openPrimarySession() {
    if (!primarySession) return;
    if (viewMode === "readonly" && activeSession?.id === primarySession.id) {
      setSessionOpen(true);
      return;
    }
    if (sessionStartedAt && activeSession?.id === primarySession.id) {
      setSessionOpen(true);
      return;
    }
    startSessionTimer(primarySession);
  }

  function dayChipClass(active: boolean, disabled: boolean) {
    return `min-w-10 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
      active
        ? "border-[#E040D0] bg-[#E040D0] text-white"
        : "border-[rgba(0,0,0,0.08)] text-text-secondary hover:border-[#E040D0]/40 hover:text-[#E040D0]"
    } ${disabled ? "cursor-wait opacity-50" : "cursor-pointer"}`;
  }

  function renderPlannerDayChips(session: ExerciseSession, labelPrefix: string) {
    const assignment = assignmentBySessionId.get(session.id);
    const saving = plannerSavingSessionId === session.id;
    return (
      <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`${labelPrefix} ${session.name}`}>
        {weekDays.map((day, i) => {
          const dayStr = formatDate(day);
          const active = assignment?.planned_date === dayStr;
          const occupied = Boolean(plannedSessionsByDate.get(dayStr)?.some((plannedSession) => plannedSession.id !== session.id));
          const disabled = saving || active || occupied;
          return (
            <button
              key={dayStr}
              type="button"
              disabled={disabled}
              onClick={() => savePlannerAssignment(session.id, dayStr, assignment?.is_recurring, assignment?.recurrence_stopped)}
              className={dayChipClass(active, disabled)}
              title={occupied ? "That day already has a planned session" : undefined}
              aria-pressed={active}
              aria-label={active
                ? `${DAY_NAMES[i]}, assigned to ${session.name}`
                : occupied
                  ? `${DAY_NAMES[i]}, unavailable because another session is assigned`
                  : `Assign ${session.name} to ${DAY_NAMES[i]}`}
            >
              {DAY_NAMES[i]}
            </button>
          );
        })}
      </div>
    );
  }

  // ---- render ----

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[rgba(0,0,0,0.06)] rounded-xl w-48" />
          <div className="h-32 bg-[rgba(0,0,0,0.06)] rounded-2xl" />
          <div className="h-64 bg-[rgba(0,0,0,0.06)] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary mb-4">My Training Plan</h1>
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-10 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-text-secondary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          <p className="text-text-secondary text-lg font-medium">No workout plan assigned yet</p>
          <p className="text-text-secondary/60 mt-1 text-sm">Your coach will set one up for you soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-3 pb-40 sm:mx-auto sm:max-w-4xl sm:p-6 sm:pb-6 relative">
      {/* Toast */}
      {savedToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#E040D0] text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg text-sm">
          Session saved!
        </div>
      )}

      {/* First-screen training actions */}
      <div className="mb-5 space-y-3">
        <div className="app-hero app-rise app-rise-1 overflow-hidden rounded-[24px] p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[#F7A8EE]">Training</div>
              <h1 className="text-2xl font-heading font-bold leading-tight text-white">{plan.name}</h1>
              <p className="mt-1 text-xs text-white/65">{sessionsThisWeek} logged this week · {placedSessionsCount}/{totalPlanSessions} scheduled</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">
              {weekLabel(weekStart)}
            </span>
          </div>
        </div>

        <section className={`rounded-[24px] border bg-bg-card p-4 transition-all duration-300 ${
          sessionStartedAt
            ? "border-[#E040D0]/55 shadow-[0_0_0_1px_rgba(224,64,208,0.35),0_0_28px_rgba(224,64,208,0.25)]"
            : "border-white/[0.08]"
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E667D6]">
                {sessionStartedAt ? "Session in progress" : activeSession ? "Selected session" : "Next in your plan"}
              </div>
              <h2 className="mt-1 text-xl font-heading font-bold text-text-primary">{primarySession?.name || "No session available"}</h2>
              <p className="mt-1 text-xs text-text-secondary">
                {selectedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                {primarySession ? ` · ${primarySession.items.filter((item) => item.exercise_id !== "__section__").length} exercises` : ""}
              </p>
            </div>
            {sessionStartedAt && (
              <span className="metric-num inline-flex shrink-0 items-center gap-2 rounded-full border border-[#E040D0]/30 bg-[#E040D0]/10 px-3 py-1.5 text-base font-bold text-[#F060E0]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#F060E0]" />
                <ElapsedTime startedAt={sessionStartedAt} />
              </span>
            )}
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              onClick={openPrimarySession}
              disabled={!primarySession}
              className="min-h-12 rounded-xl bg-[#E040D0] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#F060E0] disabled:opacity-40"
            >
              {viewMode === "readonly" && activeSession ? "View logged session" : sessionStartedAt ? "Resume session" : activeSession ? "Start session" : "Start next session"}
            </button>
            <button
              type="button"
              onClick={() => setShowSessionPicker(true)}
              disabled={viewMode === "readonly"}
              className="min-h-12 rounded-xl border border-[#E040D0]/30 px-4 py-3 text-sm font-semibold text-[#F060E0] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-text-muted"
            >
              {viewMode === "readonly" ? "Logged" : "Choose"}
            </button>
          </div>
        </section>

        <section className="app-card rounded-[24px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E667D6]">Your Training Plan</div>
              <h2 className="mt-1 text-lg font-heading font-bold text-text-primary">Browse and schedule sessions</h2>
            </div>
            <span className="rounded-full border border-white/[0.08] px-3 py-1 text-xs font-semibold text-text-secondary">{totalPlanSessions} session{totalPlanSessions === 1 ? "" : "s"}</span>
          </div>
          {plannerLoading ? (
            <div className="mt-4 h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
          ) : (
            <div className="mt-4 space-y-2">
              {sortedSessions.map((session) => {
                const assignment = assignmentBySessionId.get(session.id);
                const exerciseItems = session.items.filter((item) => item.exercise_id !== "__section__");
                return (
                  <details key={session.id} className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
                    <summary className="flex list-none items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E040D0]/10 text-sm font-bold text-[#F060E0]">{session.day_number}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-text-primary">{session.name}</span>
                        <span className="mt-0.5 block text-[11px] text-text-muted">
                          {exerciseItems.length} exercises{assignment?.planned_date ? ` · ${new Date(`${assignment.planned_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" })}` : " · Not scheduled"}
                        </span>
                      </span>
                      <svg className="h-4 w-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" /></svg>
                    </summary>
                    <div className="mt-3 border-t border-white/[0.06] pt-3">
                      <div className="space-y-2">
                        {exerciseItems.map((item) => (
                          <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                            <span className="text-text-secondary">{item.exercise?.name || "Exercise"}</span>
                            <span className="shrink-0 font-semibold text-[#F060E0]">{formatExercisePrescription(item)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 border-t border-white/[0.06] pt-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Assign this week</div>
                        {renderPlannerDayChips(session, "Assign")}
                        {assignment?.planned_date && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={plannerSavingSessionId === session.id}
                              onClick={() => savePlannerAssignment(session.id, assignment.planned_date, !assignment.is_recurring, assignment.is_recurring)}
                              className="rounded-xl border border-white/[0.10] px-3 py-2 text-[11px] font-semibold text-text-secondary"
                            >
                              {assignment.is_recurring ? "Stop repeating" : "Repeat weekly"}
                            </button>
                            <button
                              type="button"
                              disabled={plannerSavingSessionId === session.id}
                              onClick={() => savePlannerAssignment(session.id, null, false, assignment.recurrence_stopped)}
                              className="rounded-xl border border-amber-500/20 px-3 py-2 text-[11px] font-semibold text-amber-500"
                            >
                              Unassign
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
          {plannerError && <p className="mt-3 text-sm text-red-400">{plannerError}</p>}
        </section>
      </div>

      {/* ---- Week Calendar Strip ---- */}
      <div className="app-card-quiet rounded-2xl p-4 mb-5">
        {/* Week nav */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigateWeek(-1)}
            className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.05)] transition-colors cursor-pointer"
            aria-label="Previous week"
          >
            <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-secondary">{weekLabel(weekStart)}</span>
            <button
              onClick={() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                setWeekStart(getWeekStart(today));
                setSelectedDate(today);
              }}
              className="rounded-lg border border-[rgba(0,0,0,0.08)] px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition-colors hover:text-text-primary hover:border-[#E040D0]/30 cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={() => navigateWeek(1)}
              className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.05)] transition-colors cursor-pointer"
              aria-label="Next week"
            >
              <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Day buttons */}
        <div className="grid grid-cols-7 gap-1 pb-1">
          {weekDays.map((day, i) => {
            const dayStr = formatDate(day);
            const isSelected = dayStr === selectedDateStr;
            const todayDay = isToday(day);
            const hasLog = hasLogOnDay(day);
            const hasPlanned = Boolean(calendarSessionsByDate.get(dayStr)?.length);

            return (
              <button
                key={i}
                onClick={() => selectDay(day)}
                className={`relative flex min-w-0 flex-col items-center justify-center rounded-xl px-0.5 py-2.5 transition-all cursor-pointer
                  ${todayDay
                    ? "bg-[#E040D0] text-white"
                    : isSelected
                    ? "border-2 border-[#E040D0] text-text-primary bg-[rgba(224,64,208,0.06)]"
                    : "hover:bg-[rgba(0,0,0,0.04)] text-text-secondary border-2 border-transparent"
                  }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide mb-0.5">
                  {DAY_NAMES[i]}
                </span>
                <span className="text-sm font-bold leading-none">{day.getDate()}</span>
                {/* Dot indicator: solid = logged, faded = session planned */}
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full transition-all ${
                  hasLog
                    ? `opacity-100 ${todayDay ? "bg-white" : "bg-[#E040D0]"}`
                    : hasPlanned
                    ? `opacity-60 ${todayDay ? "bg-white" : "bg-[#E040D0]"}`
                    : "opacity-0"
                }`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Weekly Planner ---- */}
      <section className="app-card rounded-[28px] p-4 mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E667D6]">Plan Your Week</div>
            <h2 className="mt-1 text-lg font-heading font-bold text-text-primary">
              {placedSessionsCount}/{totalPlanSessions} sessions placed
            </h2>
          </div>
          <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
            unassignedSessions.length > 0
              ? "border-amber-500/25 bg-amber-500/10 text-amber-500"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
          }`}>
            {unassignedSessions.length > 0
              ? `${unassignedSessions.length} unassigned`
              : "Week ready"}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-7">
          {weekDays.map((day, i) => {
            const dayStr = formatDate(day);
            const planned = plannedSessionsByDate.get(dayStr) || [];
            return (
              <button
                key={dayStr}
                type="button"
                onClick={() => selectDay(day)}
                className={`min-h-[92px] rounded-2xl border p-3 text-left transition-colors cursor-pointer ${
                  selectedDateStr === dayStr
                    ? "border-[#E040D0] bg-[#E040D0]/8"
                    : "border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.015)] hover:border-[#E040D0]/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{DAY_NAMES[i]}</span>
                  <span className="text-xs font-heading font-bold text-text-primary">{day.getDate()}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {planned.length > 0 ? planned.map((session) => (
                    <div key={session.id} className="truncate rounded-lg bg-[#E040D0]/10 px-2 py-1 text-[11px] font-semibold text-[#E040D0]">
                      {session.name}
                    </div>
                  )) : (
                    <div className="text-[11px] text-text-muted">Open</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {plannerLoading ? (
          <div className="mt-4 rounded-2xl border border-[rgba(0,0,0,0.06)] px-4 py-3 text-sm text-text-muted">
            Loading weekly planner...
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {plannerError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-400">
                {plannerError}
              </div>
            )}
            {unassignedSessions.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-500">Needs Assigning</h3>
                <div className="mt-2 space-y-2">
                  {unassignedSessions.map((session) => (
                    <div key={session.id} className="rounded-2xl border border-amber-500/15 bg-amber-500/5 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-text-primary">{session.name}</div>
                          <div className="mt-0.5 text-[11px] text-text-muted">Session {session.day_number}</div>
                        </div>
                        {plannerSavingSessionId === session.id && (
                          <span className="text-[11px] font-semibold text-text-muted">Saving...</span>
                        )}
                      </div>
                      {renderPlannerDayChips(session, "Assign")}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sortedSessions.some((session) => assignmentBySessionId.get(session.id)?.planned_date) && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">Placed Sessions</h3>
                <div className="mt-2 space-y-2">
                  {sortedSessions.map((session) => {
                    const assignment = assignmentBySessionId.get(session.id);
                    if (!assignment?.planned_date) return null;
                    const plannedLabel = new Date(`${assignment.planned_date}T00:00:00`).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    });
                    const saving = plannerSavingSessionId === session.id;
                    return (
                      <div key={session.id} className="rounded-2xl border border-[rgba(0,0,0,0.06)] px-4 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-text-primary">{session.name}</div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-[#E040D0]/10 px-2.5 py-1 text-[11px] font-semibold text-[#E040D0]">
                                {plannedLabel}
                              </span>
                              {assignment.is_recurring && (
                                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-500">
                                  Weekly
                                </span>
                              )}
                              {assignment.source === "recurring" && (
                                <span className="rounded-full bg-[rgba(0,0,0,0.04)] px-2.5 py-1 text-[11px] font-semibold text-text-muted">
                                  Recurring plan
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => savePlannerAssignment(session.id, assignment.planned_date, !assignment.is_recurring, assignment.is_recurring)}
                              className="rounded-xl border border-[rgba(0,0,0,0.08)] px-3 py-2 text-[11px] font-semibold text-text-secondary transition-colors hover:border-[#E040D0]/35 hover:text-[#E040D0] disabled:opacity-50"
                            >
                              {assignment.is_recurring ? "Stop Weekly" : "Make Weekly"}
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => savePlannerAssignment(session.id, null, false, assignment.recurrence_stopped)}
                              className="rounded-xl border border-amber-500/20 px-3 py-2 text-[11px] font-semibold text-amber-500 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                            >
                              Unassign
                            </button>
                          </div>
                        </div>
                        {renderPlannerDayChips(session, "Move")}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---- Rest day: nothing scheduled on this date ---- */}
      {!activeSession && (
        <div className="app-card rounded-[28px] p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E040D0]/10">
            <svg className="h-6 w-6 text-[#F060E0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </div>
          <h2 className="text-lg font-heading font-bold text-text-primary">Rest day</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-text-secondary">
            {isPast
              ? "No session was scheduled for this day."
              : "Nothing scheduled. Recovery is part of the programme — take it."}
          </p>
          {!isPast && (
            <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  const next = getNextSession(plan.sessions, allLogs.filter((log) => log.log_date <= selectedDateStr));
                  pickSession(next);
                }}
                className="w-full rounded-xl gradient-accent px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer sm:w-auto"
              >
                Start Next Session
              </button>
              <button
                type="button"
                onClick={() => setShowSessionPicker(true)}
                className="w-full rounded-xl border border-[#E040D0]/30 px-5 py-2.5 text-sm font-semibold text-[#F060E0] transition-colors hover:bg-[#E040D0]/10 cursor-pointer sm:w-auto"
              >
                Add Session
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---- Selected Day Content ---- */}
      {activeSession && (
        <div className={`app-card rounded-[28px] overflow-hidden transition-all duration-300 ${
          sessionStartedAt
            ? "border-[#E040D0]/55 shadow-[0_0_0_1px_rgba(224,64,208,0.35),0_0_28px_rgba(224,64,208,0.25)]"
            : ""
        }`}>
          <button
            type="button"
            onClick={() => setSessionOpen((open) => !open)}
            className="w-full p-5 text-left app-tap"
            aria-expanded={sessionOpen}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#E040D0] uppercase tracking-wider mb-1">
                  {viewMode === "readonly" ? "Logged session" : isToday(selectedDate) ? "Next session" : isPast ? "Retro session" : "Planned session"}
                </p>
                <h2 className="text-xl font-bold text-text-primary">{activeSession.name}</h2>
                {activeSession.notes && (
                  <p className="text-sm text-text-secondary mt-1 italic">{activeSession.notes}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {sessionStartedAt ? (
                  <span className="metric-num inline-flex items-center gap-1.5 rounded-full border border-[#E040D0]/30 bg-[#E040D0]/10 px-3 py-1 text-sm font-bold text-[#F060E0]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#F060E0]" />
                    <ElapsedTime startedAt={sessionStartedAt} />
                  </span>
                ) : (
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                    viewMode === "readonly"
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
                      : "border-[#E040D0]/25 bg-[#E040D0]/10 text-[#E040D0]"
                  }`}>
                    {viewMode === "readonly" ? "Logged" : "Start"}
                  </span>
                )}
                <span className="text-xs px-3 py-1 rounded-full bg-[rgba(224,64,208,0.12)] text-[#E040D0] font-semibold">
                  {activeSession.items.filter((i) => i.exercise_id !== "__section__").length} exercises
                </span>
              </div>
            </div>
            {!sessionOpen && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#E040D0]/25 bg-[linear-gradient(135deg,rgba(224,64,208,0.16),rgba(224,64,208,0.04))] px-4 py-3.5 text-sm font-semibold text-text-primary">
                <span>{viewMode === "readonly" ? "Tap to view the logged session" : sessionStartedAt ? "Session in progress · tap to continue" : "Tap to view this session"}</span>
                <svg className="h-4 w-4 flex-shrink-0 text-[#F060E0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            )}
          </button>

          {sessionOpen && (
            <>
          {viewMode === "log" && (
            <div className="px-5 pb-4">
              {sessionStartedAt ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E040D0]/30 bg-[#E040D0]/8 px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#F060E0]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#F060E0]" />Session in progress</span>
                  <span className="metric-num text-lg font-bold text-text-primary"><ElapsedTime startedAt={sessionStartedAt} /></span>
                </div>
              ) : (
                <button type="button" onClick={() => startSessionTimer(activeSession)} className="w-full rounded-xl bg-[#E040D0] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[#F060E0]">
                  Start Session
                </button>
              )}
            </div>
          )}
          {/* Session header */}
          <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#E040D0] uppercase tracking-wider mb-1">
                  {isToday(selectedDate)
                    ? "Today"
                    : selectedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
                </p>
                <h2 className="text-xl font-bold text-text-primary">{activeSession.name}</h2>
                {activeSession.notes && (
                  <p className="text-sm text-text-secondary mt-1 italic">{activeSession.notes}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-xs px-3 py-1 rounded-full bg-[rgba(224,64,208,0.12)] text-[#E040D0] font-semibold">
                  {activeSession.items.filter((i) => i.exercise_id !== "__section__").length} exercises
                </span>
                {/* Toggle between log and readonly for past days */}
                {isPast && viewMode === "readonly" && (
                  <button
                    onClick={() => {
                      setViewMode("log");
                      setSessionOpen(true);
                      initDrafts(activeSession);
                    }}
                    className="text-xs text-text-secondary hover:text-text-primary underline cursor-pointer"
                  >
                    Edit
                  </button>
                )}
                {isPast && viewMode === "log" && dayLogs.length > 0 && (
                  <button
                    onClick={() => setViewMode("readonly")}
                    className="text-xs text-text-secondary hover:text-text-primary underline cursor-pointer"
                  >
                    View logged
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Past day — no log */}
          {isPast && dayLogs.length === 0 && viewMode === "log" && (
            <div className="px-5 pt-4">
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[rgba(0,0,0,0.03)] rounded-xl">
                <svg className="w-4 h-4 text-text-secondary/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-text-secondary">Logging retroactively for this date</p>
              </div>
            </div>
          )}

          {/* Readonly view (logged session) */}
          {viewMode === "readonly" && dayLogs.length > 0 && (
            <div className="divide-y divide-[rgba(0,0,0,0.04)]">
              {activeSession.items.map((item) => {
                if (item.exercise_id === "__section__") {
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 pt-5 pb-2">
                      <div className="w-1 h-4 rounded-full bg-[#E040D0]" />
                      <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                        {item.section_label || "Section"}
                      </span>
                    </div>
                  );
                }
                const log = dayLogs.find((l) => l.exercise_item_id === item.id);
                return (
                  <div key={item.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-text-primary text-sm">{item.exercise?.name || "Unknown"}</p>
                        {item.exercise?.muscle_group && (
                          <p className="text-xs text-text-secondary mt-0.5 capitalize">{item.exercise.muscle_group}</p>
                        )}
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[rgba(224,64,208,0.10)] text-[#E040D0] flex-shrink-0">
                        {formatExercisePrescription(item)}
                      </span>
                    </div>
                    {(log?.sets_data?.length ?? 0) > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {(log?.sets_data ?? []).map((s, i) => (
                          <span
                            key={i}
                            className="text-xs px-2.5 py-1 rounded-lg bg-[rgba(0,0,0,0.04)] text-text-secondary font-medium"
                          >
                            {shouldUseSetLogging(item)
                              ? `${s.weight ? `${s.weight}kg` : "--"} x ${s.reps || "--"}`
                              : s.reps || s.notes || "--"}
                          </span>
                        ))}
                      </div>
                    )}
                    {!log && (
                      <p className="text-xs text-text-secondary/50 mt-1">Not logged</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Past day, no logs, no session found */}
          {isPast && dayLogs.length === 0 && viewMode === "readonly" && (
            <div className="px-5 py-10 text-center">
              <p className="text-text-secondary text-sm">No session logged for this day.</p>
              <button
              onClick={() => {
                setViewMode("log");
                setSessionOpen(true);
                initDrafts(activeSession);
              }}
                className="mt-3 text-sm text-[#E040D0] hover:underline font-semibold cursor-pointer"
              >
                Log a session retroactively
              </button>
            </div>
          )}

          {/* Log form (today, future, or retroactive) */}
          {viewMode === "log" && (
            <div className="divide-y divide-[rgba(0,0,0,0.04)]">
              {activeSession.items.map((item) => {
                if (item.exercise_id === "__section__") {
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-5 pt-5 pb-2">
                      <div className="w-1 h-4 rounded-full bg-[#E040D0]" />
                      <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                        {item.section_label || "Section"}
                      </span>
                    </div>
                  );
                }

                const sets = draftSets[item.id] || [];
                const useSetLogging = shouldUseSetLogging(item);

                return (
                  <div key={item.id} className="px-3 py-3 sm:px-5 sm:py-4">
                    <div className="app-inset rounded-[24px] p-4">
                    {/* Exercise header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="font-bold text-text-primary">{item.exercise?.name || "Unknown"}</p>
                        {item.exercise?.muscle_group && (
                          <p className="text-xs text-text-secondary mt-0.5 capitalize">{item.exercise.muscle_group}</p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-text-secondary/70 mt-1 italic">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[rgba(224,64,208,0.10)] text-[#E040D0]">
                          {formatExercisePrescription(item)}
                        </span>
                        <div className="flex gap-1.5">
                          {item.rest_seconds && (
                            <span className="text-xs px-2 py-0.5 rounded-md bg-[rgba(0,0,0,0.04)] text-text-secondary font-medium">
                              {item.rest_seconds}s rest
                            </span>
                          )}
                          {item.tempo && (
                            <span className="text-xs px-2 py-0.5 rounded-md bg-[rgba(0,0,0,0.04)] text-text-secondary font-medium">
                              {item.tempo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Demo link */}
                    {item.exercise && (
                      <button
                        onClick={() => {
                          const url =
                            item.exercise?.video_url ||
                            `https://musclewiki.com/exercises?search=${encodeURIComponent(item.exercise?.name ?? "")}`;
                          window.open(url, "_blank", "noopener");
                        }}
                        className="inline-flex items-center gap-1 text-xs text-[#E040D0] border border-[rgba(224,64,208,0.25)] px-2.5 py-1 rounded-lg hover:bg-[rgba(224,64,208,0.08)] transition-colors cursor-pointer mb-3"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Demo
                      </button>
                    )}

                    {/* Sets input grid */}
                    <div className="space-y-3">
                      {useSetLogging && (
                        <div className="hidden sm:grid sm:grid-cols-[28px_1fr_1fr_1fr] gap-2 px-1">
                          <span className="text-[10px] text-text-secondary font-medium text-center">#</span>
                          <span className="text-[10px] text-text-secondary font-medium">Weight (kg)</span>
                          <span className="text-[10px] text-text-secondary font-medium">Reps</span>
                          <span className="text-[10px] text-text-secondary font-medium">Notes</span>
                        </div>
                      )}
                      {sets.map((set, setIdx) => (
                        <div key={setIdx} className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] p-3">
                          <div className={useSetLogging ? "grid grid-cols-[3.25rem_1fr_1fr] gap-2 sm:grid-cols-[28px_1fr_1fr_1fr] sm:items-center" : "grid gap-2 sm:grid-cols-[1fr_1fr]"}>
                            {useSetLogging && (
                              <div className="flex h-full min-h-[54px] flex-col items-center justify-center rounded-xl border border-[#E040D0]/20 bg-[#E040D0]/8 text-center sm:min-h-0 sm:border-0 sm:bg-transparent">
                                <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#E040D0] sm:hidden">Set</span>
                                <span className="text-base font-heading font-bold text-text-primary sm:text-xs sm:text-text-secondary" aria-label={`Set ${set.set_number}`}>{set.set_number}</span>
                              </div>
                            )}
                            {useSetLogging ? (
                              <>
                                <label className="block">
                                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted sm:hidden">Weight</span>
                                  <div className="relative">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="0"
                                      aria-label={`Set ${set.set_number} weight in kg`}
                                      value={set.weight}
                                      onChange={(e) => updateSet(item.id, setIdx, "weight", e.target.value)}
                                      className="w-full rounded-xl border border-[#E040D0]/20 bg-white px-3 py-3 pr-9 text-base font-semibold text-text-primary placeholder:text-text-muted/40 shadow-inner focus:outline-none focus:border-[#E040D0]/60 sm:bg-[rgba(0,0,0,0.03)] sm:py-1.5 sm:text-sm"
                                    />
                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-muted">kg</span>
                                  </div>
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted sm:hidden">Reps</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder={item.reps}
                                    aria-label={`Set ${set.set_number} reps`}
                                    value={set.reps}
                                    onChange={(e) => updateSet(item.id, setIdx, "reps", e.target.value)}
                                    className="w-full rounded-xl border border-[#E040D0]/20 bg-white px-3 py-3 text-base font-semibold text-text-primary placeholder:text-text-muted/40 shadow-inner focus:outline-none focus:border-[#E040D0]/60 sm:bg-[rgba(0,0,0,0.03)] sm:py-1.5 sm:text-sm"
                                  />
                                </label>
                              </>
                            ) : (
                              <label className="block">
                                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Result</span>
                                <input
                                  type="text"
                                  placeholder={formatExercisePrescription(item)}
                                  aria-label={`${item.exercise?.name || "Exercise"} result`}
                                  value={set.reps}
                                  onChange={(e) => updateSet(item.id, setIdx, "reps", e.target.value)}
                                  className="w-full rounded-xl border border-[#E040D0]/20 bg-white px-3 py-3 text-base font-semibold text-text-primary placeholder:text-text-muted/40 shadow-inner focus:outline-none focus:border-[#E040D0]/60 sm:bg-[rgba(0,0,0,0.03)] sm:py-2 sm:text-sm"
                                />
                              </label>
                            )}
                            <label className={useSetLogging ? "col-span-3 block sm:col-span-1" : "block"}>
                              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted sm:hidden">Notes</span>
                              <input
                                type="text"
                                placeholder="Optional note"
                                aria-label={`Set ${set.set_number} note`}
                                value={set.notes}
                                onChange={(e) => updateSet(item.id, setIdx, "notes", e.target.value)}
                                className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-3 text-sm text-text-primary placeholder:text-text-muted/50 shadow-inner focus:outline-none focus:border-[#E040D0]/50 sm:bg-[rgba(0,0,0,0.03)] sm:py-1.5"
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    {useSetLogging && (
                      <button
                        onClick={() => addSet(item.id)}
                        className="mt-3 rounded-xl border border-[#E040D0]/20 bg-[#E040D0]/8 px-3 py-2 text-xs font-semibold text-[#E040D0] transition-colors hover:bg-[#E040D0]/12 cursor-pointer"
                      >
                        + Add set
                      </button>
                    )}
                    </div>
                  </div>
                );
              })}

              {/* Save button — inline on desktop, extra space on mobile so sticky bar has room */}
              <div className="p-5 pb-2 sm:pb-5">
                {saveError && (
                  <p className="mb-3 rounded-xl border border-red-500/15 bg-red-500/8 px-4 py-3 text-sm text-red-400">
                    {saveError}
                  </p>
                )}
                <button
                  onClick={saveSession}
                  disabled={saving}
                  className="hidden w-full rounded-xl bg-[#E040D0] py-3 text-sm font-semibold text-white shadow-none ring-0 transition-colors hover:bg-[#F060E0] disabled:opacity-60 sm:block"
                >
                  <CyclingStatusText active={saving} idle="Save Session" messages={["Saving...", "Logging sets...", "Updating week...", "Nearly there..."]} />
                </button>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* Session picker modal — swap to any session in the rotation for this day */}
      {showSessionPicker && plan && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={() => setShowSessionPicker(false)}
        >
          <div
            className="bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col shadow-2xl pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-text-primary">Pick a session</h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  This week&apos;s sessions from your plan. Logs save against the session you choose.
                </p>
              </div>
              <button
                onClick={() => setShowSessionPicker(false)}
                className="p-1.5 text-text-secondary hover:text-text-primary cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-1">
                {weekSessions.map((s) => {
                  const isActive = s.id === activeSession?.id;
                  const exerciseCount = s.items.filter((i) => i.exercise_id !== "__section__").length;
                  return (
                    <button
                      key={s.id}
                      onClick={() => pickSession(s)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left cursor-pointer active:scale-[0.99] transition-all ${
                        isActive
                          ? "border border-[#E040D0]/40 bg-[rgba(224,64,208,0.06)]"
                          : "border border-transparent hover:border-[rgba(0,0,0,0.08)] hover:bg-[rgba(0,0,0,0.03)]"
                      }`}
                    >
                      <span className="w-8 h-8 rounded-lg bg-[#E040D0]/10 text-[#E040D0] font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {s.day_number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{s.name}</p>
                        <p className="text-[11px] text-text-muted">{exerciseCount} exercises</p>
                      </div>
                      {isActive && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#E040D0] bg-[#E040D0]/10 px-2 py-1 rounded-full flex-shrink-0">
                          Current
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sticky save — stays above bottom nav + respects iPhone home indicator */}
      {viewMode === "log" && activeSession && sessionOpen && (
        <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 bg-bg-primary/95 px-4 py-3 backdrop-blur sm:hidden">
          <button
            onClick={saveSession}
            disabled={saving}
            className="min-h-[48px] w-full rounded-2xl bg-[#E040D0] py-3.5 text-sm font-semibold text-white shadow-none ring-0 transition-colors hover:bg-[#F060E0] disabled:opacity-60"
          >
            <CyclingStatusText active={saving} idle="Save Session" messages={["Saving...", "Logging sets...", "Updating week...", "Nearly there..."]} />
          </button>
        </div>
      )}
    </div>
  );
}
