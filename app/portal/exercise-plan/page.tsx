"use client";

import { useEffect, useState, useCallback } from "react";
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

  // Draft inputs: exerciseItemId -> SetData[]
  const [draftSets, setDraftSets] = useState<Record<string, SetData[]>>({});
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

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
    } else {
      // No log for this day — work out next session
      const next = getNextSession(plan.sessions, allLogs);
      setActiveSession(next);
      setViewMode("log");
      // Pre-populate draft sets
      initDrafts(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, allLogs, plan]);

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
    try {
      const exercises = activeSession.items.filter((i) => i.exercise_id !== "__section__");
      await Promise.all(
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
          }).then((r) => r.json());
        })
      );
      // Refresh week logs
      await fetchWeekLogs(weekStart);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (err) {
      console.error("Failed to save session:", err);
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
  }

  function selectDay(day: Date) {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
  }

  const selectedDateStr = formatDate(selectedDate);
  const dayLogs = allLogs.filter((l) => l.log_date === selectedDateStr);
  const isPast = !isToday(selectedDate) && !isFuture(selectedDate);

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
    <div className="p-4 sm:p-6 max-w-2xl mx-auto relative">
      {/* Toast */}
      {savedToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#E040D0] text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg text-sm">
          Session saved!
        </div>
      )}

      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-text-primary">{plan.name}</h1>
        {plan.description && (
          <p className="text-text-secondary mt-1 text-sm">{plan.description}</p>
        )}
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
          <span className="text-xs font-semibold text-text-secondary">{weekLabel(weekStart)}</span>
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
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-[28px_1fr_1fr_1fr] gap-2 px-1">
                        <span className="text-[10px] text-text-secondary font-medium text-center">#</span>
                        <span className="text-[10px] text-text-secondary font-medium">Weight (kg)</span>
                        <span className="text-[10px] text-text-secondary font-medium">Reps</span>
                        <span className="text-[10px] text-text-secondary font-medium">Notes</span>
                      </div>
                      {sets.map((set, setIdx) => (
                        <div key={setIdx} className="grid grid-cols-[28px_1fr_1fr_1fr] gap-2 items-center">
                          <span className="text-xs text-text-secondary font-semibold text-center">{set.set_number}</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="kg"
                            value={set.weight}
                            onChange={(e) => updateSet(item.id, setIdx, "weight", e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.07)] rounded-lg text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-[#E040D0]/50 transition-colors"
                          />
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder={item.reps}
                            value={set.reps}
                            onChange={(e) => updateSet(item.id, setIdx, "reps", e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.07)] rounded-lg text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-[#E040D0]/50 transition-colors"
                          />
                          <input
                            type="text"
                            placeholder="note"
                            value={set.notes}
                            onChange={(e) => updateSet(item.id, setIdx, "notes", e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.07)] rounded-lg text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-[#E040D0]/50 transition-colors"
                          />
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

              {/* Save button */}
              <div className="p-5">
                <button
                  onClick={saveSession}
                  disabled={saving}
                  className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all cursor-pointer disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #E040D0 0%, #b020a0 100%)" }}
                >
                  {saving ? "Saving..." : "Save Session"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
