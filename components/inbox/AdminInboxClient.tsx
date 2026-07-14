"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import InboxThread from "@/components/inbox/InboxThread";
import { useToast } from "@/components/ui/Toast";
import type { InboxConversation, InboxMessage } from "@/lib/types";

interface ThreadResponse {
  clientId: string;
  clientName: string;
  clientEmail: string;
  viewerUserId: string;
  messages: InboxMessage[];
}

function formatRelativeTime(timestamp: string | null) {
  if (!timestamp) return "No messages";
  const diffMinutes = Math.max(1, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function AdminInboxClient() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clientParam = searchParams.get("client");
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientParam);
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredConversations = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return conversations;
    return conversations.filter((conversation) =>
      [conversation.client_name, conversation.client_email, conversation.latest_message]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(trimmed),
    );
  }, [conversations, query]);

  const selectedConversation = conversations.find((conversation) => conversation.client_id === selectedClientId) ?? null;

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox");
      if (!res.ok) throw new Error("Could not load DM conversations.");
      const data = await res.json();
      setConversations(data.conversations || []);
      setSelectedClientId((current) => current || data.conversations?.[0]?.client_id || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load DM conversations.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadThread = useCallback(async (clientId: string) => {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/inbox/thread?client_id=${encodeURIComponent(clientId)}`);
      if (!res.ok) throw new Error("Could not load conversation.");
      const data = await res.json();
      setThread(data);
      setError(null);
      await fetch("/api/inbox/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversation.");
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedClientId) return;
    void loadThread(selectedClientId);
    const interval = setInterval(() => loadThread(selectedClientId), 10000);
    return () => clearInterval(interval);
  }, [selectedClientId, loadThread]);

  useEffect(() => {
    if (clientParam === selectedClientId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (selectedClientId) params.set("client", selectedClientId);
    else params.delete("client");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }, [clientParam, pathname, router, searchParams, selectedClientId]);

  async function handleSend(message: string) {
    if (!selectedClientId) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: selectedClientId, message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send message.");
      }

      toast("Message sent");
      await Promise.all([loadConversations(), loadThread(selectedClientId)]);
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
    <div className="space-y-5">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-bright">Direct Messages</div>
        <h1 className="mt-2 text-2xl font-heading font-bold text-text-primary">DM</h1>
        <p className="mt-1 text-sm text-text-secondary">Message clients directly and keep replies in one place.</p>
      </div>

      <div className="grid min-h-[min(76dvh,52rem)] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] lg:grid-cols-[21rem_1fr]">
        <aside className="border-b border-[rgba(255,255,255,0.08)] lg:border-b-0 lg:border-r">
          <div className="border-b border-[rgba(255,255,255,0.06)] p-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search clients..."
              className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-bright focus:outline-none"
            />
          </div>

          <div className="max-h-[26rem] overflow-y-auto lg:max-h-[calc(min(76dvh,52rem)-4.5rem)]">
            {loadingList ? (
              <div className="p-4 text-sm text-text-muted">Loading conversations...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-sm text-text-muted">No clients found.</div>
            ) : (
              filteredConversations.map((conversation) => {
                const isSelected = conversation.client_id === selectedClientId;
                return (
                  <button
                    key={conversation.client_id}
                    type="button"
                    onClick={() => setSelectedClientId(conversation.client_id)}
                    className={`w-full border-b border-[rgba(255,255,255,0.05)] px-4 py-3 text-left transition-colors ${
                      isSelected ? "bg-accent/10" : "hover:bg-[rgba(255,255,255,0.035)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-text-primary">{conversation.client_name}</div>
                        <div className="truncate text-xs text-text-muted">{conversation.client_email}</div>
                      </div>
                      {conversation.unread_count > 0 && (
                        <span className="rounded-full bg-accent-bright px-2 py-0.5 text-[10px] font-bold text-black">
                          {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs text-text-secondary">
                      {conversation.latest_message || "No messages yet"}
                    </div>
                    <div className="mt-1 text-[10px] text-text-muted">{formatRelativeTime(conversation.latest_message_at)}</div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="min-w-0">
          {selectedClientId && selectedConversation ? (
            loadingThread && !thread ? (
              <div className="p-6 text-sm text-text-muted">Loading conversation...</div>
            ) : (
              <InboxThread
                messages={thread?.messages ?? []}
                currentRole="admin"
                onSend={handleSend}
                sending={sending}
                error={error}
                emptyTitle="No messages yet"
                emptyDescription="Send the first message to start a direct conversation with this client."
                composerPlaceholder={`Message ${selectedConversation.client_name}...`}
                threadLabel={selectedConversation.client_name}
                threadMeta={selectedConversation.client_email}
              />
            )
          ) : (
            <div className="flex min-h-96 items-center justify-center p-6 text-sm text-text-muted">
              Select a client conversation.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
