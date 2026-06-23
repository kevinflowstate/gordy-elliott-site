"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import CyclingStatusText from "@/components/ui/CyclingStatusText";

type CycleSettings = {
  last_period_start: string | null;
  average_cycle_length: number;
  average_period_length: number;
};

type CycleEntry = {
  id?: string;
  tracked_date: string;
  flow: "none" | "spotting" | "light" | "medium" | "heavy";
  symptoms: string[];
  pain_level: number | null;
  energy_level: number | null;
  training_impact: "none" | "scaled" | "skipped";
  unusual_symptoms: boolean;
  notes: string | null;
};

type CyclePrompt = {
  eyebrow: string;
  tone: "neutral" | "go" | "steady";
  text: string;
};

type CycleResponse = {
  eligible: boolean;
  todayKey?: string;
  settings?: CycleSettings | null;
  entries?: CycleEntry[];
  phaseInfo?: { label: string; day: number } | null;
  prompt?: CyclePrompt | null;
};

const flowOptions: Array<{ value: CycleEntry["flow"]; label: string }> = [
  { value: "none", label: "None" },
  { value: "spotting", label: "Spotting" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
];

const symptomOptions = ["Cramps", "Headache", "Bloating", "Back pain", "Fatigue", "Cravings", "Mood shift", "Poor sleep"];

const toneClass: Record<CyclePrompt["tone"], string> = {
  neutral: "border-text-muted/40 bg-text-muted/10 text-text-secondary",
  go: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  steady: "border-red-500/30 bg-red-500/10 text-red-400",
};

const today = new Date();
const fallbackTodayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function defaultSettings(): CycleSettings {
  return { last_period_start: null, average_cycle_length: 28, average_period_length: 5 };
}

function defaultEntry(date: string): CycleEntry {
  return {
    tracked_date: date,
    flow: "none",
    symptoms: [],
    pain_level: null,
    energy_level: null,
    training_impact: "none",
    unusual_symptoms: false,
    notes: null,
  };
}

function ScalePills({ label, value, onChange, min = 0 }: { label: string; value: number | null; onChange: (value: number) => void; min?: 0 | 1 }) {
  const values = Array.from({ length: 11 - min }, (_, index) => index + min);
  return (
    <div className="app-inset rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-text-primary">{label}</label>
        <span className="text-xs font-semibold text-text-muted">{value ?? `Tap ${min}-10`}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {values.map((num) => {
          const active = value === num;
          return (
            <button
              key={num}
              type="button"
              onClick={() => onChange(num)}
              className={`app-tap h-10 min-w-10 rounded-full border text-sm font-semibold transition-all ${
                active
                  ? "border-[#F060E0] bg-[#E040D0] text-white shadow-[0_4px_14px_rgba(224,64,208,0.4)]"
                  : "border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] text-text-secondary"
              }`}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CyclePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eligible, setEligible] = useState(true);
  const [settings, setSettings] = useState<CycleSettings>(defaultSettings);
  const [entry, setEntry] = useState<CycleEntry>(defaultEntry(fallbackTodayKey));
  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [phaseInfo, setPhaseInfo] = useState<CycleResponse["phaseInfo"]>(null);
  const [prompt, setPrompt] = useState<CyclePrompt | null>(null);

  const hasBaseline = Boolean(settings.last_period_start);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/cycle");
      const data = (await res.json()) as CycleResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load cycle tracker");
      setEligible(data.eligible);
      if (!data.eligible) return;

      const todayKey = data.todayKey || fallbackTodayKey;
      const loadedSettings = data.settings || defaultSettings();
      const todayEntry = (data.entries || []).find((item) => item.tracked_date === todayKey) || defaultEntry(todayKey);

      setSettings(loadedSettings);
      setEntries(data.entries || []);
      setEntry(todayEntry);
      setPhaseInfo(data.phaseInfo || null);
      setPrompt(data.prompt || null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load cycle tracker", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(payload: { settings?: CycleSettings; entry?: CycleEntry }, successMessage: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save cycle tracker");
      toast(successMessage);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save cycle tracker", "error");
    } finally {
      setSaving(false);
    }
  }

  const recentEntries = useMemo(() => entries.slice(0, 10), [entries]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 pb-28 sm:pb-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-[rgba(0,0,0,0.08)]" />
        <div className="h-48 animate-pulse rounded-[28px] bg-[rgba(0,0,0,0.08)]" />
        <div className="h-64 animate-pulse rounded-[28px] bg-[rgba(0,0,0,0.08)]" />
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="mx-auto w-full max-w-2xl pb-28 sm:pb-8">
        <Link href="/portal/settings" className="mb-4 inline-flex text-sm font-semibold text-accent-bright no-underline">
          Open settings
        </Link>
        <section className="app-card rounded-[28px] p-6">
          <h1 className="font-heading text-2xl font-bold text-text-primary">Cycle tracking is off</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Add sex as female and switch on cycle tracking in settings to use this screen.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-28 sm:pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/portal" className="mb-3 inline-flex text-sm font-semibold text-accent-bright no-underline">
            Back to dashboard
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-bright">Cycle Tracker</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-text-primary">Train to today</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Log the basics, spot patterns, and keep the training decision honest.
          </p>
        </div>
        <div className="app-rise w-full rounded-2xl border border-[#E040D0]/25 bg-[linear-gradient(150deg,#251426_0%,#1a1320_55%,#140f18_100%)] px-5 py-4 sm:w-auto">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#F060E0]">Current phase</div>
          <div className="mt-1 font-heading text-2xl font-bold text-white">{phaseInfo?.label || "Not enough data"}</div>
          <div className="mt-1 text-xs text-white/70">{phaseInfo ? `Cycle day ${phaseInfo.day}` : "Add your last period start."}</div>
        </div>
      </div>

      {prompt && (
        <section className={`rounded-[24px] border p-5 ${toneClass[prompt.tone]}`}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">{prompt.eyebrow}</div>
          <p className="mt-2 text-sm leading-relaxed text-text-primary">{prompt.text}</p>
        </section>
      )}

      <section className="app-card rounded-[28px] p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="font-heading text-lg font-bold text-text-primary">Cycle setup</h2>
          <p className="mt-1 text-sm text-text-secondary">These settings drive phase estimates. They can be edited any time.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-text-primary">Last period start</span>
            <input
              type="date"
              value={settings.last_period_start || ""}
              onChange={(e) => setSettings((prev) => ({ ...prev, last_period_start: e.target.value || null }))}
              className="w-full rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-base text-text-primary outline-none focus:border-accent/50 sm:text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-text-primary">Cycle length</span>
            <input
              inputMode="numeric"
              value={settings.average_cycle_length}
              onChange={(e) => setSettings((prev) => ({ ...prev, average_cycle_length: Number(e.target.value) || 28 }))}
              className="w-full rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-text-primary outline-none focus:border-accent/50"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-text-primary">Period length</span>
            <input
              inputMode="numeric"
              value={settings.average_period_length}
              onChange={(e) => setSettings((prev) => ({ ...prev, average_period_length: Number(e.target.value) || 5 }))}
              className="w-full rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-text-primary outline-none focus:border-accent/50"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => save({ settings }, "Cycle setup saved")}
          disabled={saving || !hasBaseline}
          className="mt-4 rounded-2xl gradient-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Save setup
        </button>
      </section>

      <section className="app-card rounded-[28px] p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="font-heading text-lg font-bold text-text-primary">Today&apos;s log</h2>
          <p className="mt-1 text-sm text-text-secondary">Symptoms are context. The aim is better training decisions, not perfect tracking.</p>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-text-primary">Date</span>
            <input
              type="date"
              value={entry.tracked_date}
              onChange={(e) => setEntry((prev) => ({ ...prev, tracked_date: e.target.value }))}
              className="w-full rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-base text-text-primary outline-none focus:border-accent/50 sm:text-sm"
            />
          </label>

          <div>
            <div className="mb-2 text-sm font-semibold text-text-primary">Flow</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {flowOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setEntry((prev) => ({ ...prev, flow: option.value }))}
                  className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors ${
                    entry.flow === option.value
                      ? "border-[#F060E0] bg-[#E040D0]/15 text-accent-bright"
                      : "border-[rgba(0,0,0,0.08)] bg-bg-primary text-text-secondary"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-text-primary">Symptoms</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {symptomOptions.map((symptom) => {
                const active = entry.symptoms.includes(symptom);
                return (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => setEntry((prev) => ({
                      ...prev,
                      symptoms: active ? prev.symptoms.filter((item) => item !== symptom) : [...prev.symptoms, symptom],
                    }))}
                    className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors ${
                      active
                        ? "border-[#F060E0] bg-[#E040D0]/15 text-accent-bright"
                        : "border-[rgba(0,0,0,0.08)] bg-bg-primary text-text-secondary"
                    }`}
                  >
                    {symptom}
                  </button>
                );
              })}
            </div>
          </div>

          <ScalePills label="Pain" value={entry.pain_level} onChange={(value) => setEntry((prev) => ({ ...prev, pain_level: value }))} />
          <ScalePills label="Cycle energy" value={entry.energy_level} min={1} onChange={(value) => setEntry((prev) => ({ ...prev, energy_level: value }))} />

          <div>
            <div className="mb-2 text-sm font-semibold text-text-primary">Training impact</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { value: "none", label: "No change" },
                { value: "scaled", label: "Scaled" },
                { value: "skipped", label: "Skipped" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setEntry((prev) => ({ ...prev, training_impact: option.value as CycleEntry["training_impact"] }))}
                  className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition-colors ${
                    entry.training_impact === option.value
                      ? "border-[#F060E0] bg-[#E040D0]/15 text-accent-bright"
                      : "border-[rgba(0,0,0,0.08)] bg-bg-primary text-text-secondary"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEntry((prev) => ({ ...prev, unusual_symptoms: !prev.unusual_symptoms }))}
            className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
              entry.unusual_symptoms
                ? "border-red-500/30 bg-red-500/10"
                : "border-[rgba(0,0,0,0.08)] bg-bg-primary"
            }`}
          >
            <span className="block text-sm font-semibold text-text-primary">Severe or out-of-the-ordinary symptoms</span>
            <span className="mt-1 block text-xs text-text-secondary">This triggers Gordy&apos;s GP safety note.</span>
          </button>

          <textarea
            rows={4}
            value={entry.notes || ""}
            onChange={(e) => setEntry((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Anything worth noting?"
            className="w-full resize-none rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
          />
        </div>

        <button
          type="button"
          onClick={() => save({ entry }, "Cycle log saved")}
          disabled={saving}
          className="mt-5 w-full rounded-2xl gradient-accent px-5 py-4 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
        >
          <CyclingStatusText active={saving} idle="Save cycle log" messages={["Saving...", "Updating today...", "Checking phase...", "Nearly there..."]} />
        </button>
      </section>

      <section className="app-card rounded-[28px] p-5 sm:p-6">
        <h2 className="font-heading text-xl font-bold text-text-primary">Recent cycle logs</h2>
        {recentEntries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[rgba(0,0,0,0.10)] p-5 text-sm text-text-secondary">
            No cycle entries yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {recentEntries.map((item) => (
              <div key={item.id || item.tracked_date} className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-text-primary">{formatDate(item.tracked_date)}</div>
                  <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-bright">
                    {item.flow}
                  </div>
                </div>
                <div className="mt-1 text-xs text-text-secondary">
                  Pain {item.pain_level ?? "-"} / 10 · energy {item.energy_level ?? "-"} / 10 · training {item.training_impact}
                </div>
                {item.symptoms.length > 0 && (
                  <div className="mt-2 text-xs text-text-muted">{item.symptoms.join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
