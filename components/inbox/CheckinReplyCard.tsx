"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { checkinAnswers, checkinDate, checkinPreview, type CheckinMessageContext } from "@/lib/checkin-message";

export default function CheckinReplyCard({ checkinId, context, isOwn }: {
  checkinId: string; context: CheckinMessageContext; isOwn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<{ context: CheckinMessageContext; reply: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    void fetch(`/api/inbox/checkin?checkin_id=${encodeURIComponent(checkinId)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load this check-in.");
        if (!controller.signal.aborted) setDetail(data);
      })
      .catch((err) => {
        if (dialog?.open) setError(err instanceof Error && err.name !== "AbortError" ? err.message : "Loading took too long. Please try again.");
      })
      .finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [open, checkinId, attempt]);

  const preview = checkinPreview(context);
  return <>
    <button type="button" onClick={() => { setDetail(null); setError(null); setOpen(true); }} aria-label={`View check-in from ${checkinDate(context.submitted_at)}`}
      className={`mb-3 block w-full min-w-0 rounded-xl border-l-2 px-3 py-2.5 text-left transition-colors ${isOwn ? "border-black/45 bg-black/[0.07] hover:bg-black/10" : "border-accent-bright bg-black/20 hover:bg-black/30"}`}>
      <span className={`flex items-center gap-2 text-[11px] font-semibold ${isOwn ? "text-black/75" : "text-accent-bright"}`}>
        <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 10H5m0 0 4-4m-4 4 4 4m-4-4h10a5 5 0 0 1 5 5v3" /></svg>
        Check-in reply · {checkinDate(context.submitted_at)}
      </span>
      {preview.length ? <span className={`mt-2 block space-y-1 text-xs leading-relaxed ${isOwn ? "text-black/70" : "text-text-secondary"}`}>
        {preview.map((answer) => <span key={answer.key} className="line-clamp-2 break-words [overflow-wrap:anywhere]"><strong className="font-semibold">{answer.label}:</strong> {answer.text}</span>)}
      </span> : <span className={`mt-2 block text-xs ${isOwn ? "text-black/70" : "text-text-secondary"}`}>Your weekly update{context.mood ? ` · ${context.mood}` : ""}</span>}
      <span className={`mt-2 block text-[10px] font-semibold ${isOwn ? "text-black/65" : "text-text-muted"}`}>View full check-in ↗</span>
    </button>
    {open && createPortal(<dialog ref={dialogRef} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} aria-labelledby={`checkin-heading-${checkinId}`}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#141116] p-0 text-white shadow-2xl backdrop:bg-black/75">
      <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-white/10 bg-[#141116] px-5 py-4">
        <div><h2 id={`checkin-heading-${checkinId}`} className="font-heading text-lg font-bold">Check-in</h2><p className="mt-1 text-xs text-white/55">{checkinDate(context.submitted_at)}</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close check-in" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-2xl text-white/70">×</button>
      </div>
      <div className="space-y-5 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {error ? <div role="alert"><p className="text-sm text-red-300">{error}</p><button type="button" onClick={() => { setError(null); setAttempt((value) => value + 1); }} className="mt-3 min-h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold">Try again</button></div>
          : !detail ? <p role="status" className="text-sm text-white/55">Loading check-in…</p>
          : <>
            {detail.context.mood && <div><h3 className="text-xs font-semibold text-accent-bright">How you felt</h3><p className="mt-1 text-sm capitalize">{detail.context.mood}</p></div>}
            {checkinAnswers(detail.context).map((answer) => <div key={answer.key}><h3 className="text-xs font-semibold text-accent-bright">{answer.label}</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/80 [overflow-wrap:anywhere]">{answer.text}</p></div>)}
            {detail.reply && <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4"><h3 className="text-xs font-semibold text-accent-bright">Gordy’s reply</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{detail.reply}</p></div>}
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 w-full rounded-xl bg-accent-bright px-4 text-sm font-bold text-black">Back to conversation</button>
          </>}
      </div>
    </dialog>, document.body)}
  </>;
}
