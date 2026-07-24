"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  GUARANTEE_METRIC_KEYS,
  GUARANTEE_METRIC_LABELS,
  type GuaranteeSettings,
} from "@/lib/founder-compliance";

type GuaranteeResponse = {
  settings: GuaranteeSettings;
  configured: boolean;
};

export default function GuaranteeSettingsPanel() {
  const { toast } = useToast();
  const [data, setData] = useState<GuaranteeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [metricKey, setMetricKey] = useState("");
  const [comparison, setComparison] = useState("");
  const [thresholdType, setThresholdType] = useState("");
  const [thresholdValue, setThresholdValue] = useState("");
  const [remedyText, setRemedyText] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/guarantee-settings");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Guarantee settings could not be loaded");
      setData(payload);
      setMetricKey(payload.settings.metric_key || "");
      setComparison(payload.settings.comparison || "");
      setThresholdType(payload.settings.threshold_type || "");
      setThresholdValue(payload.settings.threshold_value === null ? "" : String(payload.settings.threshold_value));
      setRemedyText(payload.settings.remedy_text || "");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Guarantee settings could not be loaded", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/guarantee-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metric_key: metricKey || null,
          comparison: comparison || null,
          threshold_type: thresholdType || null,
          threshold_value: thresholdValue || null,
          remedy_text: remedyText || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Guarantee settings could not be saved");
      setData(payload);
      toast("Guarantee settings saved");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Guarantee settings could not be saved", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="mb-6 h-32 animate-pulse rounded-2xl bg-bg-card" />;
  }
  if (!data) {
    return (
      <section className="mb-6 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-card p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E040D0]">Founder programme</div>
        <p className="mt-1 text-sm text-text-secondary">Guarantee settings could not be loaded.</p>
        <button
          type="button"
          onClick={() => { setLoading(true); void load(); }}
          className="mt-3 rounded-xl border border-[rgba(0,0,0,0.10)] bg-bg-primary px-4 py-2.5 text-xs font-semibold text-text-secondary"
        >
          Try again
        </button>
      </section>
    );
  }

  const inputClass = "mt-1.5 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 py-2.5 text-sm text-text-primary";

  return (
    <section className="mb-6 rounded-2xl border border-[#E040D0]/18 bg-bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E040D0]">Founder programme</div>
          <h2 className="mt-1 font-heading text-lg font-bold text-text-primary">Month 4 guarantee</h2>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            The measurable Month 4 result that satisfies the guarantee. Until every field is set, nothing is evaluated
            and nothing is shown to clients - there are no default thresholds.
          </p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
          data.configured
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
            : "border-amber-500/25 bg-amber-500/10 text-amber-500"
        }`}>
          {data.configured ? "Configured" : "Not configured"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-text-secondary">
          Metric
          <select value={metricKey} onChange={(event) => setMetricKey(event.target.value)} className={inputClass}>
            <option value="">Not set</option>
            {GUARANTEE_METRIC_KEYS.map((key) => (
              <option key={key} value={key}>
                {GUARANTEE_METRIC_LABELS[key].label}
                {GUARANTEE_METRIC_LABELS[key].unit ? ` (${GUARANTEE_METRIC_LABELS[key].unit})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Direction
          <select value={comparison} onChange={(event) => setComparison(event.target.value)} className={inputClass}>
            <option value="">Not set</option>
            <option value="increase_at_least">Increase by at least</option>
            <option value="decrease_at_least">Decrease by at least</option>
          </select>
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Threshold type
          <select value={thresholdType} onChange={(event) => setThresholdType(event.target.value)} className={inputClass}>
            <option value="">Not set</option>
            <option value="absolute">Absolute change</option>
            <option value="percent">Percent change</option>
          </select>
        </label>
        <label className="text-xs font-medium text-text-secondary">
          Threshold value
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={thresholdValue}
            onChange={(event) => setThresholdValue(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <label className="mt-3 block text-xs font-medium text-text-secondary">
        Remedy if the condition is not met (optional)
        <textarea value={remedyText} onChange={(event) => setRemedyText(event.target.value)} rows={2} maxLength={1000} className={inputClass} />
      </label>
      <div className="mt-4">
        <button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-[#E040D0] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
          {saving ? "Saving..." : "Save guarantee settings"}
        </button>
      </div>
    </section>
  );
}
