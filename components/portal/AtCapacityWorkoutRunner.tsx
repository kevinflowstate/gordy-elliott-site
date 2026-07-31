"use client";

import { useEffect, useMemo, useState } from "react";
import { formatExercisePrescription, shouldUseSetLogging } from "@/lib/exercise-prescriptions";
import type { WorkoutSetData } from "@/lib/workout-runner";
import type { ExerciseSession, ExerciseSessionItem } from "@/lib/types";

type RunnerStage = "preview" | "section" | "exercise" | "review" | "summary";

interface WorkoutRunnerProps {
  session: ExerciseSession;
  dateLabel: string;
  sets: Record<string, WorkoutSetData[]>;
  startedAt: number | null;
  saving: boolean;
  saveError: string | null;
  onClose: () => void;
  onStart: () => void;
  onUpdateSet: (
    itemId: string,
    setIndex: number,
    field: keyof WorkoutSetData,
    value: string | boolean,
  ) => void;
  onToggleSet: (itemId: string, setIndex: number) => void;
  onAddSet: (itemId: string) => void;
  onApplyFirstSetToAll: (itemId: string) => void;
  onFinish: () => Promise<boolean>;
}

interface RunnerExercise {
  item: ExerciseSessionItem;
  section: string | null;
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

function LiveTimer({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  return <>{startedAt ? formatElapsed(now - startedAt) : "0:00"}</>;
}

function buildExercises(session: ExerciseSession): RunnerExercise[] {
  let section: string | null = null;
  const exercises: RunnerExercise[] = [];

  for (const item of session.items) {
    if (item.exercise_id === "__section__") {
      section = item.section_label?.trim() || "Next section";
      continue;
    }
    exercises.push({ item, section });
  }

  return exercises;
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: "back" | "check" | "close" | "play" | "timer";
  className?: string;
}) {
  const paths = {
    back: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15 18-6-6 6-6" />,
    check: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="m5 12 4 4L19 6" />,
    close: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l12 12M18 6 6 18" />,
    play: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m10 8 6 4-6 4V8Z" />,
    timer: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l2.5 1.5" />
        <circle cx="12" cy="13" r="8" strokeWidth="2" />
        <path strokeLinecap="round" strokeWidth="2" d="M9 2h6" />
      </>
    ),
  };

  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function AtCapacityWorkoutRunner({
  session,
  dateLabel,
  sets,
  startedAt,
  saving,
  saveError,
  onClose,
  onStart,
  onUpdateSet,
  onToggleSet,
  onAddSet,
  onApplyFirstSetToAll,
  onFinish,
}: WorkoutRunnerProps) {
  const exercises = useMemo(() => buildExercises(session), [session]);
  const [stage, setStage] = useState<RunnerStage>("preview");
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [workoutStartedAt, setWorkoutStartedAt] = useState<number | null>(startedAt);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  const current = exercises[exerciseIndex];
  const completedSets = exercises.reduce(
    (total, exercise) => total + (sets[exercise.item.id] || []).filter((set) => set.completed).length,
    0,
  );
  const totalSets = exercises.reduce(
    (total, exercise) => total + (sets[exercise.item.id] || []).length,
    0,
  );
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (startedAt) setWorkoutStartedAt(startedAt);
  }, [startedAt]);

  useEffect(() => {
    if (restRemaining === null) return;
    if (restRemaining <= 0) {
      const timeout = window.setTimeout(() => setRestRemaining(null), 900);
      return () => window.clearTimeout(timeout);
    }
    const interval = window.setInterval(() => {
      setRestRemaining((remaining) => remaining === null ? null : Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [restRemaining]);

  function enterExercise(index: number, fromSection: string | null) {
    const next = exercises[index];
    setExerciseIndex(index);
    if (next?.section && next.section !== fromSection) {
      setStage("section");
    } else {
      setStage("exercise");
    }
  }

  function startWorkout() {
    if (!workoutStartedAt) {
      setWorkoutStartedAt(Date.now());
      onStart();
    }
    if (exercises[0]?.section) setStage("section");
    else setStage("exercise");
  }

  function previous() {
    if (exerciseIndex === 0) {
      setStage("preview");
      return;
    }
    const previousIndex = exerciseIndex - 1;
    setExerciseIndex(previousIndex);
    setStage("exercise");
  }

  function next() {
    if (exerciseIndex >= exercises.length - 1) {
      setStage("review");
      return;
    }
    enterExercise(exerciseIndex + 1, current?.section || null);
  }

  function toggleSet(item: ExerciseSessionItem, setIndex: number) {
    const wasCompleted = sets[item.id]?.[setIndex]?.completed;
    onToggleSet(item.id, setIndex);
    if (!wasCompleted && item.rest_seconds && item.rest_seconds > 0) {
      setRestRemaining(item.rest_seconds);
    }
  }

  async function finishWorkout() {
    setFinishing(true);
    const saved = await onFinish();
    setFinishing(false);
    if (saved) {
      setFinishedAt(Date.now());
      setStage("summary");
    }
  }

  const progress = exercises.length > 0
    ? stage === "review" || stage === "summary"
      ? 100
      : Math.round(((exerciseIndex + 1) / exercises.length) * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-[#09090b] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`${session.name} workout`}
    >
      <header className="shrink-0 border-b border-white/8 bg-[#09090b]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || finishing}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-white active:scale-95 disabled:opacity-40"
            aria-label="Close workout"
          >
            <Icon name="close" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F060E0]">
              {session.name}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-white/75">
              <Icon name="timer" className="h-4 w-4" />
              <LiveTimer startedAt={workoutStartedAt} />
            </p>
          </div>
          <p className="shrink-0 text-xs font-semibold text-white/55">
            {stage === "preview" ? dateLabel : stage === "review" ? "Review" : stage === "summary" ? "Complete" : `${exerciseIndex + 1}/${exercises.length}`}
          </p>
        </div>
        <div className="mx-auto mt-3 h-1 w-full max-w-2xl overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-[#E040D0] transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-2xl px-4 py-5">
          {stage === "preview" && (
            <div className="flex min-h-[calc(100dvh-12rem)] flex-col justify-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F060E0]">{dateLabel}</p>
              <h1 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white">{session.name}</h1>
              {session.notes && <p className="mt-4 max-w-lg text-base leading-6 text-white/60">{session.notes}</p>}
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                  <p className="text-3xl font-black">{exercises.length}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/45">Exercises</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                  <p className="text-3xl font-black">{totalSets}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/45">Working sets</p>
                </div>
              </div>
              <div className="mt-6 space-y-2">
                {exercises.map(({ item, section }, index) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E040D0]/12 text-xs font-bold text-[#F060E0]">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      {section && <p className="truncate text-[10px] font-bold uppercase tracking-wider text-white/35">{section}</p>}
                      <p className="truncate text-sm font-semibold">{item.exercise?.name || "Exercise"}</p>
                    </div>
                    <p className="shrink-0 text-xs font-semibold text-white/45">{formatExercisePrescription(item)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stage === "section" && current && (
            <div className="flex min-h-[calc(100dvh-12rem)] flex-col items-center justify-center text-center">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#F060E0]">Up next</p>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.04em]">{current.section}</h1>
              <p className="mt-3 text-sm text-white/50">
                {exercises.filter((exercise) => exercise.section === current.section).length} exercises in this section
              </p>
              <button
                type="button"
                onClick={() => setStage("exercise")}
                className="mt-10 min-h-12 w-full max-w-sm rounded-2xl bg-[#E040D0] px-6 py-3.5 text-sm font-bold text-white active:scale-[0.99]"
              >
                Start section
              </button>
            </div>
          )}

          {stage === "exercise" && current && (
            <div className="pb-3">
              {current.section && <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F060E0]">{current.section}</p>}
              <div className="mt-2 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white/40">Exercise {exerciseIndex + 1} of {exercises.length}</p>
                  <h1 className="mt-1 text-3xl font-black leading-tight tracking-[-0.035em]">{current.item.exercise?.name || "Exercise"}</h1>
                </div>
                <span className="shrink-0 rounded-xl bg-[#E040D0]/12 px-3 py-2 text-xs font-bold text-[#F060E0]">
                  {formatExercisePrescription(current.item)}
                </span>
              </div>

              {(current.item.notes || current.item.tempo || current.item.rest_seconds) && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                  {current.item.rest_seconds ? <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">{current.item.rest_seconds}s rest</span> : null}
                  {current.item.tempo ? <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5">Tempo {current.item.tempo}</span> : null}
                  {current.item.notes ? <p className="w-full rounded-2xl border border-white/8 bg-white/[0.04] p-3 font-normal leading-5 text-white/60">{current.item.notes}</p> : null}
                </div>
              )}

              {current.item.exercise && (
                <button
                  type="button"
                  onClick={() => {
                    const url = current.item.exercise?.video_url
                      || `https://musclewiki.com/exercises?search=${encodeURIComponent(current.item.exercise?.name ?? "")}`;
                    window.open(url, "_blank", "noopener");
                  }}
                  className="mt-4 flex min-h-24 w-full items-center justify-center gap-2 rounded-2xl border border-[#E040D0]/20 bg-[linear-gradient(135deg,rgba(224,64,208,0.15),rgba(255,255,255,0.025))] text-sm font-bold text-[#F060E0]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[#E040D0] text-white"><Icon name="play" /></span>
                  Watch exercise demo
                </button>
              )}

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">Log your work</h2>
                  {shouldUseSetLogging(current.item) && (sets[current.item.id]?.length || 0) > 1 && (
                    <button
                      type="button"
                      onClick={() => onApplyFirstSetToAll(current.item.id)}
                      className="rounded-full border border-[#E040D0]/30 bg-[#E040D0]/8 px-3 py-1.5 text-xs font-bold text-[#F060E0]"
                    >
                      Apply set 1 to all
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-3">
                  {(sets[current.item.id] || []).map((set, setIndex) => (
                    <div
                      key={set.set_number}
                      className={`rounded-2xl border p-3 transition-colors ${set.completed ? "border-emerald-400/35 bg-emerald-400/8" : "border-white/9 bg-white/[0.035]"}`}
                    >
                      <div className={`grid items-end gap-2 ${shouldUseSetLogging(current.item) ? "grid-cols-[2.75rem_1fr_1fr_3rem]" : "grid-cols-[1fr_3rem]"}`}>
                        {shouldUseSetLogging(current.item) && (
                          <div className="grid h-12 place-items-center rounded-xl bg-white/5 text-sm font-black text-white/55" aria-label={`Set ${set.set_number}`}>
                            {set.set_number}
                          </div>
                        )}
                        {shouldUseSetLogging(current.item) ? (
                          <>
                            <label>
                              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Weight</span>
                              <div className="relative">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={set.weight}
                                  onChange={(event) => onUpdateSet(current.item.id, setIndex, "weight", event.target.value)}
                                  placeholder="0"
                                  aria-label={`Set ${set.set_number} weight in kg`}
                                  className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 pr-8 text-base font-bold text-white outline-none placeholder:text-white/20 focus:border-[#E040D0]/70"
                                />
                                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/30">kg</span>
                              </div>
                            </label>
                            <label>
                              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Reps</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={set.reps}
                                onChange={(event) => onUpdateSet(current.item.id, setIndex, "reps", event.target.value)}
                                placeholder={current.item.reps || "0"}
                                aria-label={`Set ${set.set_number} reps`}
                                className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base font-bold text-white outline-none placeholder:text-white/20 focus:border-[#E040D0]/70"
                              />
                            </label>
                          </>
                        ) : (
                          <label>
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Result</span>
                            <input
                              type="text"
                              value={set.reps}
                              onChange={(event) => onUpdateSet(current.item.id, setIndex, "reps", event.target.value)}
                              placeholder={formatExercisePrescription(current.item)}
                              aria-label={`${current.item.exercise?.name || "Exercise"} result`}
                              className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base font-bold text-white outline-none placeholder:text-white/20 focus:border-[#E040D0]/70"
                            />
                          </label>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleSet(current.item, setIndex)}
                          className={`mb-0 grid h-12 w-12 place-items-center rounded-xl border transition-colors ${set.completed ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/15 bg-white/5 text-white/35"}`}
                          aria-label={`${set.completed ? "Mark incomplete" : "Complete"} set ${set.set_number}`}
                        >
                          <Icon name="check" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={set.notes}
                        onChange={(event) => onUpdateSet(current.item.id, setIndex, "notes", event.target.value)}
                        placeholder="Add a note (optional)"
                        aria-label={`Set ${set.set_number} note`}
                        className="mt-2 h-10 w-full rounded-xl border border-white/8 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#E040D0]/60"
                      />
                    </div>
                  ))}
                </div>

                {shouldUseSetLogging(current.item) && (
                  <button
                    type="button"
                    onClick={() => onAddSet(current.item.id)}
                    className="mt-3 min-h-11 w-full rounded-xl border border-dashed border-white/15 text-sm font-bold text-white/55"
                  >
                    + Add another set
                  </button>
                )}
              </div>
            </div>
          )}

          {stage === "review" && (
            <div className="pb-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F060E0]">Final check</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">Review your session</h1>
              <p className="mt-2 text-sm leading-5 text-white/55">
                {completedSets === totalSets
                  ? "Everything is marked complete. Save when you’re happy with the session."
                  : `${totalSets - completedSets} set${totalSets - completedSets === 1 ? "" : "s"} still unmarked. You can go back or save the session as it is.`}
              </p>

              <div className="mt-5 space-y-3">
                {exercises.map(({ item }, index) => {
                  const exerciseSets = sets[item.id] || [];
                  const done = exerciseSets.length > 0 && exerciseSets.every((set) => set.completed);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setExerciseIndex(index);
                        setStage("exercise");
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-4 text-left"
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${done ? "bg-emerald-400 text-black" : "bg-white/8 text-white/35"}`}>
                        {done ? <Icon name="check" className="h-4 w-4" /> : index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{item.exercise?.name || "Exercise"}</p>
                        <p className="mt-0.5 text-xs text-white/40">
                          {exerciseSets.filter((set) => set.completed).length}/{exerciseSets.length} sets complete
                        </p>
                      </div>
                      <Icon name="back" className="h-4 w-4 rotate-180 text-white/30" />
                    </button>
                  );
                })}
              </div>

              {saveError && (
                <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-200">{saveError}</p>
              )}
              <button
                type="button"
                onClick={finishWorkout}
                disabled={saving || finishing}
                className="mt-5 min-h-13 w-full rounded-2xl bg-[#E040D0] px-5 py-4 text-sm font-black text-white disabled:opacity-55"
              >
                {saving || finishing ? "Saving session…" : "Save and end workout"}
              </button>
            </div>
          )}

          {stage === "summary" && (
            <div className="flex min-h-[calc(100dvh-12rem)] flex-col items-center justify-center text-center">
              <span className="grid h-20 w-20 place-items-center rounded-full bg-emerald-400 text-black">
                <Icon name="check" className="h-10 w-10" />
              </span>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#F060E0]">Workout complete</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.04em]">
                {totalSets > 0 && completedSets === totalSets ? "Strong work." : "Session saved."}
              </h1>
              <p className="mt-3 text-sm text-white/55">{completedSets} of {totalSets} sets logged as complete</p>
              <div className="mt-7 grid w-full max-w-sm grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                  <p className="text-2xl font-black">
                    {workoutStartedAt && finishedAt ? formatElapsed(finishedAt - workoutStartedAt) : "0:00"}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/35">Duration</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                  <p className="text-2xl font-black">{completedSets}/{totalSets}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/35">Sets logged</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-8 min-h-12 w-full max-w-sm rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-black"
              >
                Back to training
              </button>
            </div>
          )}
        </div>
      </main>

      {stage === "preview" && (
        <footer className="shrink-0 border-t border-white/8 bg-[#09090b]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <button type="button" onClick={startWorkout} disabled={exercises.length === 0} className="mx-auto block min-h-13 w-full max-w-2xl rounded-2xl bg-[#E040D0] px-6 py-4 text-sm font-black disabled:opacity-40">
            {workoutStartedAt ? "Continue workout" : "Start workout"}
          </button>
        </footer>
      )}

      {stage === "exercise" && (
        <footer className="shrink-0 border-t border-white/8 bg-[#09090b]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto grid w-full max-w-2xl grid-cols-[0.8fr_1.2fr] gap-3">
            <button type="button" onClick={previous} className="flex min-h-12 items-center justify-center gap-1 rounded-2xl border border-white/12 bg-white/5 px-4 text-sm font-bold text-white/70">
              <Icon name="back" className="h-4 w-4" /> Previous
            </button>
            <button type="button" onClick={next} className="min-h-12 rounded-2xl bg-white px-4 text-sm font-black text-black">
              {exerciseIndex === exercises.length - 1 ? "Review workout" : "Next exercise"}
            </button>
          </div>
        </footer>
      )}

      {stage === "section" && (
        <footer className="shrink-0 border-t border-white/8 bg-[#09090b]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <button type="button" onClick={previous} className="mx-auto flex min-h-12 w-full max-w-2xl items-center justify-center gap-1 rounded-2xl border border-white/12 bg-white/5 px-4 text-sm font-bold text-white/70">
            <Icon name="back" className="h-4 w-4" /> Back
          </button>
        </footer>
      )}

      {restRemaining !== null && stage === "exercise" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[110] flex justify-center px-4">
          <div className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${restRemaining === 0 ? "border-emerald-400/40 bg-emerald-950/95" : "border-[#E040D0]/30 bg-[#181119]/95"}`}>
            <span className={`grid h-10 w-10 place-items-center rounded-full ${restRemaining === 0 ? "bg-emerald-400 text-black" : "bg-[#E040D0] text-white"}`}>
              {restRemaining === 0 ? <Icon name="check" /> : <Icon name="timer" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-white/45">{restRemaining === 0 ? "Rest complete" : "Rest timer"}</p>
              <p className="text-lg font-black">{restRemaining === 0 ? "Ready for the next set" : `${restRemaining}s`}</p>
            </div>
            {restRemaining !== 0 && (
              <button type="button" onClick={() => setRestRemaining(null)} className="pointer-events-auto rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-white/60">
                Skip
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
