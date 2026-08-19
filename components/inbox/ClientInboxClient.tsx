"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import InboxThread from "@/components/inbox/InboxThread";
import { useToast } from "@/components/ui/Toast";
import { hasUnreadIncomingMessages } from "@/lib/inbox-client";
import type { InboxMessage } from "@/lib/types";

interface ThreadResponse {
  clientId: string;
  clientName: string;
  clientEmail: string;
  viewerUserId: string;
  messages: InboxMessage[];
}

export default function ClientInboxClient() {
  const { toast } = useToast();
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadAbortController = useRef<AbortController | null>(null);

  const loadThread = useCallback(async () => {
    threadAbortController.current?.abort();
    const controller = new AbortController();
    threadAbortController.current = controller;

    try {
      const res = await fetch("/api/inbox/thread", { signal: controller.signal });
      if (!res.ok) throw new Error("Could not load your DMs.");
      const data = await res.json() as ThreadResponse;
      if (controller.signal.aborted) return;
      setThread(data);
      setError(null);
      if (hasUnreadIncomingMessages(data.messages || [], "client")) {
        await fetch("/api/inbox/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          signal: controller.signal,
        });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Could not load your DMs.");
    } finally {
      if (threadAbortController.current === controller) {
        threadAbortController.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadThread();
    const refreshVisibleThread = () => {
      if (!document.hidden) void loadThread();
    };
    const interval = setInterval(refreshVisibleThread, 30000);
    document.addEventListener("visibilitychange", refreshVisibleThread);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshVisibleThread);
      threadAbortController.current?.abort();
    };
  }, [loadThread]);

  useEffect(() => {
    document.documentElement.classList.add("portal-dm-active");
    return () => document.documentElement.classList.remove("portal-dm-active");
  }, []);

  async function handleSend(message: string) {
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send message.");
      }

      const data = await res.json();
      setThread((current) => current && data.message
        ? { ...current, messages: [...current.messages, data.message] }
        : current);
      toast("Message sent");
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Failed to send message.";
      setError(messageText);
      toast("Failed to send message", "error");
      throw new Error(messageText);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="portal-dm-page mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col overflow-hidden px-0 py-1 sm:py-0">
      <div className="portal-dm-page-header mb-4 shrink-0 sm:mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-bright">Direct Messages</div>
        <h1 className="mt-2 text-2xl font-heading font-extrabold text-text-primary">DM</h1>
        <p className="mt-1 text-sm text-text-secondary">Message Gordy directly from your AT CAPACITY portal.</p>
      </div>

      {loading ? (
        <div className="flex min-h-0 flex-1 animate-pulse flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)]">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <div className="h-4 w-28 rounded bg-white/[0.08]" />
            <div className="mt-2 h-3 w-20 rounded bg-white/[0.05]" />
          </div>
          <div className="flex flex-1 flex-col justify-end gap-4 px-4 py-5">
            <div className="h-16 w-2/3 rounded-2xl bg-white/[0.05]" />
            <div className="ml-auto h-20 w-3/4 rounded-2xl bg-accent/10" />
            <div className="h-14 w-1/2 rounded-2xl bg-white/[0.05]" />
          </div>
          <div className="border-t border-white/[0.06] p-3">
            <div className="h-11 rounded-xl bg-white/[0.06]" />
          </div>
        </div>
      ) : (
        <InboxThread
          messages={thread?.messages ?? []}
          currentRole="client"
          onSend={handleSend}
          sending={sending}
          error={error}
          emptyTitle="Start the conversation"
          emptyDescription="Ask a question, check something in your plan, or send Gordy a quick update here."
          composerPlaceholder="Message Gordy..."
          threadLabel="Gordy Elliott"
          threadMeta="AT CAPACITY"
        />
      )}
    </div>
  );
}
