"use client";

import { useState } from "react";
import type { AdminClient } from "@/lib/admin-data";
import { dateKeyInTimeZone } from "@/lib/founder-dashboard";
import { addDaysToKey } from "@/lib/storm-warning";
import { resolveDailySteps } from "@/lib/daily-steps";
import type { DashboardSessionSummary } from "@/lib/admin-dashboard";
import DashboardDetail from "./DashboardDetail";

type DayMetric = { label: string; value: string; source: string; recorded: boolean };
export default function DashboardHabitOverview({ entries, summaries, workouts }: {
  entries: NonNullable<AdminClient["daily_metrics"]>;
  summaries: NonNullable<AdminClient["wearable_summaries"]>;
  workouts: DashboardSessionSummary[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const today = dateKeyInTimeZone(new Date(), "Europe/London");
  const days = Array.from({ length: 7 }, (_, index) => addDaysToKey(today, index - 6));
  function dayMetrics(day: string): DayMetric[] {
    const entry = entries.find((item) => item.tracked_date === day);
    const wearable = summaries.find((item) => item.summary_date === day);
    const steps = resolveDailySteps(entry?.manual_steps, wearable?.steps);
    const numeric = (label: string, manual: number | null | undefined, synced: number | null | undefined, unit: string): DayMetric => {
      const value = manual ?? synced;
      const recorded = typeof value === "number" && Number.isFinite(value);
      return { label, value: recorded ? `${Number(value.toFixed(1)).toLocaleString("en-GB")}${unit}` : "—", source: recorded ? manual !== null && manual !== undefined ? "Client entry" : "Connected app" : "Not recorded", recorded };
    };
    const saved = workouts.filter((workout) => workout.log_date === day).length;
    return [
      numeric("Sleep", entry?.sleep_hours, wearable?.sleep_minutes === null || wearable?.sleep_minutes === undefined ? null : wearable.sleep_minutes / 60, "h"),
      numeric("Water", entry?.water_liters, wearable?.water_ml === null || wearable?.water_ml === undefined ? null : wearable.water_ml / 1000, "L"),
      { label: "Steps", value: steps.value === null ? "—" : steps.value.toLocaleString("en-GB"), source: steps.value === null ? "Not recorded" : steps.source === "manual" ? "Client entry" : "Connected app", recorded: steps.value !== null },
      numeric("Energy", entry?.energy_level, null, "/10"),
      numeric("Stress", entry?.stress_level, null, "/10"),
      numeric("Nutrition", entry?.nutrition_score, null, "/10"),
      { label: "Training", value: saved ? `${saved} saved` : entry?.training_completed ? "Marked done" : "—", source: saved ? "Workout saved" : entry?.training_completed ? "Client entry" : "Not marked", recorded: saved > 0 || !!entry?.training_completed },
    ];
  }
  const selectedEntry = entries.find((entry) => entry.tracked_date === selected);
  const dateLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });
  return <section aria-label="Daily Habit Tracker" className="min-w-0 rounded-2xl border border-black/10 bg-bg-card p-4 sm:p-5">
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-accent-bright [&::-webkit-details-marker]:hidden">
        <h3 className="text-sm font-heading font-bold text-text-primary">Daily Habit Tracker <span className="ml-2 font-normal text-xs text-text-muted">Last 7 days</span></h3>
        <span className="flex items-center gap-2 text-xs font-semibold text-accent-bright"><span className="group-open:hidden">Show daily tracker</span><span className="hidden group-open:inline">Hide daily tracker</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg></span>
      </summary>
    <p className="mt-1 text-xs text-text-muted">Select a day or a number for the full entry. A dash means no value recorded.</p>
    <div className="mt-4 overflow-x-auto rounded-xl focus-visible:outline-2 focus-visible:outline-accent-bright" tabIndex={0} role="region" aria-label="Seven-day daily tracker; scroll horizontally on smaller screens">
      <table className="w-full min-w-[640px] border-separate border-spacing-1 text-xs">
        <thead><tr><th className="sticky left-0 z-10 w-24 bg-bg-card text-left text-text-muted">Metric</th>{days.map((day) => <th key={day} className="min-w-16 text-center"><button type="button" onClick={() => setSelected(day)} className="w-full rounded-lg px-1 py-2 font-semibold text-text-secondary hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent-bright" aria-label={`Open daily entry for ${dateLabel(day)}`}>{day === today ? "Today" : new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short" })}<span className="mt-1 block text-[10px] font-normal text-text-muted">{day.slice(8)}</span></button></th>)}</tr></thead>
        <tbody>{dayMetrics(today).map((metric, row) => <tr key={metric.label}><th className="sticky left-0 z-10 bg-bg-card pr-3 text-left font-medium text-text-secondary">{metric.label}</th>{days.map((day) => {
          const item = dayMetrics(day)[row];
          return <td key={day}><button type="button" onClick={() => setSelected(day)} aria-label={`${item.label}, ${dateLabel(day)}: ${item.recorded ? item.value : item.source}. Open details`} className={`min-h-10 w-full rounded-lg border px-1 py-2 font-medium transition-colors hover:border-[#E040D0]/40 focus-visible:outline-2 focus-visible:outline-accent-bright ${item.recorded ? "border-[#E040D0]/15 bg-[#E040D0]/5 text-text-primary" : "border-black/5 bg-bg-primary text-text-muted"}`}>{item.value}</button></td>;
        })}</tr>)}</tbody>
      </table>
    </div>
    </details>
    {selected && <DashboardDetail title={`Daily entry · ${dateLabel(selected)}`} onClose={() => setSelected(null)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{dayMetrics(selected).map((metric) => <div key={metric.label} className="rounded-xl border border-black/5 bg-bg-primary p-3"><p className="text-xs text-text-muted">{metric.label}</p><p className="mt-1 text-lg font-semibold text-text-primary">{metric.value}</p><p className="mt-1 text-[10px] text-text-muted">{metric.source}</p></div>)}</div>
      <div className="mt-5"><h3 className="text-sm font-semibold text-text-primary">Client notes</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">{selectedEntry?.notes || "No notes shared for this day."}</p></div>
      {!selectedEntry && <p className="mt-4 text-xs text-text-muted">No daily tracker entry submitted. Any values above come from connected apps or saved workouts.</p>}
    </DashboardDetail>}
  </section>;
}
