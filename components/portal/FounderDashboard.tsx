"use client";

import Link from "next/link";
import type { CalendarEvent, ClientProfile, ClientTask } from "@/lib/types";
import type { WearableDailySummary } from "@/lib/wearable-insights";
import type { CapacityBaseline, CapacityMetrics } from "@/lib/capacity-baseline";
import type { StormWarningClientState } from "@/lib/storm-warning";
import type { EarlyWinView } from "@/lib/early-win";
import EarlyWinCard from "@/components/portal/EarlyWinCard";
import {
  calendarEventOccursOn,
  calendarWindowLoad,
  isCurrentWearableSummary,
  localDateKey,
} from "@/lib/founder-dashboard";

type DayLoad = {
  date: Date;
  count: number;
  isToday: boolean;
};

type BaselineComparison = {
  baseline: CapacityBaseline | null;
  current: { period_start: string; period_end: string; metrics: CapacityMetrics };
  comparison: Record<keyof CapacityMetrics, {
    baseline: number | null;
    current: number | null;
    delta: number | null;
    direction: "improved" | "declined" | "unchanged" | "missing";
  }> | null;
  month4Review?: {
    review_date: string;
    outcome_note: string;
    completed_at: string | null;
    source_period: { start: string; end: string } | null;
    comparison_period: { start: string; end: string } | null;
  } | null;
};

