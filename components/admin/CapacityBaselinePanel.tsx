"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { CapacityBaseline, CapacityMetrics } from "@/lib/capacity-baseline";

type MetricComparison = {
  baseline: number | null;
  current: number | null;
  delta: number | null;
  direction: "improved" | "declined" | "unchanged" | "missing";
};

type BaselineResponse = {
  baseline: CapacityBaseline | null;
  current: {
    period_start: string;
    period_end: string;
    metrics: CapacityMetrics;
    wearableSourceDays: number;
  };
  comparison: Record<keyof CapacityMetrics, MetricComparison> | null;
  suggested: {
    period_start: string;
    period_end: string;
    metrics: CapacityMetrics;
    wearableSourceDays: number;
    latestBodyMeasurementDate: string | null;
  };
};

const fields: Array<{
  key: keyof CapacityMetrics;
  label: string;
  unit: string;
}> = [
  { key: "hrv_ms", label: "HRV", unit: "ms" },
  { key: "resting_hr_bpm", label: "Resting HR", unit: "bpm" },
  { key: "sleep_minutes", label: "Sleep", unit: "min" },
  { key: "sleep_score", label: "Sleep score", unit: "" },
  { key: "weight_kg", label: "Weight", unit: "kg" },
  { key: "body_fat_percentage", label: "Body fat", unit: "%" },
  { key: "waist_cm", label: "Waist", unit: "cm" },
];

function display(value: number | null, unit: string) {
  return value === null ? "—" : `${Math.round(value * 10) / 10}${unit ? ` ${unit}` : ""}`;
}

export default function CapacityBaselinePanel({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<BaselineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [waist, setWaist] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/client-baseline?client_id=${clientId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Baseline could not be loaded");
      setData(payload);
      const source = payload.baseline || payload.suggested;
      setPeriodStart(source.period_start);
      setPeriodEnd(source.period_end);
      setWeight(source.weight_kg === null || source.weight_kg === undefined ? "" : String(source.weight_kg));
      setBodyFat(source.body_fat_percentage === null || source.body_fat_percentage === undefined ? "" : String(source.body_fat_percentage));
      setWaist(source.waist_cm === null || source.waist_cm === undefined ? "" : String(source.waist_cm));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Baseline could not be loaded", "error");
    } finally {
      setLoading(false);
    }
  }, [clientId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDraft() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/client-baseline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          period_start: periodStart,
          period_end: periodEnd,
          weight_kg: weight,
          body_fat_percentage: bodyFat,
          waist_cm: waist,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Baseline could not be saved");
      toast("Baseline draft saved");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Baseline could not be saved", "error");
    } finally {
      setSaving(false);
    }
  }

  async function lockBaseline() {
    if (!window.confirm("Lock this Month 1 baseline? Once locked, it cannot be silently edited.")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/client-baseline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Baseline could not be locked");
      toast("Month 1 baseline locked");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Baseline could not be locked", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="mb-6 h-44 animate-pulse rounded-2xl bg-bg-card" />;
  }
  if (!data) return null;

  const baseline = data.baseline;
  const locked = baseline?.status === "locked";
  const suggested = data.suggested;
  const displayedMetrics: CapacityMetrics = baseline || suggested.metrics;
  const displayedSourceDays = baseline?.wearable_source_days ?? suggested.wearableSourceDays;
  const draftHasUnsavedChanges = baseline?.status === "draft" && (
    periodStart !== baseline.period_start
    || periodEnd !== baseline.period_end
    || weight !== (baseline.weight_kg === null ? "" : String(baseline.weight_kg))
    || bodyFat !== (baseline.body_fat_percentage === null ? "" : String(baseline.body_fat_percentage))
    || waist !== (baseline.waist_cm === null ? "" : String(baseline.waist_cm))
  );

  return (
    <section className="mb-6 rounded-2xl border border-[#E040D0]/18 bg-bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E040D0]">Month 1 reference</div>
          <h2 className="mt-1 font-heading text-lg font-bold text-text-primary">Capacity baseline</h2>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Wearable averages come from the selected window. Body composition can be entered manually before the reference is locked.
          </p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
          locked
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
            : "border-amber-500/25 bg-amber-500/10 text-amber-500"
        }`}>
          {locked ? "Locked" : baseline ? "Draft" : "Not captured"}
        </span>
      </div>

      {locked && baseline && data.comparison ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {fields.slice(0, 4).map((field) => {
              const comparison = data.comparison?.[field.key];
              return (
                <div key={field.key} className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-3 py-3">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">{field.label}</div>
                  <div className="mt-1 text-sm font-bold text-text-primary">
                    {display(comparison?.current ?? null, field.unit)}
                  </div>
                  <div className={`mt-1 text-[10px] ${
                    comparison?.direction === "improved"
                      ? "text-emerald-400"
                      : comparison?.direction === "declined"
                        ? "text-amber-500"
                        : "text-text-muted"
                  }`}>
                    {comparison?.delta === null || comparison?.delta === undefined
                      ? "No comparison yet"
                      : `${comparison.delta > 0 ? "+" : ""}${comparison.delta} from baseline`}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-text-muted">
            Baseline {baseline.period_start} to {baseline.period_end} · Current view {data.current.period_start} to {data.current.period_end}. Direction is shown without applying guarantee thresholds.
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-text-secondary">
              Baseline start
              <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 py-2.5 text-sm text-text-primary" />
            </label>
            <label className="text-xs font-medium text-text-secondary">
              Baseline end
              <input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 py-2.5 text-sm text-text-primary" />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {fields.slice(0, 4).map((field) => (
              <div key={field.key} className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-3 py-3">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">{field.label}</div>
                <div className="mt-1 text-sm font-bold text-text-primary">{display(displayedMetrics[field.key], field.unit)}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            {displayedSourceDays > 0
              ? `${displayedSourceDays} wearable day${displayedSourceDays === 1 ? "" : "s"} in this saved window.`
              : "No wearable days are available in this window yet."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Weight (kg)", value: weight, setter: setWeight },
              { label: "Body fat (%)", value: bodyFat, setter: setBodyFat },
              { label: "Waist (cm)", value: waist, setter: setWaist },
            ].map((field) => (
              <label key={field.label} className="text-xs font-medium text-text-secondary">
                {field.label}
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={field.value}
                  onChange={(event) => field.setter(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 py-2.5 text-sm text-text-primary"
                />
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void saveDraft()} disabled={saving} className="rounded-xl bg-[#E040D0] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
              {saving ? "Saving..." : "Save draft"}
            </button>
            {baseline?.status === "draft" && (
              <button type="button" onClick={() => void lockBaseline()} disabled={saving || draftHasUnsavedChanges} className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-2.5 text-xs font-semibold text-amber-500 disabled:opacity-50">
                Lock baseline
              </button>
            )}
          </div>
          {draftHasUnsavedChanges && (
            <p className="mt-2 text-[11px] text-amber-500">
              Save the draft to refresh its stored values before locking it.
            </p>
          )}
        </>
      )}
    </section>
  );
}
