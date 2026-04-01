"use client";

import { useEffect, useState, useCallback } from "react";
import type { ClientExercisePlan } from "@/lib/types";

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

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function isToday(date: Date): boolean {
  return date.toDateString() === new Date().toDateString();
}

export default function PortalExercisePlanPage() {
  const [plan, setPlan] = useState<ClientExercisePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  // exerciseItemId -> open log panel
  const [openLogPanel, setOpenLogPanel] = useState<string | null>(null);
  // exerciseItemId -> draft sets data
  const [draftSets, setDraftSets] = useState<Record<string, SetData[]>>({});
  const [savingLog, setSavingLog] = useState<string | null>(null);

  const dateStr = formatDate(selectedDate);

  useEffect(() => {
    fetch("/api/portal/exercise-plan")
      .then((r) => r.json())
      .then((data) => {
        setPlan(data.plan);
        if (data.plan?.sessions?.length > 0) {
          setExpandedSession(data.plan.sessions[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fetchLogs = useCallback(() => {
    setLogsLoading(true);
    fetch(`/api/portal/exercise-log?date=${dateStr}`)
      .then((r) => r.json())
      .then((data) => setLogs(data.logs || []))
      .catch(console.error)
      .finally(() => setLogsLoading(false));
  }, [dateStr]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const navigateDate = (delta: number) => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
    setOpenLogPanel(null);
  };

  const getLog = (exerciseItemId: string) =>
    logs.find((l) => l.exercise_item_id === exerciseItemId);

  const openLog = (exerciseItemId: string, defaultSetsCount: number) => {
    if (openLogPanel === exerciseItemId) {
      setOpenLogPanel(null);
      return;
    }
    setOpenLogPanel(exerciseItemId);
    const existing = getLog(exerciseItemId);
    if (existing && existing.sets_data?.length > 0) {
      setDraftSets((prev) => ({ ...prev, [exerciseItemId]: existing.sets_data }));
    } else {
      // Pre-populate empty rows for each set
      const rows: SetData[] = Array.from({ length: defaultSetsCount || 1 }, (_, i) => ({
        set_number: i + 1,
        weight: "",
        reps: "",
        notes: "",
      }));
      setDraftSets((prev) => ({ ...prev, [exerciseItemId]: rows }));
    }
  };

  const updateSet = (exerciseItemId: string, setIdx: number, field: keyof SetData, value: string) => {
    setDraftSets((prev) => {
      const sets = [...(prev[exerciseItemId] || [])];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      return { ...prev, [exerciseItemId]: sets };
    });
  };

  const addSet = (exerciseItemId: string) => {
    setDraftSets((prev) => {
      const sets = prev[exerciseItemId] || [];
      return {
        ...prev,
        [exerciseItemId]: [
          ...sets,
          { set_number: sets.length + 1, weight: "", reps: "", notes: "" },
        ],
      };
    });
  };

  const saveLog = async (exerciseItemId: string, sessionId: string) => {
    const sets = draftSets[exerciseItemId] || [];
    const completed = sets.some((s) => s.reps.trim() !== "");
    setSavingLog(exerciseItemId);
    try {
      const res = await fetch("/api/portal/exercise-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_item_id: exerciseItemId,
          session_id: sessionId,
          date: dateStr,
          sets_data: sets,
          completed,
        }),
      });
      const data = await res.json();
      if (data.log) {
        setLogs((prev) => {
          const filtered = prev.filter((l) => l.exercise_item_id !== exerciseItemId);
          return [...filtered, data.log];
        });
        setOpenLogPanel(null);
      }
    } catch (err) {
      console.error("Failed to save log:", err);
    } finally {
      setSavingLog(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.06)] rounded-xl w-48" />
          <div className="h-64 bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.06)] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary mb-4">My Training Plan</h1>
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl p-8 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-text-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
          <p className="text-text-secondary text-lg">No exercise plan assigned yet.</p>
          <p className="text-text-secondary/60 mt-2">Your coach will set one up for you soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">{plan.name}</h1>
        {plan.description && (
          <p className="text-text-secondary mt-1 text-base">{plan.description}</p>
        )}
        <div className="flex gap-3 mt-3 flex-wrap">
          <span className="text-sm px-3 py-1.5 rounded-full bg-accent-bright/15 text-accent-bright font-semibold">
            {plan.sessions.length} {plan.sessions.length === 1 ? "session" : "sessions"}
          </span>
          {plan.start_date && (
            <span className="text-sm px-3 py-1.5 rounded-full bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)] text-text-secondary font-medium">
              Started {new Date(plan.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
      </div>

      {/* Date Navigator for logging */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl p-3 mb-6 flex items-center justify-between">
        <button
          onClick={() => navigateDate(-1)}
          className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)] transition-colors"
        >
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-text-primary">
            {isToday(selectedDate) ? "Today" : formatDateDisplay(selectedDate)}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            {isToday(selectedDate) ? formatDateDisplay(selectedDate) : ""}
          </p>
          {!isToday(selectedDate) && (
            <button onClick={() => setSelectedDate(new Date())} className="text-xs text-accent-bright hover:underline">
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => navigateDate(1)}
          className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)] transition-colors"
        >
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Session Cards */}
      <div className="space-y-4">
        {plan.sessions.map((session) => {
          const isExpanded = expandedSession === session.id;
          // Count logged exercises for this session on selected date
          const sessionExerciseIds = session.items
            .filter((i) => i.exercise_id !== "__section__")
            .map((i) => i.id);
          const loggedCount = sessionExerciseIds.filter((id) => {
            const log = getLog(id);
            return log?.completed;
          }).length;
          const hasAnyLog = sessionExerciseIds.some((id) => getLog(id));

          return (
            <div
              key={session.id}
              className="bg-bg-card/90 backdrop-blur-sm border border-[rgba(0,0,0,0.07)] dark:border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Session header */}
              <button
                onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="w-10 h-10 rounded-xl bg-accent-bright/15 text-accent-bright font-bold text-base flex items-center justify-center flex-shrink-0">
                    {session.day_number}
                  </span>
                  <div>
                    <h3 className="font-bold text-text-primary text-base">{session.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm text-text-secondary">
                        {session.items.filter(i => i.exercise_id !== "__section__").length} exercises
                      </p>
                      {hasAnyLog && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold">
                          {loggedCount}/{sessionExerciseIds.length} logged
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {hasAnyLog && loggedCount === sessionExerciseIds.length && sessionExerciseIds.length > 0 && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <svg
                    className={`w-5 h-5 text-text-secondary transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Session notes */}
              {isExpanded && session.notes && (
                <div className="mx-4 mb-3 px-4 py-3 bg-accent-bright/8 border border-accent-bright/15 rounded-xl text-sm text-text-secondary italic">
                  {session.notes}
                </div>
              )}

              {/* Exercise list */}
              {isExpanded && (
                <div className="border-t border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] divide-y divide-[rgba(0,0,0,0.04)] dark:divide-[rgba(255,255,255,0.04)]">
                  {session.items.map((item, idx) => {
                    // Section divider
                    if (item.exercise_id === "__section__") {
                      return (
                        <div key={item.id} className="flex items-center gap-3 px-5 pt-5 pb-2">
                          <div className="w-1 h-5 rounded-full bg-accent-bright flex-shrink-0" />
                          <span className="text-sm font-bold text-text-primary uppercase tracking-wider">
                            {item.section_label || "Section"}
                          </span>
                          <div className="flex-1 border-t border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)]" />
                        </div>
                      );
                    }

                    const exercise = item.exercise;
                    const nextItem = session.items[idx + 1];
                    const inSuperset = !!item.superset_group;
                    const isLastInSuperset = inSuperset && (!nextItem || nextItem.superset_group !== item.superset_group);
                    const exerciseNumber = session.items.slice(0, idx).filter(i => i.exercise_id !== "__section__").length + 1;
                    const log = getLog(item.id);
                    const isLogged = log?.completed;
                    const isLogOpen = openLogPanel === item.id;
                    const isSaving = savingLog === item.id;

                    return (
                      <div key={item.id} className={`${inSuperset ? "border-l-4 border-accent-bright/40 ml-5" : ""} ${isLastInSuperset ? "mb-1" : ""}`}>
                        <div className={`px-5 py-4 ${isLogged ? "bg-emerald-500/5" : ""}`}>
                          {/* Exercise header row */}
                          <div className="flex items-start gap-3">
                            {/* Number or check */}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-sm transition-all ${
                              isLogged
                                ? "bg-emerald-500 text-white"
                                : "bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.08)] text-text-secondary"
                            }`}>
                              {isLogged ? (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : exerciseNumber}
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* Exercise name row */}
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-text-primary text-base leading-tight">
                                    {exercise?.name || "Unknown Exercise"}
                                  </h4>
                                  {inSuperset && (
                                    <span className="text-xs font-bold text-accent-bright bg-accent-bright/12 px-2 py-0.5 rounded-full flex-shrink-0">
                                      Superset
                                    </span>
                                  )}
                                </div>
                                {/* Sets x Reps badge - prominent */}
                                <span className="text-sm font-bold px-3 py-1 rounded-xl bg-accent-bright/15 text-accent-bright flex-shrink-0">
                                  {item.sets} x {item.reps}
                                </span>
                              </div>

                              {/* Meta badges row */}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {item.rest_seconds && (
                                  <span className="text-xs px-2.5 py-1 rounded-lg bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.07)] text-text-secondary font-medium">
                                    {item.rest_seconds}s rest
                                  </span>
                                )}
                                {item.tempo && (
                                  <span className="text-xs px-2.5 py-1 rounded-lg bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.07)] text-text-secondary font-medium">
                                    Tempo: {item.tempo}
                                  </span>
                                )}
                                {exercise?.muscle_group && (
                                  <span className="text-xs px-2.5 py-1 rounded-lg bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.05)] text-text-secondary capitalize font-medium border border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.06)]">
                                    {exercise.muscle_group}
                                  </span>
                                )}
                              </div>

                              {/* Coach notes */}
                              {item.notes && (
                                <p className="text-sm text-text-secondary mt-2 italic">
                                  {item.notes}
                                </p>
                              )}

                              {/* Action row: demo link + log button */}
                              <div className="flex items-center gap-2 mt-3">
                                {exercise && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const url = exercise.video_url || `https://musclewiki.com/exercises?search=${encodeURIComponent(exercise.name)}`;
                                      window.open(url, "_blank", "noopener");
                                    }}
                                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border border-accent-bright/30 text-accent-bright hover:bg-accent-bright/10 transition-colors font-medium"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Demo
                                  </button>
                                )}
                                <button
                                  onClick={() => openLog(item.id, Number(item.sets) || 3)}
                                  className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                                    isLogged
                                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
                                      : "bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.07)] text-text-secondary hover:bg-[rgba(0,0,0,0.08)] dark:hover:bg-[rgba(255,255,255,0.10)] border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.08)]"
                                  }`}
                                >
                                  {isLogged ? (
                                    <>
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                      Logged
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                      </svg>
                                      Log
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Log Panel */}
                          {isLogOpen && (
                            <div className="mt-4 ml-10 bg-[rgba(0,0,0,0.03)] dark:bg-[rgba(255,255,255,0.04)] border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.07)] rounded-xl p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="text-sm font-bold text-text-primary">Log Sets</h5>
                                <span className="text-xs text-text-secondary">
                                  {isToday(selectedDate) ? "Today" : formatDateDisplay(selectedDate)}
                                </span>
                              </div>

                              {/* Sets table */}
                              <div className="space-y-2 mb-3">
                                {/* Header */}
                                <div className="grid grid-cols-[32px_1fr_1fr_1fr] gap-2 px-1">
                                  <span className="text-xs text-text-secondary font-medium text-center">#</span>
                                  <span className="text-xs text-text-secondary font-medium">Weight</span>
                                  <span className="text-xs text-text-secondary font-medium">Reps</span>
                                  <span className="text-xs text-text-secondary font-medium">Notes</span>
                                </div>
                                {(draftSets[item.id] || []).map((set, setIdx) => (
                                  <div key={setIdx} className="grid grid-cols-[32px_1fr_1fr_1fr] gap-2 items-center">
                                    <span className="text-xs text-text-secondary font-semibold text-center">{set.set_number}</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="kg"
                                      value={set.weight}
                                      onChange={(e) => updateSet(item.id, setIdx, "weight", e.target.value)}
                                      className="w-full px-2 py-1.5 text-sm bg-bg-card border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)] rounded-lg text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-accent-bright/50"
                                    />
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      placeholder={item.reps}
                                      value={set.reps}
                                      onChange={(e) => updateSet(item.id, setIdx, "reps", e.target.value)}
                                      className="w-full px-2 py-1.5 text-sm bg-bg-card border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)] rounded-lg text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-accent-bright/50"
                                    />
                                    <input
                                      type="text"
                                      placeholder="note"
                                      value={set.notes}
                                      onChange={(e) => updateSet(item.id, setIdx, "notes", e.target.value)}
                                      className="w-full px-2 py-1.5 text-sm bg-bg-card border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)] rounded-lg text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-accent-bright/50"
                                    />
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => addSet(item.id)}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)] text-text-secondary hover:text-text-primary transition-colors"
                                >
                                  + Add set
                                </button>
                                <button
                                  onClick={() => saveLog(item.id, session.id)}
                                  disabled={isSaving}
                                  className="flex-1 text-sm px-4 py-1.5 rounded-lg bg-accent-bright text-black font-bold hover:bg-accent-bright/90 transition-colors disabled:opacity-50"
                                >
                                  {isSaving ? "Saving..." : "Save"}
                                </button>
                                <button
                                  onClick={() => setOpenLogPanel(null)}
                                  className="text-xs px-3 py-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>

                              {/* Show previously logged data if exists */}
                              {log && log.sets_data?.length > 0 && !draftSets[item.id]?.some(s => s.reps || s.weight) && (
                                <div className="mt-3 pt-3 border-t border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)]">
                                  <p className="text-xs text-text-secondary mb-1 font-medium">Previously logged:</p>
                                  {log.sets_data.map((s, i) => (
                                    <span key={i} className="text-xs text-text-secondary mr-3">
                                      Set {s.set_number}: {s.weight && `${s.weight}kg`} {s.reps && `x ${s.reps}`}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Session log summary */}
                  {session.items.filter(i => i.exercise_id !== "__section__").length > 0 && (
                    <div className="px-5 py-3 bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)] flex items-center justify-between">
                      <span className="text-sm text-text-secondary">
                        Session progress
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {session.items.filter(i => i.exercise_id !== "__section__").map((item) => {
                            const log = getLog(item.id);
                            return (
                              <div
                                key={item.id}
                                className={`w-2 h-2 rounded-full ${log?.completed ? "bg-emerald-500" : "bg-[rgba(0,0,0,0.1)] dark:bg-[rgba(255,255,255,0.12)]"}`}
                              />
                            );
                          })}
                        </div>
                        <span className="text-sm font-semibold text-text-primary">
                          {loggedCount}/{sessionExerciseIds.length}
                        </span>
                      </div>
                    </div>
                  )}

                  {session.items.length === 0 && (
                    <div className="px-5 py-6 text-center text-text-secondary text-sm">
                      No exercises in this session yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
