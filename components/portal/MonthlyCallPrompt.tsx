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
    <section className="rounded-[24px] border border-white/10 bg-[#151117] p-5 sm:p-6">
      <div className="max-w-xl">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-bright">Monthly coaching</div>
        <h2 className="mt-2 text-xl font-heading font-extrabold text-white">Keep your calls locked in</h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">{state.programme === "in_person" ? "Confirm this month’s 1:1 is arranged with Gordy." : `Book and confirm ${state.config.callCount === 2 ? "both of your calls" : "your call"} for this month.`}</p>
      </div>
      <div className="mt-5 border-y border-white/10">
        {Array.from({ length: state.config.callCount }, (_, index) => index + 1).map((slot) => {
          const isDone = completed.has(slot);
          return (
            <div key={slot} className="border-b border-white/10 py-4 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">{state.config.callCount > 1 ? `Call ${slot}` : "Monthly 1:1"}</div>
                <div className="text-xs text-white/45">{isDone ? "Confirmed" : "To book"}</div>
              </div>
              {isDone ? (
                <div className="mt-3 flex min-h-10 items-center gap-2 text-sm font-semibold text-emerald-400"><span aria-hidden="true">✓</span> You&apos;re booked for this month</div>
              ) : (
                <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  {state.config.bookingUrl && (
                    <a
                      href={state.config.bookingUrl}
                      target="_blank"
                      rel="noreferrer"
                      data-testid="monthly-call-booking-link"
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent-bright px-4 py-2.5 text-sm font-extrabold text-black no-underline transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary sm:w-auto"
                    >
                      {state.config.callLabel}
                      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M5 12h14m-5-5 5 5-5 5" />
                      </svg>
                    </a>
                  )}
                  <button type="button" onClick={() => void confirm(slot)} disabled={savingSlot === slot} className="min-h-10 px-1 py-2 text-sm font-semibold text-accent-bright underline decoration-accent/40 underline-offset-4 transition hover:text-white disabled:opacity-50">
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
