"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MANUAL_ACTIVITY_OPTIONS, formatTrainingDate, manualActivityLabel, type ManualTrainingActivity } from "@/lib/training-calendar";

type Props = {
  /** Client mode: the selected date and the visible Monday week. */
  date?: string;
  weekStart?: string;
  weekEnd?: string;
  refreshKey?: number;
  workoutLogged?: boolean;
  onChange?: (entries: ManualTrainingActivity[]) => void;
  /** Coach mode: read-only history for this client. */
  clientId?: string;
};

function describe(entry: ManualTrainingActivity) {
  return `${manualActivityLabel(entry.kind)}${entry.duration_minutes ? ` · ${entry.duration_minutes} min` : ""}`;
}

export default function ManualTrainingActivityPanel({ date, weekStart, weekEnd, refreshKey = 0, workoutLogged = false, onChange, clientId }: Props) {
  const coachView = Boolean(clientId);
  const [activities, setActivities] = useState<ManualTrainingActivity[]>([]);
  const [today, setToday] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [kind, setKind] = useState<string>("walking");
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestRef = useRef(0);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const load = useCallback(async () => {
    if (!coachView && (!weekStart || !weekEnd)) return;
    const requestId = ++requestRef.current;
    setLoaded(false);
    setError("");
    try {
      const url = coachView
        ? `/api/admin/client-training-activity?clientId=${clientId}`
        : `/api/portal/training-activity?from=${weekStart}&to=${weekEnd}`;
      const response = await fetch(url);
      const data = await response.json().catch(() => ({}));
      if (requestId !== requestRef.current) return;
      if (!response.ok) throw new Error(data.error || "Couldn't load activity.");
      const entries = (data.activities || []) as ManualTrainingActivity[];
      setActivities(entries);
      if (data.today) setToday(data.today);
      onChangeRef.current?.(entries);
      setLoaded(true);
    } catch (loadError) {
      if (requestId !== requestRef.current) return;
      setError(loadError instanceof Error ? loadError.message : "Couldn't load activity.");
    }
  }, [coachView, clientId, weekStart, weekEnd]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const selected = activities.find((entry) => entry.activity_date === date);
  useEffect(() => {
    setKind(selected?.kind || "walking");
    setMinutes(selected?.duration_minutes ? String(selected.duration_minutes) : "");
    setNotes(selected?.notes || "");
    setNotice("");
  }, [date, selected]);

  async function save(remove = false) {
    if (!date) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/portal/training-activity", {
        method: remove ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(remove
          ? { activity_date: date }
          : { activity_date: date, kind, duration_minutes: kind === "rest" ? null : minutes, notes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Couldn't save this entry.");
      await load();
      setNotice(remove ? "Entry removed." : kind === "rest" ? "Rest day recorded." : "Activity recorded.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't save this entry.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-bg-primary px-3 py-2 text-sm text-text-primary [color-scheme:dark]";
  const errorBlock = error && (
    <p role="alert" className="mt-3 text-sm text-red-400">
      {error} <button type="button" onClick={() => void load()} className="font-semibold underline">Try again</button>
    </p>
  );

  if (coachView) {
    return (
      <section aria-label="Client-recorded activity and rest days" className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-4">
        <h2 className="text-sm font-semibold text-text-primary">Activity &amp; rest days recorded by the client</h2>
        <p className="mt-1 text-xs text-text-secondary">Entered manually in the app. Not wearable or health-app data, and not assigned workout completion.</p>
        {errorBlock}
        {!loaded && !error && <p className="mt-3 text-xs text-text-secondary">Loading...</p>}
        {loaded && activities.length === 0 && <p className="mt-3 text-xs text-text-secondary">No manual activity or rest days recorded yet.</p>}
        {activities.length > 0 && (
          <ul className="mt-3 divide-y divide-[rgba(0,0,0,0.06)] text-sm" aria-label="Manually recorded activity">
            {activities.map((entry) => (
              <li key={entry.id} className="py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-text-primary">{formatTrainingDate(entry.activity_date, true)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${entry.kind === "rest" ? "bg-sky-500/10 text-sky-600" : "bg-[#E040D0]/10 text-[#B0279F]"}`}>{describe(entry)}</span>
                </div>
                {entry.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-text-secondary">{entry.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (!date) return null;
  const isFuture = Boolean(today && date > today);
  return (
    <details className="group app-card mb-5 rounded-[24px] p-4" aria-label="Other activity or rest day">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E667D6]">Other activity or rest</div>
          <h2 className="mt-1 truncate text-base font-heading font-bold text-text-primary">
            {formatTrainingDate(date)}: {selected ? describe(selected) : "nothing recorded"}
          </h2>
        </div>
        <svg className="h-4 w-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </summary>
      <p className="mt-3 text-xs leading-5 text-text-secondary">
        Record a walk, another workout or a rest day yourself, for example while your health app isn&apos;t syncing. It shows to your coach as a manual entry and doesn&apos;t count as completing an assigned workout.
      </p>
      {errorBlock}
      {notice && <p role="status" className="mt-3 text-sm font-semibold text-[#F7A8EE]">{notice}</p>}
      {isFuture ? (
        <p className="mt-3 text-sm text-text-secondary">You can record activity or rest once this date arrives.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-sm font-semibold text-text-primary">
              Activity
              <select aria-label="Activity type" value={kind} onChange={(event) => setKind(event.target.value)} className={inputClass}>
                {MANUAL_ACTIVITY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value} disabled={value === "rest" && workoutLogged}>{label}</option>
                ))}
              </select>
            </label>
            {kind !== "rest" && (
              <label className="block min-w-0 text-sm font-semibold text-text-primary">
                Minutes (optional)
                <input aria-label="Activity minutes" type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={(event) => setMinutes(event.target.value)} className={inputClass} />
              </label>
            )}
          </div>
          <label className="block text-sm font-semibold text-text-primary">
            Notes (optional)
            <textarea aria-label="Activity notes" rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} />
          </label>
          {workoutLogged && <p className="text-xs text-text-secondary">A workout is logged on this date, so it can&apos;t also be a rest day.</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy || !loaded || (kind === "rest" && workoutLogged)} onClick={() => void save()} className="min-h-11 rounded-xl bg-[#E040D0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {busy ? "Saving..." : selected ? "Update entry" : kind === "rest" ? "Record rest day" : "Record activity"}
            </button>
            {selected && (
              <button type="button" disabled={busy} onClick={() => void save(true)} className="min-h-11 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-text-secondary disabled:opacity-40">
                Remove entry
              </button>
            )}
          </div>
          <p className="text-[11px] text-text-muted">One entry per day. Saving again updates it.</p>
        </div>
      )}
    </details>
  );
}
