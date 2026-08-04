"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  StrengthMetricType,
  StrengthProgressPayload,
} from "@/lib/strength-progress";

type ExerciseOption = {
  id: string;
  name: string;
  muscleGroup: string | null;
  equipment: string | null;
};

type ManagerData = StrengthProgressPayload & {
  availableExercises: ExerciseOption[];
};

const metricOptions: Array<{ value: StrengthMetricType; label: string; hint: string }> = [
  { value: "load_reps", label: "Weight + reps", hint: "Estimated strength for loaded lifts" },
  { value: "reps", label: "Reps only", hint: "Pull-ups, press-ups and bodyweight work" },
  { value: "duration", label: "Timed hold", hint: "Planks, carries and rehab holds" },
];

export default function StrengthTrackerManager({ clientId }: { clientId: string }) {
  const [data, setData] = useState<ManagerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState("");
  const [metricType, setMetricType] = useState<StrengthMetricType>("load_reps");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/client-strength-trackers?clientId=${clientId}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Key movements could not be loaded");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Key movements could not be loaded");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeIds = useMemo(
    () => new Set((data?.trackers || []).map((tracker) => tracker.exerciseId)),
    [data?.trackers],
  );
  const available = (data?.availableExercises || []).filter((exercise) => !activeIds.has(exercise.id));

  async function addTracker() {
    if (!exerciseId || saving) return;
    setSaving("add");
    setError(null);
    try {
      const response = await fetch("/api/admin/client-strength-trackers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          exercise_id: exerciseId,
          metric_type: metricType,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Movement could not be tracked");
      setExerciseId("");
      setMetricType("load_reps");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Movement could not be tracked");
    } finally {
      setSaving(null);
    }
  }

  async function updateMetric(id: string, nextMetric: StrengthMetricType) {
    setSaving(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/client-strength-trackers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, id, metric_type: nextMetric }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Tracking method could not be updated");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Tracking method could not be updated");
    } finally {
      setSaving(null);
    }
  }

  async function retireTracker(id: string) {
    setSaving(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/client-strength-trackers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Movement could not be removed");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Movement could not be removed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section aria-labelledby="key-movement-heading">
      <div className="mb-4">
        <h2 id="key-movement-heading" className="text-lg font-heading font-bold text-text-primary">
          Key Strength Movements
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-muted">
          Choose three to five movements that suit this client&apos;s active plan. Results update automatically from completed workout sets.
        </p>
      </div>

      <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-4 sm:p-5">
        {loading ? (
          <div className="h-24 animate-pulse rounded-xl bg-[rgba(0,0,0,0.04)]" />
        ) : (
          <>
            {(data?.trackers || []).length > 0 ? (
              <div className="mb-5 space-y-2">
                {data?.trackers.map((tracker) => (
                  <div key={tracker.id} className="flex flex-col gap-3 rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-text-primary">{tracker.exerciseName}</div>
                      <div className="mt-0.5 text-[11px] text-text-muted">
                        {tracker.latestSetLabel
                          ? `${tracker.latestSetLabel} · latest logged set`
                          : "Waiting for a completed workout set"}
                      </div>
                    </div>
                    <select
                      aria-label={`Tracking method for ${tracker.exerciseName}`}
                      value={tracker.metricType}
                      disabled={Boolean(saving)}
                      onChange={(event) => void updateMetric(tracker.id, event.target.value as StrengthMetricType)}
                      className="min-h-11 rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-card px-3 text-xs text-text-primary focus:border-[#E040D0]/40 focus:outline-none disabled:opacity-50"
                    >
                      {metricOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={Boolean(saving)}
                      onClick={() => void retireTracker(tracker.id)}
                      className="min-h-11 rounded-xl border border-amber-500/20 px-3 text-xs font-semibold text-amber-500 transition-colors hover:bg-amber-500/8 disabled:opacity-50"
                    >
                      {saving === tracker.id ? "Saving..." : "Stop tracking"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-5 rounded-xl border border-dashed border-[#E040D0]/20 bg-[#E040D0]/5 px-4 py-5 text-center">
                <div className="text-sm font-semibold text-text-primary">No key movements selected</div>
                <p className="mt-1 text-xs text-text-muted">
                  {available.length
                    ? "Add movements that make sense for this client—not a universal lift list."
                    : "Assign an active training plan first, then choose the movements that matter."}
                </p>
              </div>
            )}

            {(data?.trackers.length || 0) < 5 && (
              <div className="grid gap-3 border-t border-[rgba(0,0,0,0.06)] pt-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Movement</span>
                  <select
                    value={exerciseId}
                    onChange={(event) => setExerciseId(event.target.value)}
                    className="min-h-11 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 text-sm text-text-primary focus:border-[#E040D0]/40 focus:outline-none"
                  >
                    <option value="">{available.length ? "Choose from active plan" : "No additional plan movements"}</option>
                    {available.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Measure by</span>
                  <select
                    value={metricType}
                    onChange={(event) => setMetricType(event.target.value as StrengthMetricType)}
                    className="min-h-11 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-3 text-sm text-text-primary focus:border-[#E040D0]/40 focus:outline-none"
                  >
                    {metricOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!exerciseId || Boolean(saving)}
                  onClick={() => void addTracker()}
                  className="min-h-11 rounded-xl bg-[#E040D0] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#b830a8] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving === "add" ? "Adding..." : "Track movement"}
                </button>
              </div>
            )}

            <p className="mt-3 text-[11px] text-text-muted">
              {metricOptions.find((option) => option.value === metricType)?.hint}
            </p>
          </>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs font-semibold text-red-400">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
