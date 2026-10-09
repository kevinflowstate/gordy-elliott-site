"use client";

import { sanitizeWearableRecovery, titleCaseProvider, type WearableConnection, type WearableDailySummary } from "@/lib/wearable-insights";
import { dateKeyInTimeZone } from "@/lib/founder-dashboard";
import { addDaysToKey } from "@/lib/storm-warning";

export default function DashboardRecoveryCard({ summaries, connections }: { summaries: WearableDailySummary[]; connections: WearableConnection[] }) {
  const today = dateKeyInTimeZone(new Date(), "Europe/London");
  const latest = [...summaries].sort((a, b) => b.summary_date.localeCompare(a.summary_date))[0];
  const safe = latest ? sanitizeWearableRecovery(latest) : null;
  const score = safe?.readiness_score;
  const available = safe && safe.recovery_status !== "unknown" && typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100;
  const colour = !available ? "var(--color-text-muted)" : safe.recovery_status === "reduce_intensity" ? "#f87171" : safe.recovery_status === "watch" ? "#fbbf24" : "#34d399";
  const active = connections.filter((connection) => connection.status === "connected");
  const days = Array.from({ length: 7 }, (_, index) => addDaysToKey(today, index - 6));
  return <section aria-label="Recovery" className="min-w-0 rounded-2xl border border-black/10 bg-bg-card p-5">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-heading font-bold text-text-primary">Recovery</h2>
      <span className="text-[10px] text-text-muted">{safe && safe.summary_date !== today ? "Historical" : "Today"}</span>
    </div>
    <div className="my-4 flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-black/5" strokeWidth="6" />
          {available && <circle cx="50" cy="50" r="42" fill="none" stroke={colour} strokeWidth="6" strokeLinecap="round" pathLength="100" strokeDasharray={`${score} 100`} />}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><strong className="text-2xl font-heading" style={{ color: colour }}>{available ? Math.round(score) : "—"}</strong><span className="text-[9px] text-text-muted">{available ? "out of 100" : "No score"}</span></div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{available ? safe.recovery_status === "good" ? "Good recovery" : safe.recovery_status === "watch" ? "Watch recovery" : "Reduce intensity" : "Recovery unavailable"}</p>
        <p className="mt-1 text-xs leading-5 text-text-muted">{available ? `Data: ${safe.summary_date}` : "Sleep and heart data are needed to assess recovery."}</p>
      </div>
    </div>
    <div className="flex items-end gap-2" aria-label="Seven-day recovery history">
      {days.map((day) => {
        const summary = summaries.find((entry) => entry.summary_date === day);
        const entry = summary ? sanitizeWearableRecovery(summary) : null;
        const value = entry?.readiness_score;
        const present = entry?.recovery_status !== "unknown" && typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
        return <div key={day} className="min-w-0 flex-1 text-center" title={`${day}: ${present ? `${value}/100` : "No recovery score"}`}>
          <div className="flex h-9 items-end justify-center">{present ? <div className="w-full max-w-5 rounded-t bg-[#E040D0]/45" style={{ height: `${Math.max(2, value * .36)}px` }} /> : <span className="text-xs text-text-muted">—</span>}</div>
          <span className="mt-1 block text-[9px] text-text-muted">{new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "narrow" })}</span>
        </div>;
      })}
    </div>
    <details className="mt-4 border-t border-black/5 pt-3">
      <summary className="cursor-pointer text-xs font-semibold text-accent-bright">Connected app details</summary>
      {safe ? <div className="mt-3 space-y-2 text-xs text-text-secondary">
        <div className="grid grid-cols-2 gap-2">
          <span>Sleep: {safe.sleep_minutes === null ? "—" : `${Math.floor(safe.sleep_minutes / 60)}h ${safe.sleep_minutes % 60}m`}</span>
          <span>HRV: {safe.hrv_ms === null ? "—" : `${Math.round(safe.hrv_ms)} ms`}</span>
          <span>Steps: {safe.steps?.toLocaleString("en-GB") ?? "—"}</span>
          <span>Protein: {safe.protein_g === null ? "—" : `${Math.round(safe.protein_g)} g`}</span>
        </div>
        {safe.insight && <p className="leading-5">{safe.insight}</p>}
        <p className="text-text-muted">Data date: {safe.summary_date}</p>
      </div> : <p className="mt-3 text-xs leading-5 text-text-muted">Ask the client to connect their wearable in Connected Apps.</p>}
      <div className="mt-3 space-y-2 text-xs text-text-muted">{active.length ? active.map((connection) => <p key={connection.id}>{titleCaseProvider(connection.provider)} · {connection.last_sync_at ? `Synced ${new Date(connection.last_sync_at).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" })}` : "Awaiting sync"}</p>) : <p>No apps connected.</p>}</div>
    </details>
  </section>;
}
