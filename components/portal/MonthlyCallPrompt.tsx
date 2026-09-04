"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import type { ProgrammeType } from "@/lib/types";

interface MonthlyCallsResponse {
  clientId: string;
  programme: ProgrammeType;
  config: { label: string; callCount: number; callLabel: string; bookingUrl: string | null };
  monthStart: string;
  confirmations: Array<{ call_slot: number; confirmed_at: string }>;
}

type MonthlyCallPromptVariant = "calendar" | "reminder";

function reminderDismissalKey(state: MonthlyCallsResponse) {
  return `monthly-call-reminder-dismissed:${state.clientId}:${state.monthStart}`;
}

function monthLabel(monthStart: string) {
  return new Date(`${monthStart}T12:00:00`).toLocaleDateString("en-GB", { month: "long" });
}

export default function MonthlyCallPrompt({
  variant = "calendar",
}: {
  variant?: MonthlyCallPromptVariant;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<MonthlyCallsResponse | null>(null);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [dismissalResolved, setDismissalResolved] = useState(variant !== "reminder");

  useEffect(() => {
    fetch("/api/portal/monthly-calls")
      .then((res) => res.ok ? res.json() : null)
      .then(setState)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (variant !== "reminder" || !state) return;
    try {
      setDismissed(window.localStorage.getItem(reminderDismissalKey(state)) === "true");
    } finally {
      setDismissalResolved(true);
    }
  }, [state, variant]);

  if (!state) return null;
  const completed = new Set(state.confirmations.map((item) => item.call_slot));
  const outstandingCount = Math.max(0, state.config.callCount - completed.size);

  function dismissReminder() {
    if (!state) return;
    window.localStorage.setItem(reminderDismissalKey(state), "true");
    setDismissed(true);
  }

  if (variant === "reminder") {
    if (!dismissalResolved || dismissed || outstandingCount === 0) return null;

    return (
      <section
        className="app-rise app-rise-1 fixed left-4 right-4 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[90] mx-auto flex min-h-[72px] max-w-[420px] items-center gap-3 rounded-[20px] border border-accent/20 bg-[#151117]/95 px-4 py-3 shadow-[0_18px_55px_rgba(0,0,0,0.48)] backdrop-blur-xl sm:left-auto sm:right-6 sm:top-6 sm:mx-0 sm:w-[390px]"
        aria-label="Monthly coaching reminder"
        data-testid="monthly-call-reminder-overlay"
      >
        <Link
          href="/portal/calendar#coaching-calls"
          className="group flex min-w-0 flex-1 items-center gap-3 no-underline"
          data-testid="monthly-call-reminder-link"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-bright" aria-hidden="true">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3M5 11h14M6 21h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-accent-bright">Monthly coaching</span>
            <span className="mt-0.5 block text-sm font-semibold leading-5 text-white">
              Book your {monthLabel(state.monthStart)} {state.config.callCount === 1 ? "call" : "calls"}
            </span>
            <span className="mt-0.5 block text-xs text-white/45">
              {completed.size} of {state.config.callCount} confirmed
            </span>
          </span>
          <svg className="h-4 w-4 shrink-0 text-white/38 transition group-hover:translate-x-0.5 group-hover:text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
          </svg>
        </Link>
        <button
          type="button"
          onClick={dismissReminder}
          aria-label="Dismiss monthly coaching reminder"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/38 transition hover:bg-white/[0.06] hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright"
          data-testid="monthly-call-reminder-dismiss"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </section>
    );
  }

  const allConfirmed = outstandingCount === 0;

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
    <section id="coaching-calls" className="mb-5 scroll-mt-24 rounded-[24px] border border-white/10 bg-[#151117] p-5 sm:p-6" aria-labelledby="coaching-calls-heading">
      <div className="max-w-xl">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-bright">Monthly coaching</div>
        <h2 id="coaching-calls-heading" className="mt-2 text-xl font-heading font-extrabold text-white">
          {allConfirmed ? "Your calls are booked" : "Keep your calls locked in"}
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {allConfirmed
            ? `All ${state.config.callCount === 1 ? "coaching time is" : "coaching calls are"} confirmed for ${monthLabel(state.monthStart)}.`
            : state.programme === "in_person"
              ? "Confirm this month’s 1:1 is arranged with Gordy."
              : `Book and confirm ${state.config.callCount === 2 ? "both of your calls" : "your call"} for this month.`}
        </p>
      </div>
      <div className="mt-5 border-y border-white/10" data-testid="monthly-call-booking-controls">
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
