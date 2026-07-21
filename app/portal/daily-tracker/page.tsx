"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import CyclingStatusText from "@/components/ui/CyclingStatusText";
import type { WearableDailySummary } from "@/lib/wearable-insights";

type DailyMetric = {
  id: string;
  tracked_date: string;
  sleep_hours: number | null;
  water_liters: number | null;
  energy_level: number | null;
  stress_level: number | null;
  nutrition_score: number | null;
  training_completed: boolean;
  notes: string | null;
};

const today = new Date();
const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function scoreEntry(entry: {
  sleep_hours?: number | string | null;
  water_liters?: number | string | null;
  energy_level?: number | "" | null;
  stress_level?: number | "" | null;
  nutrition_score?: number | "" | null;
  training_completed?: boolean;
}) {
  const energy = entry.energy_level === "" || entry.energy_level === null || entry.energy_level === undefined
    ? null
    : Number(entry.energy_level);
  const stress = entry.stress_level === "" || entry.stress_level === null || entry.stress_level === undefined
    ? null
    : 11 - Number(entry.stress_level);
  const nutrition = entry.nutrition_score === "" || entry.nutrition_score === null || entry.nutrition_score === undefined
    ? null
    : Number(entry.nutrition_score);
  const parts = [
    entry.sleep_hours ? Math.min(10, Math.max(1, (Number(entry.sleep_hours) / 8) * 10)) : null,
    entry.water_liters ? Math.min(10, Math.max(1, (Number(entry.water_liters) / 3) * 10)) : null,
    energy,
    stress,
    nutrition,
    entry.training_completed ? 10 : null,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (parts.length === 0) return null;
  return Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

function ScaleSlider({ label, value, onChange, lowLabel, highLabel }: {
  label: string;
  value: number | "";
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  const sliderValue = value === "" ? 1 : value;
  const percentage = value === "" ? 0 : ((sliderValue - 1) / 9) * 100;

  return (
    <div className="app-inset rounded-2xl p-3 min-[360px]:p-4">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-text-primary">{label}</label>
        <output className="metric-num min-w-10 text-right text-xl font-bold text-accent-bright">{value || "—"}</output>
      </div>
      <input
        type="range"
        min="1"
        max="10"
        step="1"
        value={sliderValue}
        aria-label={`${label}, 1 to 10`}
        aria-valuetext={value ? `${value} out of 10` : "Not set"}
        onPointerDown={() => {
          if (value === "") onChange(1);
        }}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range-shift"
        style={{ "--range-pct": `${percentage}%` } as React.CSSProperties}
      />
      <div className="flex items-center justify-between text-[11px] font-medium text-text-muted">
        <span>1 · {lowLabel}</span>
        <span>10 · {highLabel}</span>
      </div>
    </div>
  );
}

function TrackerCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="app-card app-rise rounded-[28px] p-4 min-[360px]:p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="font-heading text-lg font-bold text-text-primary">{title}</h2>
        {hint && <p className="mt-1 text-sm text-text-secondary">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default function DailyTrackerPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wearableSummary, setWearableSummary] = useState<WearableDailySummary | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    tracked_date: todayKey,
    sleep_hours: "",
    water_liters: "",
    energy_level: "" as number | "",
    stress_level: "" as number | "",
    nutrition_score: "" as number | "",
    training_completed: false,
    notes: "",
  });

  const score = useMemo(() => scoreEntry(form), [form]);
  const sevenDayEntries = entries.slice(0, 7);
  const sevenDayScore = useMemo(() => {
    const scores = sevenDayEntries.map(scoreEntry).filter((value): value is number => value !== null);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  }, [sevenDayEntries]);

  const load = useCallback(async (selectedDate = todayKey) => {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/daily-tracker");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tracker");
      const nextEntries = (data.entries || []) as DailyMetric[];
      setEntries(nextEntries);
      setWearableSummary(data.wearableSummary || null);
      const selectedEntry = nextEntries.find((entry) => entry.tracked_date === selectedDate)
        || (selectedDate === todayKey ? data.today : null);
      if (selectedEntry) {
        setForm({
          tracked_date: selectedEntry.tracked_date,
          sleep_hours: selectedEntry.sleep_hours?.toString() || "",
          water_liters: selectedEntry.water_liters?.toString() || "",
          energy_level: selectedEntry.energy_level || "",
          stress_level: selectedEntry.stress_level || "",
          nutrition_score: selectedEntry.nutrition_score || "",
          training_completed: Boolean(selectedEntry.training_completed),
          notes: selectedEntry.notes || "",
        });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load tracker", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/daily-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save tracker");
      toast("Daily tracker saved");
      await load(form.tracked_date);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save daily tracker", "error");
    } finally {
      setSaving(false);
    }
  }

  function selectEntry(entry: DailyMetric) {
    setForm({
      tracked_date: entry.tracked_date,
      sleep_hours: entry.sleep_hours?.toString() || "",
      water_liters: entry.water_liters?.toString() || "",
      energy_level: entry.energy_level || "",
      stress_level: entry.stress_level || "",
      nutrition_score: entry.nutrition_score || "",
      training_completed: Boolean(entry.training_completed),
      notes: entry.notes || "",
    });
    window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function selectToday() {
    const entry = entries.find((item) => item.tracked_date === todayKey);
    if (entry) {
      selectEntry(entry);
      return;
    }
    setForm({
      tracked_date: todayKey,
      sleep_hours: "",
      water_liters: "",
      energy_level: "",
      stress_level: "",
      nutrition_score: "",
      training_completed: false,
      notes: "",
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-28 sm:pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/portal" className="mb-3 inline-flex text-sm font-semibold text-accent-bright no-underline">
            ← Back to dashboard
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-bright">Daily Tracker</p>
          <h1 className="mt-1 text-3xl font-heading font-bold text-text-primary">
            {form.tracked_date === todayKey ? "How today is going" : `Reviewing ${formatDate(form.tracked_date)}`}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Log the simple stuff Gordy cares about: sleep, water, stress, energy, nutrition and whether training got done.
          </p>
        </div>
        <div className="app-rise w-full rounded-2xl border border-[#E040D0]/25 bg-[linear-gradient(150deg,#251426_0%,#1a1320_55%,#140f18_100%)] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_-22px_rgba(0,0,0,0.85)] sm:w-auto">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#F060E0]">
            {form.tracked_date === todayKey ? "Today score" : "Entry score"}
          </div>
          <div className="mt-1 text-3xl font-heading font-bold text-white">{score ?? "—"}/10</div>
          <div className="mt-1 text-xs text-white/70">7-day average: {sevenDayScore ?? "—"}/10</div>
        </div>
      </div>

      {wearableSummary && (
        <TrackerCard title="Synced from connected apps" hint="This is separate from your manual daily tracker entry.">
          <div className="grid gap-3 sm:grid-cols-4">
            <SyncedMetric
              label="Readiness"
              value={wearableSummary.readiness_score !== null ? `${wearableSummary.readiness_score}/100` : "—"}
            />
            <SyncedMetric
              label="Sleep"
              value={wearableSummary.sleep_minutes ? `${Math.floor(wearableSummary.sleep_minutes / 60)}h ${wearableSummary.sleep_minutes % 60}m` : "—"}
            />
            <SyncedMetric
              label="Steps"
              value={wearableSummary.steps ? wearableSummary.steps.toLocaleString("en-GB") : "—"}
            />
            <SyncedMetric
              label="Protein"
              value={wearableSummary.protein_g ? `${Math.round(wearableSummary.protein_g)}g` : "—"}
            />
          </div>
          {wearableSummary.insight && (
            <p className="mt-4 rounded-2xl border border-[#E040D0]/15 bg-[#E040D0]/5 px-4 py-3 text-sm leading-relaxed text-text-secondary">
              {wearableSummary.insight}
            </p>
          )}
        </TrackerCard>
      )}

      <div ref={formRef} className="scroll-mt-4">
      <TrackerCard
        title={form.tracked_date === todayKey ? "Today's basics" : formatDate(form.tracked_date)}
        hint={form.tracked_date === todayKey ? "The quick numbers first." : "Viewing a previous entry. Any changes will update this date."}
      >
        <div className="space-y-4">
          {form.tracked_date !== todayKey && (
            <button type="button" onClick={selectToday} className="text-sm font-semibold text-accent-bright">
              Back to today
            </button>
          )}
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-text-primary">Date</span>
            <input
              type="date"
              value={form.tracked_date}
              onChange={(e) => setForm((prev) => ({ ...prev, tracked_date: e.target.value }))}
              className="w-full min-w-0 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-base text-text-primary outline-none focus:border-accent/50 sm:text-sm"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-text-primary">Sleep hours</span>
              <input
                inputMode="decimal"
                value={form.sleep_hours}
                onChange={(e) => setForm((prev) => ({ ...prev, sleep_hours: e.target.value }))}
                placeholder="e.g. 7.5"
                className="w-full rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-text-primary">Water litres</span>
              <input
                inputMode="decimal"
                value={form.water_liters}
                onChange={(e) => setForm((prev) => ({ ...prev, water_liters: e.target.value }))}
                placeholder="e.g. 2.5"
                className="w-full rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
              />
            </label>
          </div>
        </div>
      </TrackerCard>
      </div>

      <TrackerCard title="How you're feeling" hint="Slide each rating from 1 to 10.">
        <div className="space-y-4">
          <ScaleSlider label="Energy" value={form.energy_level} lowLabel="Flat" highLabel="Excellent" onChange={(value) => setForm((prev) => ({ ...prev, energy_level: value }))} />
          <ScaleSlider label="Stress" value={form.stress_level} lowLabel="Calm" highLabel="Overloaded" onChange={(value) => setForm((prev) => ({ ...prev, stress_level: value }))} />
          <ScaleSlider label="Nutrition" value={form.nutrition_score} lowLabel="Off track" highLabel="On point" onChange={(value) => setForm((prev) => ({ ...prev, nutrition_score: value }))} />
        </div>
      </TrackerCard>

      <TrackerCard title="Training">
        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, training_completed: !prev.training_completed }))}
          className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
            form.training_completed
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              : "border-[rgba(0,0,0,0.08)] bg-bg-primary text-text-primary"
          }`}
        >
          <span className="block text-sm font-semibold">{form.training_completed ? "Training done today" : "Training not logged today"}</span>
          <span className="mt-1 block text-xs text-text-secondary">Tap to toggle. This is separate from detailed session logging.</span>
        </button>
      </TrackerCard>

      <TrackerCard title="Notes">
        <textarea
          rows={4}
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          placeholder="Anything that explains the numbers?"
          className="w-full resize-none rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
        />
      </TrackerCard>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full rounded-2xl gradient-accent px-5 py-4 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
      >
        <CyclingStatusText active={saving} idle="Save daily tracker" messages={["Saving...", "Updating today...", "Checking streak...", "Nearly there..."]} />
      </button>

      <section className="app-card rounded-[28px] p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-bold text-text-primary">Recent days</h2>
            <p className="text-sm text-text-secondary">Quick read on consistency, not a judgment score.</p>
          </div>
        </div>
        {loading ? (
          <div className="text-sm text-text-muted">Loading tracker…</div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[rgba(0,0,0,0.10)] p-5 text-sm text-text-secondary">
            No daily entries yet. Log today and this summary will start filling in.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.slice(0, 7).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => selectEntry(entry)}
                aria-current={entry.tracked_date === form.tracked_date ? "date" : undefined}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  entry.tracked_date === form.tracked_date
                    ? "border-accent/40 bg-accent/10"
                    : "border-[rgba(0,0,0,0.06)] bg-bg-primary hover:border-accent/25"
                }`}
              >
                <div>
                  <div className="text-sm font-semibold text-text-primary">{formatDate(entry.tracked_date)}</div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {entry.sleep_hours ?? "—"}h sleep · {entry.water_liters ?? "—"}L water · energy {entry.energy_level ?? "—"}/10
                  </div>
                </div>
                <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-sm font-semibold text-accent-bright">
                  {scoreEntry(entry) ?? "—"}/10
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SyncedMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</div>
      <div className="mt-1 text-lg font-heading font-bold text-text-primary">{value}</div>
    </div>
  );
}
