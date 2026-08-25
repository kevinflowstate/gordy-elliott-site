"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import InboxThread from "@/components/inbox/InboxThread";
import { useToast } from "@/components/ui/Toast";
import { hasUnreadIncomingMessages } from "@/lib/inbox-client";
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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAudience, setBulkAudience] = useState<"all" | "capacity" | "shift" | "in_person">("all");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const conversationsRequestInFlight = useRef(false);
  const threadAbortController = useRef<AbortController | null>(null);

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
  const bulkRecipientCount = conversations.filter((conversation) => conversation.bulk_eligible && (bulkAudience === "all" || conversation.programme_type === bulkAudience)).length;

  const loadConversations = useCallback(async () => {
    if (conversationsRequestInFlight.current) return;
    conversationsRequestInFlight.current = true;
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
      conversationsRequestInFlight.current = false;
      setLoadingList(false);
    }
  }, []);

  const loadThread = useCallback(async (clientId: string) => {
    threadAbortController.current?.abort();
    const controller = new AbortController();
    threadAbortController.current = controller;
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/inbox/thread?client_id=${encodeURIComponent(clientId)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Could not load conversation.");
      const data = await res.json() as ThreadResponse;
      if (controller.signal.aborted) return;
      setThread(data);
      setError(null);
      if (hasUnreadIncomingMessages(data.messages || [], "admin")) {
        await fetch("/api/inbox/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId }),
          signal: controller.signal,
        });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Could not load conversation.");
    } finally {
      if (threadAbortController.current === controller) {
        threadAbortController.current = null;
        setLoadingThread(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadConversations();
    const refreshVisibleConversations = () => {
      if (!document.hidden) void loadConversations();
    };
    const interval = setInterval(refreshVisibleConversations, 30000);
    document.addEventListener("visibilitychange", refreshVisibleConversations);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshVisibleConversations);
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedClientId) return;
    void loadThread(selectedClientId);
    const refreshVisibleThread = () => {
      if (!document.hidden) void loadThread(selectedClientId);
    };
    const interval = setInterval(refreshVisibleThread, 30000);
    document.addEventListener("visibilitychange", refreshVisibleThread);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshVisibleThread);
      threadAbortController.current?.abort();
    };
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

  async function handleSendAudio(audio: Blob, durationSeconds: number) {
    if (!selectedClientId) return;
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("audio", new File([audio], "voice-note", { type: audio.type }));
      form.set("duration_seconds", String(durationSeconds));
      form.set("client_id", selectedClientId);
      const res = await fetch("/api/inbox/audio", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Voice note could not be sent.");
      toast("Voice note sent");
      await Promise.all([loadConversations(), loadThread(selectedClientId)]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Voice note could not be sent.";
      setError(message);
      toast(message, "error");
      throw err;
    } finally {
      setSending(false);
    }
  }

  async function handleSendImage(image: File) {
    if (!selectedClientId) return;
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("image", image);
      form.set("client_id", selectedClientId);
      const res = await fetch("/api/inbox/image", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Photo could not be sent.");
      toast("Photo sent");
      await Promise.all([loadConversations(), loadThread(selectedClientId)]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Photo could not be sent.";
      setError(message);
      toast(message, "error");
      throw err;
    } finally {
      setSending(false);
    }
  }

  async function handleBulkSend() {
    if (!bulkMessage.trim() || bulkRecipientCount === 0 || bulkSending) return;
    setBulkSending(true);
    try {
      const res = await fetch("/api/admin/inbox/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience: bulkAudience, message: bulkMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Bulk message failed");
      toast(`Message sent to ${data.sent} client${data.sent === 1 ? "" : "s"}`);
      setBulkMessage("");
      setBulkOpen(false);
      await loadConversations();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Bulk message failed", "error");
    } finally {
      setBulkSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-bright">Direct Messages</div>
          <h1 className="mt-2 text-2xl font-heading font-bold text-text-primary">DM</h1>
          <p className="mt-1 text-sm text-text-secondary">Message clients directly and keep replies in one place.</p>
        </div>
        <button type="button" onClick={() => setBulkOpen((open) => !open)} className="min-h-11 rounded-xl border border-accent/25 bg-accent/10 px-4 py-2.5 text-sm font-bold text-accent-bright">Message a group</button>
      </div>

      {bulkOpen && (
        <section className="rounded-2xl border border-accent/20 bg-[linear-gradient(135deg,rgba(224,64,208,0.08),rgba(255,255,255,0.02))] p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <select value={bulkAudience} onChange={(event) => setBulkAudience(event.target.value as typeof bulkAudience)} className="min-h-11 rounded-xl border border-white/10 bg-bg-primary px-3 text-sm font-semibold text-text-primary">
              <option value="all">Everyone</option><option value="capacity">CAPACITY</option><option value="shift">SHIFT</option><option value="in_person">IN PERSON</option>
            </select>
            <textarea value={bulkMessage} onChange={(event) => setBulkMessage(event.target.value)} rows={2} maxLength={4000} placeholder="Write one message for this group…" className="min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-text-muted">This creates a private DM for {bulkRecipientCount} client{bulkRecipientCount === 1 ? "" : "s"}. Replies stay individual.</div>
            <button type="button" onClick={() => void handleBulkSend()} disabled={!bulkMessage.trim() || !bulkRecipientCount || bulkSending} className="min-h-11 shrink-0 rounded-xl bg-accent-bright px-4 py-2 text-sm font-bold text-black disabled:opacity-40">{bulkSending ? "Sending…" : `Send to ${bulkRecipientCount}`}</button>
          </div>
        </section>
      )}

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
                onSendAudio={handleSendAudio}
                onSendImage={handleSendImage}
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
