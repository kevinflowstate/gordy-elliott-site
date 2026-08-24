"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { ProgrammeType } from "@/lib/types";

interface MonthlyCallsResponse {
  programme: ProgrammeType;
  config: { label: string; callCount: number; callLabel: string; bookingUrl: string | null };
  confirmations: Array<{ call_slot: number; confirmed_at: string }>;
}

export default function MonthlyCallPrompt() {
  const { toast } = useToast();
  const [state, setState] = useState<MonthlyCallsResponse | null>(null);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/portal/monthly-calls")
      .then((res) => res.ok ? res.json() : null)
      .then(setState)
      .catch(() => {});
  }, []);

  if (!state || state.confirmations.length >= state.config.callCount) return null;
  const completed = new Set(state.confirmations.map((item) => item.call_slot));

  async function confirm(slot: number) {
    setSavingSlot(slot);
    try {
      const res = await fetch("/api/portal/monthly-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_slot: slot }),
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setState((current) => current ? { ...current, confirmations: [...current.confirmations.filter((item) => item.call_slot !== slot), payload.confirmation] } : current);
      toast("Booking confirmed");
    } catch {
      toast("Couldn't save that confirmation. Try again.", "error");
    } finally {
      setSavingSlot(null);
    }
  }

  return (
    <section className="rounded-[26px] border border-accent/20 bg-[linear-gradient(135deg,rgba(224,64,208,0.12),rgba(255,255,255,0.025))] p-5 shadow-xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-bright">Monthly coaching</div>
          <h2 className="mt-2 text-xl font-heading font-extrabold text-white">Keep your calls locked in</h2>
          <p className="mt-1 text-sm text-text-secondary">{state.programme === "in_person" ? "Confirm this month’s 1:1 is arranged with Gordy." : `Book and confirm ${state.config.callCount === 2 ? "both of your calls" : "your call"} for this month.`}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/65">{state.config.label}</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: state.config.callCount }, (_, index) => index + 1).map((slot) => {
          const isDone = completed.has(slot);
          return (
            <div key={slot} className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="text-sm font-semibold text-white">{state.config.callCount > 1 ? `Call ${slot}` : "Monthly 1:1"}</div>
              {isDone ? (
                <div className="mt-3 flex min-h-10 items-center gap-2 text-sm font-semibold text-emerald-400"><span>✓</span> Confirmed</div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {state.config.bookingUrl && (
                    <a href={state.config.bookingUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-xl bg-white px-3 py-2 text-xs font-bold text-black no-underline">{state.config.callLabel}</a>
                  )}
                  <button type="button" onClick={() => void confirm(slot)} disabled={savingSlot === slot} className="min-h-10 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-bold text-accent-bright disabled:opacity-50">
                    {savingSlot === slot ? "Saving…" : state.programme === "in_person" ? "It’s booked" : "I’ve booked this"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
