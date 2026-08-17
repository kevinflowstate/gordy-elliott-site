"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatDuration,
  type SessionPerformance,
  type StrengthProgressPayload,
  type StrengthTrackerProgress,
} from "@/lib/strength-progress";

function formatValue(tracker: StrengthTrackerProgress, value: number | null) {
  if (value === null) return "—";
  if (tracker.metricType === "duration") return formatDuration(value);
  if (tracker.metricType === "reps") return `${Math.round(value)} reps`;
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}kg`;
}

function formatChange(tracker: StrengthTrackerProgress) {
  if (tracker.change === null) return "Add another result to see the trend";
  const sign = tracker.change > 0 ? "+" : tracker.change < 0 ? "-" : "";
  if (tracker.metricType === "duration") return `${sign}${formatDuration(Math.abs(tracker.change))}`;
  if (tracker.metricType === "reps") return `${sign}${Math.round(tracker.change)} reps`;
  return `${sign}${tracker.change.toFixed(tracker.change % 1 === 0 ? 0 : 1)}kg`;
}

function shortDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatKg(value: number) {
  return `${Math.round(value).toLocaleString("en-GB")}kg`;
}

function sessionTrend(session: SessionPerformance) {
  if (!session.comparison) return "First recorded session";
  const tonnage = session.comparison.tonnageChangeKg;
  if (Math.abs(tonnage) >= 1) {
    return `${tonnage > 0 ? "+" : ""}${formatKg(tonnage)} vs last ${session.sessionName}`;
  }
  if (session.comparison.durationChangeSeconds !== null) {
    const seconds = session.comparison.durationChangeSeconds;
    if (seconds === 0) return "Same time as last session";
    return `${formatDuration(Math.abs(seconds))} ${seconds < 0 ? "quicker" : "longer"} than last time`;
  }
  return "Level with the last session";
}

export default function StrengthProgressPanel({
  data,
  loading,
  error,
}: {
  data: StrengthProgressPayload | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <section id="strength-performance" className="mb-6 space-y-3 scroll-mt-4">
        <div className="h-32 animate-pulse rounded-3xl bg-[rgba(0,0,0,0.05)]" />
        <div className="h-48 animate-pulse rounded-3xl bg-[rgba(0,0,0,0.05)]" />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section id="strength-performance" className="app-card-quiet mb-6 scroll-mt-4 rounded-3xl p-5">
        <h2 className="font-heading text-lg font-bold text-text-primary">Strength &amp; Performance</h2>
        <p className="mt-2 text-sm text-text-secondary">{error || "Strength progress is temporarily unavailable."}</p>
      </section>
    );
  }

  const consistency = data.consistency;
  return (
    <section id="strength-performance" className="mb-6 scroll-mt-4 space-y-4">
      <div className="app-card overflow-hidden rounded-[28px] border border-[#E040D0]/15 bg-[linear-gradient(135deg,rgba(224,64,208,0.16),rgba(59,130,246,0.06))] px-5 py-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#E040D0]">Training progress</div>
        <h2 className="mt-1 font-heading text-xl font-bold text-text-primary">Strength &amp; Performance</h2>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">
          See the work completed in each session, then follow the movements that matter for your plan.
        </p>
      </div>

      {(data.sessions || []).length > 0 ? (
        <div className="space-y-3">
          <div className="px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">Recent sessions</div>
          {(data.sessions || []).slice(0, 6).map((session, index) => (
            <details key={`${session.sessionId}:${session.date}`} className="group app-card rounded-[24px] p-4" open={index === 0}>
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#E040D0]">{shortDate(session.date)}</div>
                    <h3 className="mt-1 truncate font-heading text-lg font-bold text-text-primary">{session.sessionName}</h3>
                    <p className={`mt-1 text-xs ${session.comparison?.tonnageChangeKg && session.comparison.tonnageChangeKg > 0 ? "text-emerald-500" : "text-text-secondary"}`}>
                      {sessionTrend(session)}
                    </p>
                  </div>
                  <svg className="mt-2 h-4 w-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="app-inset rounded-2xl px-3 py-3">
                    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted">Tonnage</div>
                    <div className="mt-1 text-sm font-bold text-text-primary">{session.totalTonnageKg > 0 ? formatKg(session.totalTonnageKg) : "—"}</div>
                  </div>
                  <div className="app-inset rounded-2xl px-3 py-3">
                    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted">Time</div>
                    <div className="mt-1 text-sm font-bold text-text-primary">{session.durationSeconds !== null ? formatDuration(session.durationSeconds) : "—"}</div>
                  </div>
                  <div className="app-inset rounded-2xl px-3 py-3">
                    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted">Sets</div>
                    <div className="mt-1 text-sm font-bold text-text-primary">{session.completedSets}</div>
                  </div>
                </div>
              </summary>
              <div className="mt-4 space-y-3 border-t border-[rgba(0,0,0,0.06)] pt-4">
                {session.exercises.map((exercise) => (
                  <div key={exercise.exerciseId}>
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="truncate text-xs font-semibold text-text-primary">{exercise.exerciseName}</div>
                      <div className="shrink-0 text-[10px] text-text-muted">{exercise.totalTonnageKg > 0 ? formatKg(exercise.totalTonnageKg) : `${exercise.totalReps} reps`}</div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {exercise.sets.map((set, setIndex) => (
                        <span key={`${exercise.exerciseId}:${setIndex}`} className="rounded-full bg-[rgba(0,0,0,0.04)] px-2.5 py-1 text-[10px] text-text-secondary">
                          Set {set.setNumber}: {set.displayValue}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="app-card-quiet rounded-[24px] border border-dashed border-[#E040D0]/20 px-5 py-6 text-center">
          <div className="font-semibold text-text-primary">Your session progress will appear here</div>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">Complete a workout to see total work, time and how it compares with the previous session.</p>
        </div>
      )}

      <div className="px-1 pt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">Key movements</div>

      {data.trackers.length === 0 ? (
        <div className="app-card-quiet rounded-[24px] border border-dashed border-[#E040D0]/20 px-5 py-7 text-center">
          <div className="font-semibold text-text-primary">Key movements coming soon</div>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">
            Gordy can select the movements that matter for your plan. Completed sessions are already counting above.
          </p>
        </div>
      ) : (
        data.trackers.map((tracker) => (
          <article key={tracker.id} className="app-card rounded-[24px] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#E040D0]">{tracker.metricLabel}</div>
                <h3 className="mt-1 truncate font-heading text-lg font-bold text-text-primary">{tracker.exerciseName}</h3>
                <p className="mt-1 text-xs text-text-secondary">
                  {tracker.latestSetLabel
                    ? `${tracker.latestSetLabel} · ${tracker.latestDate ? shortDate(tracker.latestDate) : ""}`
                    : "Complete this movement in a workout to start the chart."}
                </p>
              </div>
              {tracker.currentValue !== null && (
                <div className="flex-shrink-0 text-right">
                  <div className="font-heading text-xl font-bold text-text-primary">{formatValue(tracker, tracker.currentValue)}</div>
                  <div className={`text-[10px] font-semibold ${tracker.change !== null && tracker.change > 0 ? "text-emerald-500" : "text-text-muted"}`}>
                    {formatChange(tracker)}
                  </div>
                </div>
              )}
            </div>

            {tracker.points.length > 0 ? (
              <div className="mt-4 h-36 overflow-hidden rounded-2xl bg-[rgba(0,0,0,0.02)] px-2 pt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tracker.points} margin={{ top: 6, right: 10, bottom: 4, left: -22 }}>
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 9, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      labelFormatter={(label) => shortDate(String(label))}
                      formatter={(value) => [formatValue(tracker, Number(value)), tracker.metricLabel]}
                      contentStyle={{ background: "var(--color-bg-card)", border: "1px solid rgba(224,64,208,0.2)", borderRadius: 12, fontSize: 11 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#E040D0"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#E040D0", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#E040D0" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[rgba(0,0,0,0.08)] px-4 py-6 text-center text-xs text-text-muted">
                No completed results yet.
              </div>
            )}

            {tracker.bestValue !== null && (
              <div className="mt-3 text-[11px] text-text-muted">
                Best recorded: <span className="font-semibold text-text-secondary">{formatValue(tracker, tracker.bestValue)}</span>
              </div>
            )}
          </article>
        ))
      )}

      <details className="group app-card-quiet rounded-[24px] p-4">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">Training consistency</div>
            <div className="mt-1 text-sm font-semibold text-text-primary">
              {consistency.completedSessions} of {consistency.plannedSessions || "—"} planned sessions · {consistency.completionRate !== null ? `${consistency.completionRate}%` : "schedule needed"}
            </div>
          </div>
          <svg className="h-4 w-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </summary>
        <div className="mt-3 grid grid-cols-4 gap-2 border-t border-[rgba(0,0,0,0.06)] pt-4" aria-label="Four-week training history">
          {consistency.weeks.map((week) => {
            const target = Math.max(week.planned, week.completed, 1);
            const percentage = Math.min(100, Math.round((week.completed / target) * 100));
            return (
              <div key={week.weekStart} className="text-center">
                <div className="flex h-12 items-end overflow-hidden rounded-lg bg-[rgba(0,0,0,0.04)]">
                  <div className="w-full rounded-lg bg-[#E040D0]/75" style={{ height: `${Math.max(percentage, week.completed ? 16 : 4)}%` }} />
                </div>
                <div className="mt-1 text-[9px] font-semibold text-text-muted">{shortDate(week.weekStart)}</div>
                <div className="text-[9px] text-text-secondary">{week.completed}/{week.planned || "—"}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-text-secondary">Active streak: {consistency.activeWeekStreak} {consistency.activeWeekStreak === 1 ? "week" : "weeks"}</div>
      </details>
    </section>
  );
}