function periodLabel(dateKey: string) {
  const parsed = new Date(`${dateKey.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getWeekLoad(events: CalendarEvent[]): DayLoad[] {
  const today = new Date();
  return calendarWindowLoad(events, today).map((day, index) => ({
    date: day.date,
    count: day.count,
    isToday: index === 0,
  }));
}

function getUpcomingEvents(events: CalendarEvent[]) {
  const now = new Date();
  const occurrences: Array<{ event: CalendarEvent; date: Date }> = [];

  for (let offset = 0; offset < 8; offset++) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    date.setHours(12, 0, 0, 0);
    for (const event of events) {
      if (!calendarEventOccursOn(event, date)) continue;
      const occurrence = new Date(`${localDateKey(date)}T${event.event_time || "09:00"}:00`);
      if (occurrence >= now) occurrences.push({ event, date: occurrence });
    }
  }

  return occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function capacityLanguage(summary: WearableDailySummary | null) {
  if (!summary || summary.readiness_score === null) {
    return {
      score: null,
      load: 0,
      label: "Waiting for today's signals",
      detail: "Connect a wearable to bring sleep and recovery into this readout.",
      tone: "text-white/65",
    };
  }

  const summaryDate = summary.summary_date.slice(0, 10);
  if (!isCurrentWearableSummary(summaryDate)) {
    const lastUpdate = new Date(`${summaryDate}T12:00:00`);
    return {
      score: null,
      load: 0,
      label: "Signals need a refresh",
      detail: Number.isNaN(lastUpdate.getTime())
        ? "Today's wearable summary has not arrived yet."
        : `The latest wearable summary is from ${lastUpdate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`,
      tone: "text-amber-300",
    };
  }

  const score = summary.readiness_score;
  const load = 100 - score;
  if (summary.recovery_status === "reduce_intensity") {
    return {
      score,
      load,
      label: "Protect day",
      detail: summary.insight || "Recovery is under pressure. Keep the load controlled today.",
      tone: "text-red-300",
    };
  }
  if (summary.recovery_status === "watch") {
    return {
      score,
      load,
      label: "Manage the load",
      detail: summary.insight || "Capacity is a little lower. Keep execution high and intensity sensible.",
      tone: "text-amber-300",
    };
  }
  return {
    score,
    load,
    label: "Capacity looks steady",
    detail: summary.insight || "No recovery signal is asking for a change today.",
    tone: "text-emerald-300",
  };
}

export default function FounderDashboard({
  profile,
  userName,
  tasks,
  calendarEvents,
  wearableSummary,
  wearableMockMode,
  todayTraining,
  activeTrainingPlan,
  baselineComparison,
  stormWarning,
  earlyWin,
  onToggleTask,
  onDismissStormWarning,
}: {
  profile: ClientProfile;
  userName: string;
  tasks: ClientTask[];
  calendarEvents: CalendarEvent[];
  wearableSummary: WearableDailySummary | null;
  wearableMockMode: boolean;
  todayTraining: string | null;
  activeTrainingPlan: string | null;
  baselineComparison: BaselineComparison | null;
  stormWarning: StormWarningClientState | null;
  earlyWin: EarlyWinView | null;
  onToggleTask: (taskId: string, completed: boolean) => void;
  onDismissStormWarning: () => void;
}) {
  const capacity = capacityLanguage(wearableSummary);
  const weekLoad = getWeekLoad(calendarEvents);
  const upcoming = getUpcomingEvents(calendarEvents);
  const nextEvent = upcoming[0] || null;
  const todayCount = weekLoad[0]?.count || 0;
  const weekTotal = weekLoad.reduce((total, day) => total + day.count, 0);
  const stormEvaluation = stormWarning && stormWarning.evaluation.warning && !stormWarning.silenced
    ? stormWarning.evaluation
    : null;
  const stormLines = stormEvaluation
    ? stormEvaluation.rules.filter((rule) => rule.triggered).map((rule) => rule.explanation)
    : [];
  const openCoachTasks = tasks.filter((task) => task.source !== "client" && !task.completed);
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-8 pt-1">
      <header className="px-1">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#E667D6]">Today at a glance</div>
        <h1 className="mt-1 font-heading text-3xl font-bold leading-tight text-text-primary">
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}
          {userName ? `, ${userName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{todayLabel}</p>
      </header>

      <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111114] text-white shadow-[0_22px_70px_rgba(0,0,0,0.24)]">
        <div className="border-b border-white/8 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Shape of the day</div>
              {nextEvent ? (
                <>
                  <div className="mt-2 truncate text-xl font-bold">{nextEvent.event.title}</div>
                  <div className="mt-1 text-sm text-white/60">
                    Next at {nextEvent.date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    {todayCount > 0 ? ` · ${todayCount} item${todayCount === 1 ? "" : "s"} today` : ""}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-2 text-xl font-bold">No calendar pressure showing</div>
                  <div className="mt-1 text-sm text-white/60">Your connected calendar will anchor the day here.</div>
                </>
              )}
            </div>
            <Link href="/portal/calendar" className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-white/12 text-white/70 no-underline" aria-label="Open calendar">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Today&apos;s capacity</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="metric-num text-4xl font-bold">{capacity.score ?? "—"}</span>
                {capacity.score !== null && <span className="text-sm text-white/45">/ 100</span>}
              </div>
            </div>
            <div className={`text-right text-sm font-bold ${capacity.tone}`}>{capacity.label}</div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10" aria-label={`System load ${capacity.load} percent`}>
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${
                capacity.load >= 62 ? "bg-red-400" : capacity.load >= 38 ? "bg-amber-300" : "bg-[#E667D6]"
              }`}
              style={{ width: `${capacity.score === null ? 0 : Math.max(5, capacity.load)}%` }}
            />
          </div>
          <div className="mt-2 flex items-start justify-between gap-4">
            <p className="max-w-xl text-xs leading-5 text-white/55">{capacity.detail}</p>
            {wearableMockMode && wearableSummary && <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">Preview data</span>}
          </div>
        </div>
      </section>

      {earlyWin && <EarlyWinCard view={earlyWin} />}

      {stormEvaluation && (
        <section
          className={`rounded-2xl border px-5 py-4 ${
            stormEvaluation.severity === "red"
              ? "border-red-400/25 bg-red-400/8"
              : "border-amber-400/25 bg-amber-400/8"
          }`}
        >
          <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
            stormEvaluation.severity === "red" ? "text-red-400" : "text-amber-400"
          }`}>
            Storm warning
          </div>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {stormEvaluation.severity === "red"
              ? "A heavy stretch is building across the next seven days."
              : "A dense stretch is building across the next seven days."}
          </p>
          <ul className="mt-2 space-y-1">
            {stormLines.map((line) => (
              <li key={line} className="text-xs leading-5 text-text-secondary">- {line}</li>
            ))}
          </ul>
          {!stormEvaluation.usedHistory && (
            <p className="mt-2 text-[11px] leading-4 text-text-muted">
              Based on this week&apos;s calendar alone - there is not enough history yet to compare against your usual pattern.
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs leading-5 text-text-secondary">Gordy can see this pressure too, so training and recovery can be adjusted before it lands.</p>
            <button
              type="button"
              onClick={onDismissStormWarning}
              className="flex-none text-[11px] font-semibold text-text-muted underline-offset-2 hover:underline"
            >
              Noted - hide for this week
            </button>
          </div>
        </section>
      )}

      <section className="border-y border-[rgba(255,255,255,0.08)] py-5">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="font-heading text-lg font-bold text-text-primary">Non-negotiables</h2>
            <p className="text-xs text-text-secondary">The few things that matter today.</p>
          </div>
          <Link href="/portal/exercise-plan" className="text-xs font-semibold text-[#E667D6] no-underline">Training plan</Link>
        </div>
        <div className="space-y-2">
          <Link
            href="/portal/exercise-plan"
            className="flex w-full items-center gap-3 rounded-xl border border-[#E667D6]/20 bg-[#E667D6]/6 px-4 py-3 text-left no-underline"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#E667D6]/12 text-[#E667D6]">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 12h16M7 8v8m10-8v8" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#E667D6]">Today&apos;s training</span>
              <span className="mt-0.5 block truncate text-sm font-semibold text-text-primary">
                {todayTraining || (activeTrainingPlan ? "No session assigned today" : "Training plan not assigned")}
              </span>
            </span>
            <svg className="ml-auto h-4 w-4 flex-none text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          {openCoachTasks.length > 0 ? openCoachTasks.slice(0, 3).map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onToggleTask(task.id, true)}
              className="flex w-full items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-bg-card px-4 py-3 text-left"
            >
              <span className="flex h-5 w-5 flex-none items-center justify-center rounded-md border border-[#E667D6]/50" />
              <span className="text-sm font-semibold text-text-primary">{task.task_text}</span>
            </button>
          )) : (
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-bg-card px-4 py-4 text-sm text-text-secondary">
              Nothing extra from Gordy today. Follow the plan and protect the basics.
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="px-1 font-heading text-lg font-bold text-text-primary">Track through</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { href: "/portal/nutrition-plan", label: "Nutrition", path: "M12 8.25v10.5m-4.5-6h9" },
            { href: "/portal/exercise-plan", label: "Training", path: "M4 12h16M7 8v8m10-8v8" },
            { href: "/portal/daily-tracker", label: "Energy", path: "M5 12h3l2-5 4 10 2-5h3" },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-bg-card px-2 text-center text-text-primary no-underline"
            >
              <svg className="h-5 w-5 text-[#E667D6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={action.path} />
              </svg>
              <span className="text-xs font-semibold">{action.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="pt-1">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="font-heading text-lg font-bold text-text-primary">Week ahead</h2>
            <p className="text-xs text-text-secondary">{weekTotal ? `${weekTotal} calendar item${weekTotal === 1 ? "" : "s"} showing` : "Calendar density will show here"}</p>
          </div>
          <Link href="/portal/calendar" className="text-xs font-semibold text-[#E667D6] no-underline">Open calendar</Link>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {weekLoad.map((day) => {
            const pressure = day.count >= 4 ? "bg-red-400" : day.count >= 2 ? "bg-amber-300" : day.count === 1 ? "bg-[#E667D6]" : "bg-white/10";
            return (
              <div key={localDateKey(day.date)} className={`rounded-xl border px-1.5 py-3 text-center ${day.isToday ? "border-[#E667D6]/45 bg-[#E667D6]/8" : "border-[rgba(255,255,255,0.07)] bg-bg-card"}`}>
                <div className="text-[9px] font-bold uppercase text-text-muted">{day.date.toLocaleDateString("en-GB", { weekday: "narrow" })}</div>
                <div className="mt-1 text-sm font-bold text-text-primary">{day.date.getDate()}</div>
                <div className={`mx-auto mt-2 h-1.5 w-full max-w-6 rounded-full ${pressure}`} />
                <div className="mt-1 text-[9px] text-text-muted">{day.count || "—"}</div>
              </div>
            );
          })}
        </div>
      </section>

      {baselineComparison?.baseline && baselineComparison.comparison && (
        <section className="border-t border-[rgba(255,255,255,0.08)] pt-5">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="font-heading text-lg font-bold text-text-primary">Baseline vs now</h2>
              <p className="text-xs text-text-secondary">Month 1 reference compared with the latest 14 days.</p>
            </div>
            <Link href="/portal/progress" className="text-xs font-semibold text-[#E667D6] no-underline">Progress</Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { key: "hrv_ms" as const, label: "HRV", unit: "ms" },
              { key: "resting_hr_bpm" as const, label: "Resting HR", unit: "bpm" },
              { key: "sleep_minutes" as const, label: "Sleep", unit: "min" },
              { key: "waist_cm" as const, label: "Waist", unit: "cm" },
            ].map((metric) => {
              const value = baselineComparison.comparison?.[metric.key];
              return (
                <div key={metric.key} className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-bg-card px-3 py-3">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-text-muted">{metric.label}</div>
                  <div className="mt-1 text-sm font-bold text-text-primary">
                    {value?.current === null || value?.current === undefined ? "—" : `${Math.round(value.current * 10) / 10} ${metric.unit}`}
                  </div>
                  <div className={`mt-1 text-[10px] ${
                    value?.direction === "improved"
                      ? "text-emerald-400"
                      : value?.direction === "declined"
                        ? "text-amber-400"
                        : "text-text-muted"
                  }`}>
                    {value?.delta === null || value?.delta === undefined
                      ? "Waiting for data"
                      : `${value.delta > 0 ? "+" : ""}${value.delta} from baseline`}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[10px] leading-4 text-text-muted">This view shows movement only. Guarantee conditions are not applied until Gordy confirms the exact thresholds.</p>
          {baselineComparison.month4Review && (
            <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-bg-card px-4 py-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#E667D6]">Month 4 review</div>
              <p className="mt-1 text-xs leading-5 text-text-secondary">{baselineComparison.month4Review.outcome_note}</p>
              {baselineComparison.month4Review.source_period && baselineComparison.month4Review.comparison_period && (
                <p className="mt-1 text-[10px] text-text-muted">
                  Compared your Month 1 baseline ({periodLabel(baselineComparison.month4Review.source_period.start)} to {periodLabel(baselineComparison.month4Review.source_period.end)}) with {periodLabel(baselineComparison.month4Review.comparison_period.start)} to {periodLabel(baselineComparison.month4Review.comparison_period.end)}.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <div className="px-1 text-[11px] leading-5 text-text-muted">
        Your dashboard watches the signals. Gordy manages the decisions.
        {profile.cycle_tracking_enabled ? " Cycle context is included in the data Gordy reviews." : ""}
      </div>
    </div>
  );
}
