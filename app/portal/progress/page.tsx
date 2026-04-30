"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import CyclingStatusText from "@/components/ui/CyclingStatusText";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Dot,
} from "recharts";

interface Measurement {
  id: string;
  measured_date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  hips_cm: number | null;
  left_arm_cm: number | null;
  right_arm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  notes: string | null;
  created_at: string;
}

const MEASUREMENT_COLORS: Record<string, string> = {
  waist_cm: "#E040D0",
  chest_cm: "#3B82F6",
  hips_cm: "#10B981",
  left_arm_cm: "#F59E0B",
  right_arm_cm: "#EF4444",
  left_thigh_cm: "#8B5CF6",
  right_thigh_cm: "#06B6D4",
};

const MEASUREMENT_LABELS: Record<string, string> = {
  waist_cm: "Waist",
  chest_cm: "Chest",
  hips_cm: "Hips",
  left_arm_cm: "L. Arm",
  right_arm_cm: "R. Arm",
  left_thigh_cm: "L. Thigh",
  right_thigh_cm: "R. Thigh",
};

const MEASUREMENT_KEYS = Object.keys(MEASUREMENT_LABELS) as (keyof Measurement)[];

export default function ProgressPage() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [activeMeasurements, setActiveMeasurements] = useState<Set<string>>(
    new Set(["waist_cm", "chest_cm", "hips_cm"])
  );

  // Form state
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [weightKg, setWeightKg] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [hipsCm, setHipsCm] = useState("");
  const [leftArmCm, setLeftArmCm] = useState("");
  const [rightArmCm, setRightArmCm] = useState("");
  const [leftThighCm, setLeftThighCm] = useState("");
  const [rightThighCm, setRightThighCm] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/portal/body-measurements");
      if (res.ok) {
        const data = await res.json();
        setMeasurements(data.measurements || []);
      } else {
        setError("We couldn't load your progress entries. Try refreshing the page.");
      }
    } catch {
      setError("We couldn't load your progress entries. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const body: Record<string, unknown> = { measured_date: date };
      if (weightKg) body.weight_kg = parseFloat(weightKg);
      if (waistCm) body.waist_cm = parseFloat(waistCm);
      if (chestCm) body.chest_cm = parseFloat(chestCm);
      if (hipsCm) body.hips_cm = parseFloat(hipsCm);
      if (leftArmCm) body.left_arm_cm = parseFloat(leftArmCm);
      if (rightArmCm) body.right_arm_cm = parseFloat(rightArmCm);
      if (leftThighCm) body.left_thigh_cm = parseFloat(leftThighCm);
      if (rightThighCm) body.right_thigh_cm = parseFloat(rightThighCm);
      if (notes) body.notes = notes;

      const res = await fetch("/api/portal/body-measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      // Reset form
      setWeightKg("");
      setWaistCm("");
      setChestCm("");
      setHipsCm("");
      setLeftArmCm("");
      setRightArmCm("");
      setLeftThighCm("");
      setRightThighCm("");
      setNotes("");
      setDate(today);
      const savedAt = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      setSuccessMsg(`Entry saved at ${savedAt}.`);
      setTimeout(() => setSuccessMsg(null), 5000);
      await load();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch("/api/portal/body-measurements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setMeasurements((prev) => prev.filter((m) => m.id !== id));
        return;
      }
      setError("Couldn't delete that entry. Try again in a moment.");
      setTimeout(() => setError(null), 4000);
    } catch {
      setError("Couldn't delete that entry. Check your connection.");
      setTimeout(() => setError(null), 4000);
    }
  }

  function toggleMeasurement(key: string) {
    setActiveMeasurements((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // Build chart data (oldest first for charts)
  const sorted = [...measurements].sort(
    (a, b) => new Date(a.measured_date).getTime() - new Date(b.measured_date).getTime()
  );

  const weightChartData = sorted
    .filter((m) => m.weight_kg != null)
    .map((m) => ({
      date: new Date(m.measured_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      value: m.weight_kg,
    }));

  const measurementChartData = sorted.map((m) => {
    const point: Record<string, unknown> = {
      date: new Date(m.measured_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    };
    MEASUREMENT_KEYS.forEach((key) => {
      if (m[key] != null) point[key as string] = m[key];
    });
    return point;
  });

  // Stats
  const latestWithWeight = measurements.find((m) => m.weight_kg != null);
  const earliestWithWeight = [...measurements].reverse().find((m) => m.weight_kg != null);
  const weightChange =
    latestWithWeight && earliestWithWeight && latestWithWeight.id !== earliestWithWeight.id
      ? (latestWithWeight.weight_kg! - earliestWithWeight.weight_kg!).toFixed(1)
      : null;

  const inputClass =
    "w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-[#E040D0]/30 focus:border-[#E040D0]/50 transition-all";

  const labelClass = "block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5";

  // Latest entry timestamp for trust signal ("you're up to date")
  const latestEntry = measurements[0];
  const latestDateLabel = latestEntry
    ? new Date(latestEntry.measured_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : null;

  return (
    <div className="max-w-2xl pb-24 sm:pb-0">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Progress Tracking</h1>
          <p className="text-text-secondary mt-1">Log your weight and measurements to track your progress over time.</p>
          {latestDateLabel && (
            <p className="mt-2 text-xs text-text-muted">
              Last entry: {latestDateLabel}
              {latestEntry?.weight_kg != null ? ` · ${latestEntry.weight_kg}kg` : ""}
            </p>
          )}
        </div>
        <Link
          href="/portal"
          className="text-xs font-semibold text-accent-bright no-underline transition-colors hover:text-accent-light"
        >
          ← Back to dashboard
        </Link>
      </div>

      {/* Progress surface nav — progress data here, photos one tap away on /portal/gallery */}
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full border border-[#E040D0]/25 bg-[#E040D0]/8 px-3 py-1.5 text-xs font-semibold text-[#E040D0]">
          Measurements & weight
        </span>
        <Link
          href="/portal/gallery"
          className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,0,0,0.08)] bg-bg-card px-3 py-1.5 text-xs font-semibold text-text-secondary no-underline transition-all hover:text-text-primary hover:border-[#E040D0]/30"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Progress photos
        </Link>
        <Link
          href="/portal/checkin"
          className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,0,0,0.08)] bg-bg-card px-3 py-1.5 text-xs font-semibold text-text-secondary no-underline transition-all hover:text-text-primary hover:border-[#E040D0]/30"
        >
          Weekly check-in
        </Link>
      </div>

      {/* Log New Entry */}
      <div className="relative bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 sm:p-6 mb-6">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#B830A8] via-[#E040D0] to-[#F060E0] rounded-t-2xl" />
        <h2 className="text-base font-heading font-bold text-text-primary mb-4">Log New Entry</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm text-emerald-400 mb-4">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 82.5"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Expandable measurements section */}
        <button
          type="button"
          onClick={() => setShowMeasurements(!showMeasurements)}
          className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors mb-4 cursor-pointer"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showMeasurements ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Body Measurements (optional)
        </button>

        {showMeasurements && (
          <div className="grid grid-cols-1 gap-4 mb-4 rounded-xl border border-[rgba(0,0,0,0.04)] bg-[rgba(0,0,0,0.02)] p-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Waist (cm)</label>
              <input type="number" step="0.1" placeholder="e.g. 82" value={waistCm} onChange={(e) => setWaistCm(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Chest (cm)</label>
              <input type="number" step="0.1" placeholder="e.g. 98" value={chestCm} onChange={(e) => setChestCm(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Hips (cm)</label>
              <input type="number" step="0.1" placeholder="e.g. 96" value={hipsCm} onChange={(e) => setHipsCm(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Left Arm (cm)</label>
              <input type="number" step="0.1" placeholder="e.g. 34" value={leftArmCm} onChange={(e) => setLeftArmCm(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Right Arm (cm)</label>
              <input type="number" step="0.1" placeholder="e.g. 34" value={rightArmCm} onChange={(e) => setRightArmCm(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Left Thigh (cm)</label>
              <input type="number" step="0.1" placeholder="e.g. 58" value={leftThighCm} onChange={(e) => setLeftThighCm(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Right Thigh (cm)</label>
              <input type="number" step="0.1" placeholder="e.g. 58" value={rightThighCm} onChange={(e) => setRightThighCm(e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Notes</label>
              <input type="text" placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || (!weightKg && !waistCm && !chestCm && !hipsCm && !leftArmCm && !rightArmCm && !leftThighCm && !rightThighCm)}
          className="px-6 py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <CyclingStatusText active={saving} idle="Save Entry" messages={["Saving...", "Updating chart...", "Checking progress...", "Nearly there..."]} />
        </button>
      </div>

      {/* Weight Progress */}
      {!loading && weightChartData.length > 0 && (
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 sm:p-6 mb-6">
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-heading font-bold text-text-primary">Weight Progress</h2>
            <div className="flex gap-4">
              {latestWithWeight && (
                <div className="text-right">
                  <div className="text-xs text-text-muted uppercase tracking-wider">Current</div>
                  <div className="text-lg font-heading font-bold text-text-primary">{latestWithWeight.weight_kg}kg</div>
                </div>
              )}
              {weightChange !== null && (
                <div className="text-right">
                  <div className="text-xs text-text-muted uppercase tracking-wider">Change</div>
                  <div className={`text-lg font-heading font-bold ${parseFloat(weightChange) < 0 ? "text-emerald-400" : parseFloat(weightChange) > 0 ? "text-red-400" : "text-text-primary"}`}>
                    {parseFloat(weightChange) > 0 ? "+" : ""}{weightChange}kg
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="overflow-hidden">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weightChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "var(--color-bg-card)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [`${v}kg`, "Weight"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#E040D0"
                strokeWidth={2}
                dot={<Dot r={3} fill="#E040D0" stroke="#E040D0" />}
                activeDot={{ r: 4, fill: "#E040D0" }}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Measurements Progress */}
      {!loading && measurementChartData.length > 0 && MEASUREMENT_KEYS.some((k) => sorted.some((m) => m[k] != null)) && (
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 sm:p-6 mb-6">
          <h2 className="text-base font-heading font-bold text-text-primary mb-4">Measurements Progress</h2>

          {/* Toggle buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {MEASUREMENT_KEYS.filter((k) => sorted.some((m) => m[k] != null)).map((key) => {
              const isActive = activeMeasurements.has(key as string);
              return (
                <button
                  key={key as string}
                  onClick={() => toggleMeasurement(key as string)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                    isActive
                      ? "text-white border-transparent"
                      : "bg-transparent border-[rgba(0,0,0,0.1)] text-text-muted"
                  }`}
                  style={isActive ? { background: MEASUREMENT_COLORS[key as string] } : {}}
                >
                  {MEASUREMENT_LABELS[key as string]}
                </button>
              );
            })}
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={measurementChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "var(--color-bg-card)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 12 }}
                formatter={(v, name) => [`${v}cm`, MEASUREMENT_LABELS[name as string] || name]}
              />
              <Legend
                formatter={(value) => MEASUREMENT_LABELS[value] || value}
                wrapperStyle={{ fontSize: 11 }}
              />
              {MEASUREMENT_KEYS.filter((k) => activeMeasurements.has(k as string)).map((key) => (
                <Line
                  key={key as string}
                  type="monotone"
                  dataKey={key as string}
                  stroke={MEASUREMENT_COLORS[key as string]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Entries */}
      <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 sm:p-6">
        <h2 className="text-base font-heading font-bold text-text-primary mb-4">Recent Entries</h2>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded-xl h-14" />
            ))}
          </div>
        ) : measurements.length === 0 ? (
          <p className="text-text-muted text-sm">No entries yet. Log your first measurement above.</p>
        ) : (
          <div className="space-y-2">
            {measurements.slice(0, 20).map((m) => (
              <div
                key={m.id}
                className="flex items-start justify-between gap-3 p-4 bg-[rgba(0,0,0,0.02)] rounded-xl border border-[rgba(0,0,0,0.04)] hover:border-[rgba(0,0,0,0.08)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-text-primary">
                      {new Date(m.measured_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    {m.weight_kg != null && (
                      <span className="text-xs font-bold text-[#E040D0]">{m.weight_kg}kg</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {MEASUREMENT_KEYS.map((key) => {
                      const val = m[key];
                      return val != null ? (
                        <span key={key as string} className="text-xs text-text-muted">
                          {MEASUREMENT_LABELS[key as string]}: {val as number}cm
                        </span>
                      ) : null;
                    })}
                  </div>
                  {m.notes && <p className="text-xs text-text-muted mt-1 italic">{m.notes}</p>}
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                  title="Delete entry"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
