"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { InboxMessage, UserRole } from "@/lib/types";

interface InboxThreadProps {
  messages: InboxMessage[];
  currentRole: UserRole;
  onSend: (message: string) => Promise<void>;
  sending: boolean;
  error: string | null;
  emptyTitle: string;
  emptyDescription: string;
  composerPlaceholder?: string;
  threadLabel?: string;
  threadMeta?: string;
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InboxThread({
  messages,
  currentRole,
  onSend,
  sending,
  error,
  emptyTitle,
  emptyDescription,
  composerPlaceholder = "Write a message...",
  threadLabel,
  threadMeta,
}: InboxThreadProps) {
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submittingRef = useRef(false);

  const canSend = draft.trim().length > 0 && !sending;
  const latestMessageId = messages.at(-1)?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [latestMessageId]);

  const groupedMessages = useMemo(() => messages, [messages]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending || submittingRef.current) return;

    submittingRef.current = true;
    setLocalError(null);
    try {
      await onSend(message);
      setDraft("");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <div className="portal-dm-thread flex min-h-[min(72dvh,48rem)] flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)]">
      {(threadLabel || threadMeta) && (
        <div className="border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
          {threadLabel && <div className="text-sm font-semibold text-text-primary">{threadLabel}</div>}
          {threadMeta && <div className="mt-0.5 text-xs text-text-muted">{threadMeta}</div>}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-5">
        {groupedMessages.length === 0 ? (
          <div className="portal-dm-empty flex min-h-80 flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent-bright">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8m-8 4h5m-7 6h12a2 2 0 002-2V8a2 2 0 00-.586-1.414l-4-4A2 2 0 0014 2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-heading font-bold text-text-primary">{emptyTitle}</h2>
            <p className="mt-2 max-w-sm text-sm text-text-secondary">{emptyDescription}</p>
          </div>
        ) : (
          groupedMessages.map((message) => {
            const isOwn = message.sender_role === currentRole;
            return (
              <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[84%] rounded-2xl px-4 py-3 sm:max-w-[72%] ${
                  isOwn
                    ? "bg-accent-bright text-black"
                    : "border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.045)] text-text-primary"
                }`}>
                  <div className={`mb-1 text-[11px] font-semibold ${isOwn ? "text-black/65" : "text-text-muted"}`}>
                    {isOwn ? "You" : message.sender_name || (message.sender_role === "admin" ? "Gordy" : "Client")}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.message}</div>
                  <div className={`mt-2 text-[10px] ${isOwn ? "text-black/55" : "text-text-muted"}`}>
                    {formatTime(message.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {(error || localError) && (
        <div className="mx-4 mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {localError || error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="portal-dm-composer border-t border-[rgba(255,255,255,0.06)] p-3 sm:p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              event.currentTarget.style.height = "auto";
              event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 120)}px`;
            }}
            placeholder={composerPlaceholder}
            rows={1}
            maxLength={4000}
            className="min-h-11 max-h-[7.5rem] flex-1 resize-none overflow-y-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-bg-primary px-4 py-3 text-base leading-5 text-text-primary placeholder:text-text-muted focus:border-accent-bright focus:outline-none"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label={sending ? "Sending message" : "Send message"}
            title="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-bright text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 19V5m0 0-6 6m6-6 6 6" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
