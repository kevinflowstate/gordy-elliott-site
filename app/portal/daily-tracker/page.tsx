"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";

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
  const parts = [
    entry.sleep_hours ? Math.min(10, Math.max(1, (Number(entry.sleep_hours) / 8) * 10)) : null,
    entry.water_liters ? Math.min(10, Math.max(1, (Number(entry.water_liters) / 3) * 10)) : null,
    entry.energy_level ?? null,
    entry.stress_level ? 11 - Number(entry.stress_level) : null,
    entry.nutrition_score ?? null,
    entry.training_completed ? 10 : null,
  ].filter((value): value is number => value !== null);

  if (parts.length === 0) return null;
  return Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

function ScalePills({ label, value, onChange, lowGood = false }: { label: string; value: number | ""; onChange: (value: number) => void; lowGood?: boolean }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-text-primary">{label}</label>
        <span className="text-xs font-semibold text-text-muted">{value || "Tap 1-10"}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((num) => {
          const active = value === num;
          return (
            <button
              key={num}
              type="button"
              onClick={() => onChange(num)}
              className={`h-10 min-w-10 rounded-full border text-sm font-semibold transition-colors ${
                active
                  ? lowGood
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-accent bg-accent text-white"
                  : "border-[rgba(0,0,0,0.08)] bg-bg-card text-text-secondary"
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

export default function DailyTrackerPage() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/daily-tracker");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tracker");
      setEntries(data.entries || []);
      if (data.today) {
        setForm({
          tracked_date: data.today.tracked_date,
          sleep_hours: data.today.sleep_hours?.toString() || "",
          water_liters: data.today.water_liters?.toString() || "",
          energy_level: data.today.energy_level || "",
          stress_level: data.today.stress_level || "",
          nutrition_score: data.today.nutrition_score || "",
          training_completed: Boolean(data.today.training_completed),
          notes: data.today.notes || "",
        });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load tracker", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save daily tracker", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-28 sm:pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/portal" className="mb-3 inline-flex text-sm font-semibold text-accent-bright no-underline">
            ← Back to dashboard
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-bright">Daily Tracker</p>
          <h1 className="mt-1 text-3xl font-heading font-bold text-text-primary">How today is going</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Log the simple stuff Gordy cares about: sleep, water, stress, energy, nutrition and whether training got done.
          </p>
        </div>
        <div className="rounded-2xl border border-accent/20 bg-accent/10 px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Today score</div>
          <div className="mt-1 text-3xl font-heading font-bold text-text-primary">{score ?? "—"}/10</div>
          <div className="mt-1 text-xs text-text-secondary">7-day average: {sevenDayScore ?? "—"}/10</div>
        </div>
      </div>

      <section className="rounded-[28px] border border-[rgba(0,0,0,0.06)] bg-bg-card p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-text-primary">Date</span>
            <input
              type="date"
              value={form.tracked_date}
              onChange={(e) => setForm((prev) => ({ ...prev, tracked_date: e.target.value }))}
              className="w-full rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-text-primary outline-none focus:border-accent/50"
            />
          </label>
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
          <label className="block sm:col-span-2">
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

        <div className="mt-6 space-y-5">
          <ScalePills label="Energy" value={form.energy_level} onChange={(value) => setForm((prev) => ({ ...prev, energy_level: value }))} />
          <ScalePills label="Stress" value={form.stress_level} lowGood onChange={(value) => setForm((prev) => ({ ...prev, stress_level: value }))} />
          <ScalePills label="Nutrition" value={form.nutrition_score} onChange={(value) => setForm((prev) => ({ ...prev, nutrition_score: value }))} />
        </div>

        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, training_completed: !prev.training_completed }))}
          className={`mt-6 w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
            form.training_completed
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              : "border-[rgba(0,0,0,0.08)] bg-bg-primary text-text-primary"
          }`}
        >
          <span className="block text-sm font-semibold">{form.training_completed ? "Training done today" : "Training not logged today"}</span>
          <span className="mt-1 block text-xs text-text-secondary">Tap to toggle. This is separate from detailed session logging.</span>
        </button>

        <label className="mt-6 block">
          <span className="mb-2 block text-sm font-semibold text-text-primary">Notes</span>
          <textarea
            rows={4}
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Anything that explains the numbers?"
            className="w-full resize-none rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
          />
        </label>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-6 w-full rounded-2xl gradient-accent px-5 py-4 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
        >
          {saving ? "Saving..." : "Save daily tracker"}
        </button>
      </section>

      <section className="rounded-[28px] border border-[rgba(0,0,0,0.06)] bg-bg-card p-5 sm:p-6">
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
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-text-primary">{formatDate(entry.tracked_date)}</div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {entry.sleep_hours ?? "—"}h sleep · {entry.water_liters ?? "—"}L water · energy {entry.energy_level ?? "—"}/10
                  </div>
                </div>
                <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-sm font-semibold text-accent-bright">
                  {scoreEntry(entry) ?? "—"}/10
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
