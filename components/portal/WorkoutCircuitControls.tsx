"use client";

import { useEffect, useState } from "react";
import type { WorkoutSetData } from "@/lib/workout-runner";

export default function WorkoutCircuitControls({ value, duration, editing, onChange }: {
  value: WorkoutSetData | undefined;
  duration: number | null;
  editing: boolean;
  onChange: (field: keyof WorkoutSetData, value: number) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const endsAt = value?.circuit_ends_at || 0;
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [endsAt]);
  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : (value?.circuit_remaining_seconds ?? duration);
  const running = endsAt > now;
  const rounds = value?.circuit_rounds || 0;
  return (
    <section aria-label="Circuit controls" className="mb-6 rounded-2xl border border-[#E040D0]/30 bg-[#E040D0]/[0.07] p-4">
      <p className="text-sm font-semibold text-white/65">Complete each exercise in order, then count one round.</p>
      {!editing && <div className="mt-3 flex flex-wrap items-center gap-3">
        {remaining !== null && <output aria-label="Circuit time remaining" className="text-3xl font-bold tabular-nums">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</output>}
        {remaining === 0 && <span role="status">Time complete</span>}
        {duration === null && !endsAt && <label className="text-xs">Timer minutes (optional)<input aria-label="Circuit timer minutes" type="number" min="1" max="120" className="ml-2 w-20 rounded-lg bg-black/30 p-2 text-base" value={value?.circuit_remaining_seconds ? value.circuit_remaining_seconds / 60 : ""} onChange={e => { const minutes = Number(e.target.value); if (minutes > 0 && minutes <= 120) onChange("circuit_remaining_seconds", Math.round(minutes * 60)); }} /></label>}
        <button type="button" disabled={!value || remaining === null || remaining <= 0} className="min-h-11 rounded-xl bg-white px-4 text-sm font-bold text-black disabled:opacity-40" onClick={() => {
          if (running) { onChange("circuit_remaining_seconds", Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))); onChange("circuit_ends_at", 0); }
          else { const start = Date.now(); setNow(start); onChange("circuit_ends_at", start + (remaining || 0) * 1000); }
        }}>{running ? "Pause timer" : "Start timer"}</button>
        <button type="button" className="min-h-11 px-3 text-sm text-white/60" onClick={() => { onChange("circuit_ends_at", 0); onChange("circuit_remaining_seconds", duration || 0); }}>Reset timer</button>
      </div>}
      <div className="mt-4 flex items-center gap-3">
        <button type="button" aria-label="Remove circuit round" disabled={!rounds || !value} className="h-11 w-11 rounded-xl border border-white/20 disabled:opacity-30" onClick={() => onChange("circuit_rounds", rounds - 1)}>−</button>
        <output aria-label="Completed circuit rounds" className="flex-1 font-bold">{rounds} rounds</output>
        <button type="button" disabled={!value || rounds >= 9999} className="min-h-11 rounded-xl bg-[#E040D0] px-4 font-bold disabled:opacity-40" onClick={() => onChange("circuit_rounds", rounds + 1)}>+ Round</button>
      </div>
      <p className="mt-2 text-xs text-white/45">Round count saves with this workout. Log individual results below.</p>
    </section>
  );
}
