"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import InboxThread from "@/components/inbox/InboxThread";
import { useToast } from "@/components/ui/Toast";
import type { CommunityMessage, UserRole } from "@/lib/types";

type CommunityResponse = {
  viewerUserId: string;
  role: UserRole;
  messages: CommunityMessage[];
};

export default function ShiftCommunityClient({ adminMode = false }: { adminMode?: boolean }) {
  const { toast } = useToast();
  const [community, setCommunity] = useState<CommunityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadCommunity = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/community", { signal: controller.signal, cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The SHIFT community could not be loaded.");
      if (!controller.signal.aborted) {
        setCommunity(data as CommunityResponse);
        setError(null);
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "The SHIFT community could not be loaded.");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadCommunity();
    const refresh = () => { if (!document.hidden) void loadCommunity(); };
    const interval = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      abortRef.current?.abort();
    };
  }, [loadCommunity]);

  useEffect(() => {
    if (adminMode) return;
    document.documentElement.classList.add("portal-dm-active");
    return () => document.documentElement.classList.remove("portal-dm-active");
  }, [adminMode]);

  async function sendText(message: string) {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Message could not be sent.");
      setCommunity((current) => current && data.message ? { ...current, messages: [...current.messages, data.message] } : current);
      toast("Posted to SHIFT");
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Message could not be sent.";
      setError(messageText);
      toast(messageText, "error");
      throw err;
    } finally {
      setSending(false);
    }
  }

  async function sendMedia(mediaType: "audio" | "image" | "file", file: File, durationSeconds?: number) {
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("media_type", mediaType);
      form.set("media", file);
      if (durationSeconds) form.set("duration_seconds", String(durationSeconds));
      const response = await fetch("/api/community/media", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Attachment could not be sent.");
      setCommunity((current) => current && data.message ? { ...current, messages: [...current.messages, data.message] } : current);
      toast(mediaType === "audio" ? "Voice note posted" : mediaType === "image" ? "Photo posted" : "File posted");
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Attachment could not be sent.";
      setError(messageText);
      toast(messageText, "error");
      throw err;
    } finally {
      setSending(false);
    }
  }

  async function removeMessage(messageId: string) {
    if (!adminMode || !window.confirm("Remove this message from the SHIFT community?")) return;
    const response = await fetch(`/api/community/${encodeURIComponent(messageId)}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast(data.error || "Message could not be removed", "error");
      return;
    }
    setCommunity((current) => current ? { ...current, messages: current.messages.filter((message) => message.id !== messageId) } : current);
    toast("Message removed");
  }

  return (
    <div className={`${adminMode ? "space-y-5" : "portal-dm-page mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col overflow-hidden px-0 py-1 sm:py-0"}`}>
      <div className={adminMode ? "" : "portal-dm-page-header mb-4 shrink-0 sm:mb-5"}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-bright">SHIFT members</div>
        <h1 className="mt-2 text-2xl font-heading font-extrabold text-text-primary">Community</h1>
        <p className="mt-1 text-sm text-text-secondary">A shared space for SHIFT clients and Gordy.</p>
      </div>

      <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-xs leading-relaxed text-text-secondary">
        <strong className="text-text-primary">This is a group conversation.</strong> Every active SHIFT client can see what is posted here. Use DM for personal coaching, health information or anything private.
      </div>

      {loading ? (
        <div className="flex min-h-80 flex-1 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.025] text-sm text-text-muted">Loading the community…</div>
      ) : error && !community ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">{error}</div>
      ) : (
        <div className={adminMode ? "min-h-[min(76dvh,52rem)]" : "min-h-0 flex-1"}>
          <InboxThread
            messages={community?.messages ?? []}
            currentRole={adminMode ? "admin" : "client"}
            viewerUserId={community?.viewerUserId}
            onSend={sendText}
            onSendAudio={(audio, duration) => sendMedia("audio", new File([audio], "voice-note", { type: audio.type }), duration)}
            onSendImage={(image) => sendMedia("image", image)}
            onSendFile={(file) => sendMedia("file", file)}
            onDeleteMessage={adminMode ? removeMessage : undefined}
            sending={sending}
            error={error}
            emptyTitle="Start the SHIFT conversation"
            emptyDescription={adminMode ? "Post the first update, prompt or coaching note for the SHIFT group." : "Gordy will use this space for shared SHIFT updates and discussion."}
            composerPlaceholder="Post to the SHIFT community…"
            threadLabel="SHIFT Community"
            threadMeta="Visible to active SHIFT clients and Gordy"
            attachmentContext="It will be visible to every active SHIFT client and Gordy."
          />
        </div>
      )}
    </div>
  );
}
