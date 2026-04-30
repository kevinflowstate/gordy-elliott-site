"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import CyclingStatusText from "@/components/ui/CyclingStatusText";
import type { ClientExercisePlan, ExerciseSession } from "@/lib/types";

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

// ---- component ----

export default function PortalExercisePlanPage() {
  const [plan, setPlan] = useState<ClientExercisePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [allLogs, setAllLogs] = useState<ExerciseLog[]>([]);

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

  // Draft inputs: exerciseItemId -> SetData[]
  const [draftSets, setDraftSets] = useState<Record<string, SetData[]>>({});
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

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
      // No log for this day — work out next session (unless user explicitly picked one)
      if (!manuallyPicked) {
        const next = getNextSession(plan.sessions, allLogs);
        setActiveSession(next);
        initDrafts(next);
      }
      setViewMode("log");
    }
  }, [selectedDate, allLogs, plan, manuallyPicked]);

  function initDrafts(session: ExerciseSession) {
    const drafts: Record<string, SetData[]> = {};
    for (const item of session.items) {
      if (item.exercise_id === "__section__") continue;
      const setsCount = Number(item.sets) || 3;
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
      setViewMode("readonly");
      setSessionOpen(false);
      const stamp = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      setLastSavedAt(`${formatDate(selectedDate)} at ${stamp}`);
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

  const selectedDateStr = formatDate(selectedDate);
  const dayLogs = allLogs.filter((l) => l.log_date === selectedDateStr);
  const isPast = !isToday(selectedDate) && !isFuture(selectedDate);

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
  const plannedSessionsCount = plan?.sessions?.length || 0;

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
    <div className="p-4 pb-40 sm:pb-6 sm:p-6 max-w-2xl mx-auto relative">
      {/* Toast */}
      {savedToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#E040D0] text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg text-sm">
          Session saved!
        </div>
      )}

      {/* Page header */}
      <div className="mb-5 space-y-4">
        <div className="flex items-start justify-between gap-3 rounded-3xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E040D0] mb-1">Training</div>
            <h1 className="text-2xl font-bold text-text-primary">{plan.name}</h1>
            <p className="text-text-secondary mt-1 text-sm">Open today&apos;s session fast, log what you did, and move on.</p>
            {lastSavedAt && (
              <p className="mt-2 text-[11px] font-semibold text-emerald-500">
                Saved {lastSavedAt}
              </p>
            )}
          </div>
          <Link href="/portal" className="hidden sm:inline-flex text-xs font-semibold text-accent-bright no-underline transition-colors hover:text-accent-light">
            ← Dashboard
          </Link>
        </div>

        {/* Weekly trust summary — no ambiguity about what got logged this week */}
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">This Week</div>
              <div className="mt-1 text-sm font-semibold text-text-primary">
                {sessionsThisWeek === 0
                  ? "No sessions logged yet this week"
                  : `${sessionsThisWeek} session${sessionsThisWeek === 1 ? "" : "s"} logged this week`}
                {plannedSessionsCount > 0 && ` · ${plannedSessionsCount} in rotation`}
              </div>
            </div>
            <Link
              href="/portal/ai"
              className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 py-1.5 text-[11px] font-semibold text-text-secondary no-underline hover:text-text-primary hover:border-[#E040D0]/30"
            >
              Ask SHIFT AI
            </Link>
          </div>
        </div>
        {plan.description && (
          <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card px-4 py-3 text-sm text-text-secondary">
            {plan.description}
          </div>
        )}

        {/* Selected day + session context. Tap the session chip to pick a different one. */}
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                {isToday(selectedDate)
                  ? "Today"
                  : selectedDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </div>
              <button
                type="button"
                onClick={() => plan?.sessions?.length && viewMode === "log" && setShowSessionPicker(true)}
                disabled={viewMode !== "log" || !plan?.sessions?.length}
                className="mt-0.5 flex items-center gap-1.5 text-left text-base font-heading font-bold text-text-primary enabled:hover:text-accent-bright transition-colors disabled:cursor-default"
                aria-label="Switch to a different session"
              >
                <span className="truncate">{activeSession?.name || "Loading..."}</span>
                {viewMode === "log" && plan && plan.sessions.length > 1 && (
                  <svg className="w-3.5 h-3.5 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
            </div>
            <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
              viewMode === "readonly"
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
                : isPast
                ? "border-amber-500/25 bg-amber-500/10 text-amber-500"
                : "border-[#E040D0]/25 bg-[#E040D0]/10 text-[#E040D0]"
            }`}>
              {viewMode === "readonly" ? "Logged" : isPast ? "Retro log" : "Ready to log"}
            </span>
          </div>
          {viewMode === "log" && plan && plan.sessions.length > 1 && !manuallyPicked && (
            <p className="mt-2 text-[11px] text-text-muted">
              Auto-picked from your last session. Tap the session to swap.
            </p>
          )}
          {viewMode === "log" && manuallyPicked && (
            <p className="mt-2 text-[11px] text-text-muted">
              You picked this session manually. Switching days resets to auto-pick.
            </p>
          )}
        </div>
      </div>

      {/* ---- Week Calendar Strip ---- */}
      <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 mb-5">
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
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {weekDays.map((day, i) => {
            const isSelected = formatDate(day) === selectedDateStr;
            const todayDay = isToday(day);
            const hasLog = hasLogOnDay(day);

            return (
              <button
                key={i}
                onClick={() => selectDay(day)}
                className={`flex flex-col items-center justify-center flex-1 min-w-[40px] py-2.5 px-1 rounded-xl transition-all cursor-pointer relative
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
                {/* Dot indicator */}
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full transition-all ${hasLog ? "bg-[#E040D0] opacity-100" : "opacity-0"} ${todayDay ? "bg-white" : ""}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Selected Day Content ---- */}
      {activeSession && (
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setSessionOpen((open) => !open)}
            className="w-full p-5 text-left"
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
                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                  viewMode === "readonly"
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
                    : "border-[#E040D0]/25 bg-[#E040D0]/10 text-[#E040D0]"
                }`}>
                  {viewMode === "readonly" ? "Logged" : "Start"}
                </span>
                <span className="text-xs px-3 py-1 rounded-full bg-[rgba(224,64,208,0.12)] text-[#E040D0] font-semibold">
                  {activeSession.items.filter((i) => i.exercise_id !== "__section__").length} exercises
                </span>
              </div>
            </div>
            {!sessionOpen && (
              <div className="mt-4 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3 text-sm font-semibold text-text-primary">
                {viewMode === "readonly" ? "Tap to view the logged session" : "Tap to start logging this session"}
              </div>
            )}
          </button>

          {sessionOpen && (
            <>
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
                        {item.sets} x {item.reps}
                      </span>
                    </div>
                    {(log?.sets_data?.length ?? 0) > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {(log?.sets_data ?? []).map((s, i) => (
                          <span
                            key={i}
                            className="text-xs px-2.5 py-1 rounded-lg bg-[rgba(0,0,0,0.04)] text-text-secondary font-medium"
                          >
                            {s.weight ? `${s.weight}kg` : "--"} x {s.reps || "--"}
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

                return (
                  <div key={item.id} className="px-5 py-4">
                    {/* Exercise header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
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
                          {item.sets} x {item.reps}
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
                    <div className="space-y-2">
                      <div className="hidden sm:grid sm:grid-cols-[28px_1fr_1fr_1fr] gap-2 px-1">
                        <span className="text-[10px] text-text-secondary font-medium text-center">#</span>
                        <span className="text-[10px] text-text-secondary font-medium">Weight (kg)</span>
                        <span className="text-[10px] text-text-secondary font-medium">Reps</span>
                        <span className="text-[10px] text-text-secondary font-medium">Notes</span>
                      </div>
                      {sets.map((set, setIdx) => (
                        <div key={setIdx} className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.015)] p-2.5">
                          <div className="grid grid-cols-[28px_1fr_1fr] sm:grid-cols-[28px_1fr_1fr_1fr] gap-2 items-center">
                            <span className="text-xs text-text-secondary font-semibold text-center" aria-label={`Set ${set.set_number}`}>{set.set_number}</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="kg"
                              aria-label={`Set ${set.set_number} weight in kg`}
                              value={set.weight}
                              onChange={(e) => updateSet(item.id, setIdx, "weight", e.target.value)}
                              className="w-full px-2 py-1.5 text-sm bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.07)] rounded-lg text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-[#E040D0]/50 transition-colors"
                            />
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder={item.reps}
                              aria-label={`Set ${set.set_number} reps`}
                              value={set.reps}
                              onChange={(e) => updateSet(item.id, setIdx, "reps", e.target.value)}
                              className="w-full px-2 py-1.5 text-sm bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.07)] rounded-lg text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-[#E040D0]/50 transition-colors"
                            />
                            <input
                              type="text"
                              placeholder="note"
                              aria-label={`Set ${set.set_number} note`}
                              value={set.notes}
                              onChange={(e) => updateSet(item.id, setIdx, "notes", e.target.value)}
                              className="col-span-3 sm:col-span-1 w-full px-2 py-1.5 text-sm bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.07)] rounded-lg text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-[#E040D0]/50 transition-colors"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => addSet(item.id)}
                      className="mt-2 text-xs text-text-secondary hover:text-text-primary border border-[rgba(0,0,0,0.07)] px-3 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      + Add set
                    </button>
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
                  className="hidden sm:block w-full py-3 rounded-xl font-semibold text-white text-sm transition-all cursor-pointer disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #E040D0 0%, #b020a0 100%)" }}
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
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
                  Logs save against the session you choose. Today&apos;s auto-pick is based on your last logged session.
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
                {plan.sessions.map((s) => {
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
        <div className="sm:hidden fixed bottom-[5rem] left-0 right-0 z-30 px-4 pb-[env(safe-area-inset-bottom)] pt-2 bg-gradient-to-t from-bg-primary via-bg-primary/95 to-transparent">
          <button
            onClick={saveSession}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl font-semibold text-white text-sm shadow-xl transition-all cursor-pointer disabled:opacity-60 min-h-[48px]"
            style={{ background: "linear-gradient(135deg, #E040D0 0%, #b020a0 100%)" }}
          >
            <CyclingStatusText active={saving} idle="Save Session" messages={["Saving...", "Logging sets...", "Updating week...", "Nearly there..."]} />
          </button>
        </div>
      )}
    </div>
  );
}
