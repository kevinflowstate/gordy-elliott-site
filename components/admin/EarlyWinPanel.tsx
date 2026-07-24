"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  EARLY_WIN_SOURCED_METRICS,
  type EarlyWin,
  type EarlyWinMetricKey,
  type EarlyWinView,
} from "@/lib/early-win";

type EarlyWinResponse = {
  active: EarlyWinView | null;
  completed: EarlyWin[];
};

const metricOptions: Array<{ key: EarlyWinMetricKey; label: string }> = [
  ...(Object.entries(EARLY_WIN_SOURCED_METRICS) as Array<[Exclude<EarlyWinMetricKey, "manual">, (typeof EARLY_WIN_SOURCED_METRICS)[Exclude<EarlyWinMetricKey, "manual">]]>).map(
    ([key, metric]) => ({
      key: key as EarlyWinMetricKey,
      label: `${metric.label} (${metric.unit}) - ${metric.source === "wearable" ? "wearable" : "body measurements"}`,
    }),
  ),
  { key: "manual", label: "Manual metric - Gordy logs the values" },
];

function longDate(dateKey: string) {
  const parsed = new Date(`${dateKey.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatValue(value: number, unit: string) {
  return `${Math.round(value * 10) / 10} ${unit}`;
}

export default function EarlyWinPanel({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<EarlyWinResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [metricKey, setMetricKey] = useState<EarlyWinMetricKey>("hrv_ms");
  const [manualLabel, setManualLabel] = useState("");
  const [manualUnit, setManualUnit] = useState("");
  const [startingValue, setStartingValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [coachingNote, setCoachingNote] = useState("");

  const [logValue, setLogValue] = useState("");
  const [logDate, setLogDate] = useState("");
  const [reviewOutcome, setReviewOutcome] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/client-early-win?client_id=${clientId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Early win could not be loaded");
      setData(payload);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Early win could not be loaded", "error");
    } finally {
      setLoading(false);
    }
  }, [clientId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createEarlyWin() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/client-early-win", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          metric_key: metricKey,
          display_label: metricKey === "manual" ? manualLabel : undefined,
          unit: metricKey === "manual" ? manualUnit : undefined,
          starting_value: startingValue,
          target_value: targetValue,
          start_date: startDate,
          coaching_note: coachingNote,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Early win could not be created");
      toast("Early win created");
      setManualLabel("");
      setManualUnit("");
      setStartingValue("");
      setTargetValue("");
      setStartDate("");
      setCoachingNote("");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Early win could not be created", "error");
    } finally {
      setSaving(false);
    }
  }

  async function logManualValue(earlyWinId: string) {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/client-early-win", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "log_value", early_win_id: earlyWinId, value: logValue, entry_date: logDate }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Value could not be logged");
      toast("Value logged");
      setLogValue("");
      setLogDate("");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Value could not be logged", "error");
    } finally {
      setSaving(false);
    }
  }

  async function completeReview(earlyWinId: string) {
    if (!window.confirm("Complete the 14-day review? The client card retires and this early win moves to the record.")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/client-early-win", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_review", early_win_id: earlyWinId, review_outcome: reviewOutcome }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Review could not be completed");
      toast("Early win review completed");
      setReviewOutcome("");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Review could not be completed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeActive(earlyWinId: string) {
    if (!window.confirm("Remove this early win? Use this only if it was set up by mistake.")) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/client-early-win?early_win_id=${earlyWinId}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Early win could not be removed");
      toast("Early win removed");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Early win could not be removed", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="mb-6 h-44 animate-pulse rounded-2xl bg-bg-card" />;
  }
  if (!data) return null;

  const active = data.active;
  const inputClass = "mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 py-2.5 text-sm text-text-primary";

  return (
    <section className="mb-6 rounded-2xl border border-[#E040D0]/18 bg-bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E040D0]">Fourteen-day early win</div>
          <h2 className="mt-1 font-heading text-lg font-bold text-text-primary">Priority metric</h2>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            One metric chosen after the Capacity X-Ray. The client sees it front and centre for the first fourteen days; the review at day fourteen retires the card and keeps the record here.
          </p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
          active
            ? active.reviewDue
              ? "border-amber-500/25 bg-amber-500/10 text-amber-500"
              : "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
            : "border-[rgba(0,0,0,0.10)] bg-bg-primary text-text-muted"
        }`}>
          {active ? (active.reviewDue ? "Review due" : "Active") : "Not set"}
        </span>
      </div>

      {active ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-3 py-3">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">Metric</div>
              <div className="mt-1 text-sm font-bold text-text-primary">{active.earlyWin.display_label}</div>
              <div className="mt-1 text-[10px] text-text-muted">
                {active.earlyWin.source === "manual" ? "Manual entries" : active.earlyWin.source === "wearable" ? "Wearable data" : "Body measurements"}
              </div>
            </div>
            <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-3 py-3">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">Window</div>
              <div className="mt-1 text-sm font-bold text-text-primary">
                {active.dayNumber <= 0 ? `Begins ${longDate(active.earlyWin.start_date)}` : `Day ${Math.min(active.dayNumber, active.windowDays)} of ${active.windowDays}`}
              </div>
              <div className="mt-1 text-[10px] text-text-muted">Started {longDate(active.earlyWin.start_date)}</div>
            </div>
            <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-3 py-3">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">Latest reading</div>
              <div className={`mt-1 text-sm font-bold ${active.reading.stale ? "text-amber-500" : "text-text-primary"}`}>
                {active.reading.value === null ? "No reading yet" : formatValue(active.reading.value, active.earlyWin.unit)}
              </div>
              <div className="mt-1 text-[10px] text-text-muted">
                {active.reading.value === null
                  ? "Nothing recorded since the start date"
                  : active.reading.stale
                    ? `No reading in the last ${active.reading.daysSince} days`
                    : active.reading.date
                      ? longDate(active.reading.date)
                      : ""}
              </div>
            </div>
            <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-3 py-3">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">Start to target</div>
              <div className="mt-1 text-sm font-bold text-text-primary">
                {formatValue(active.earlyWin.starting_value, active.earlyWin.unit)} to {formatValue(active.earlyWin.target_value, active.earlyWin.unit)}
              </div>
              <div className="mt-1 text-[10px] text-text-muted">
                {active.progress
                  ? active.progress.progressPercent === null
                    ? "Hold-steady target"
                    : active.progress.achieved
                      ? "Target reached"
                      : `${active.progress.progressPercent}% of the way there`
                  : "No comparison until a reading arrives"}
              </div>
            </div>
          </div>

          {active.earlyWin.coaching_note && (
            <p className="mt-3 text-xs text-text-secondary">Client-facing note: {active.earlyWin.coaching_note}</p>
          )}

          {active.earlyWin.source === "manual" && (
            <div className="mt-4 rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Log a value</div>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-text-secondary">
                  Value ({active.earlyWin.unit})
                  <input type="number" inputMode="decimal" step="0.1" value={logValue} onChange={(event) => setLogValue(event.target.value)} className={inputClass} />
                </label>
                <label className="text-xs font-medium text-text-secondary">
                  Date (defaults to today)
                  <input type="date" value={logDate} onChange={(event) => setLogDate(event.target.value)} className={inputClass} />
                </label>
                <div className="flex items-end">
                  <button type="button" onClick={() => void logManualValue(active.earlyWin.id)} disabled={saving || !logValue} className="rounded-xl bg-[#E040D0] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
                    {saving ? "Saving..." : "Log value"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={`mt-4 rounded-xl border px-4 py-3 ${active.reviewDue ? "border-amber-500/30 bg-amber-500/8" : "border-[rgba(0,0,0,0.06)] bg-bg-primary"}`}>
            <div className={`text-[10px] font-semibold uppercase tracking-wider ${active.reviewDue ? "text-amber-500" : "text-text-muted"}`}>
              {active.reviewDue ? "Fourteen-day review due" : "Fourteen-day review"}
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {active.reviewDue
                ? "The window is complete. Record the outcome and complete the review - the client card retires and the win stays on record here."
                : `The review opens on day ${active.windowDays}. Completing it early is possible but retires the client card immediately.`}
            </p>
            <label className="mt-3 block text-xs font-medium text-text-secondary">
              Outcome note
              <textarea value={reviewOutcome} onChange={(event) => setReviewOutcome(event.target.value)} rows={2} maxLength={1000} className={inputClass} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void completeReview(active.earlyWin.id)} disabled={saving || !reviewOutcome.trim()} className="rounded-xl bg-[#E040D0] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
                {saving ? "Saving..." : "Complete review"}
              </button>
              <button type="button" onClick={() => void removeActive(active.earlyWin.id)} disabled={saving} className="rounded-xl border border-[rgba(0,0,0,0.10)] bg-bg-card px-4 py-2.5 text-xs font-semibold text-text-secondary disabled:opacity-50">
                Remove (set up by mistake)
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-text-secondary">
              Metric
              <select value={metricKey} onChange={(event) => setMetricKey(event.target.value as EarlyWinMetricKey)} className={inputClass}>
                {metricOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-text-secondary">
              Start date (defaults to today)
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
            </label>
          </div>
          {metricKey === "manual" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-text-secondary">
                Label shown to the client
                <input type="text" value={manualLabel} onChange={(event) => setManualLabel(event.target.value)} maxLength={80} placeholder="e.g. Morning walks per week" className={inputClass} />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                Unit
                <input type="text" value={manualUnit} onChange={(event) => setManualUnit(event.target.value)} maxLength={20} placeholder="e.g. walks" className={inputClass} />
              </label>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-text-secondary">
              Starting value
              <input type="number" inputMode="decimal" step="0.1" value={startingValue} onChange={(event) => setStartingValue(event.target.value)} className={inputClass} />
            </label>
            <label className="text-xs font-medium text-text-secondary">
              Target for day fourteen
              <input type="number" inputMode="decimal" step="0.1" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} className={inputClass} />
            </label>
          </div>
          <label className="mt-3 block text-xs font-medium text-text-secondary">
            Coaching note shown on the client card (optional)
            <textarea value={coachingNote} onChange={(event) => setCoachingNote(event.target.value)} rows={2} maxLength={500} className={inputClass} />
          </label>
          <div className="mt-4">
            <button type="button" onClick={() => void createEarlyWin()} disabled={saving || !startingValue || !targetValue} className="rounded-xl bg-[#E040D0] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
              {saving ? "Creating..." : "Create early win"}
            </button>
          </div>
        </div>
      )}

      {data.completed.length > 0 && (
        <div className="mt-5 border-t border-[rgba(0,0,0,0.06)] pt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Completed early wins</div>
          <div className="mt-2 space-y-2">
            {data.completed.map((win) => (
              <div key={win.id} className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-sm font-bold text-text-primary">{win.display_label}</div>
                  <div className="text-[10px] text-text-muted">
                    Started {longDate(win.start_date)}{win.reviewed_at ? ` - reviewed ${longDate(win.reviewed_at)}` : ""}
                  </div>
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  {formatValue(win.starting_value, win.unit)} to a target of {formatValue(win.target_value, win.unit)}
                </div>
                {win.review_outcome && <p className="mt-1 text-xs text-text-secondary">Outcome: {win.review_outcome}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
