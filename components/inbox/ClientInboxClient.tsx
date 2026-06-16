"use client";

import { useCallback, useEffect, useState } from "react";
import InboxThread from "@/components/inbox/InboxThread";
import { useToast } from "@/components/ui/Toast";
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

  const loadThread = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox/thread");
      if (!res.ok) throw new Error("Could not load your inbox.");
      const data = await res.json();
      setThread(data);
      setError(null);
      await fetch("/api/inbox/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your inbox.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadThread();
    const interval = setInterval(loadThread, 10000);
    return () => clearInterval(interval);
  }, [loadThread]);

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

      toast("Message sent");
      await loadThread();
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
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-0 sm:py-0">
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-bright">Coach Inbox</div>
        <h1 className="mt-2 text-2xl font-heading font-extrabold text-text-primary">Inbox</h1>
        <p className="mt-1 text-sm text-text-secondary">Message Gordy directly from your SHIFT portal.</p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] px-6 py-12 text-sm text-text-muted">
          Loading inbox...
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
          threadMeta="SHIFT Coaching"
        />
      )}
    </div>
  );
}
