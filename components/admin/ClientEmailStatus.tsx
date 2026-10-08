"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { EMAIL_STATUS_LABELS, type EmailDeliveryState, type EmailKind } from "@/lib/email-delivery";

type Attempt = { id: string; kind: EmailKind; status: EmailDeliveryState; status_at: string };
const KIND_LABELS: Record<EmailKind, string> = { setup: "Account setup", password_reset: "Password reset", migration: "App launch", consultation: "Consultation" };
export default function ClientEmailStatus({ clientId, refreshKey = 0 }: { clientId: string; refreshKey?: number }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loadedClientId, setLoadedClientId] = useState("");
  const pendingRequest = useRef<AbortController | null>(null);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    setLoading(true); setError(""); setAttempts([]); setConfigured(false);
    try {
      const response = await fetch(`/api/admin/client-email-status?client_id=${encodeURIComponent(clientId)}`, { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load email tracking");
      if (controller.signal.aborted) return;
      setAttempts(data.attempts); setLoadedClientId(clientId); setConfigured(data.webhookConfigured);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load email tracking"); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [clientId]);
  useEffect(() => { void load(); return () => pendingRequest.current?.abort(); }, [load, refreshKey]);
  const visibleAttempts = loadedClientId === clientId ? attempts : [];
  return <section className="rounded-xl border border-white/10 bg-bg-card p-4 min-w-0" aria-label="Client email delivery">
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Email delivery</h3>
      <button type="button" onClick={() => void load()} disabled={loading} className="text-xs text-text-secondary disabled:opacity-50">{loading ? "Loading…" : "Refresh"}</button></div>
    {loading ? <p className="text-xs text-text-muted mt-3">Checking email history…</p> : error ? <p className="text-xs text-red-400 mt-3" role="status">{error}</p> : <>
      {!configured && <p className="text-xs text-text-muted mt-3">Delivery events are not connected yet. Acceptance does not confirm inbox delivery.</p>}
      {!loading && !visibleAttempts.length && <p className="text-xs text-text-muted mt-3">No tracked sends yet. Earlier emails are unverified.</p>}
      <ul className="divide-y divide-white/5">{visibleAttempts.slice(0, 5).map((attempt) => <li key={attempt.id} className="py-3 text-xs flex flex-col sm:flex-row justify-between gap-2 sm:gap-4">
        <div><p className="text-text-secondary">{KIND_LABELS[attempt.kind]}</p><p className="mt-1">{EMAIL_STATUS_LABELS[attempt.status]}</p></div>
        <time className="text-text-muted break-words sm:shrink-0" dateTime={attempt.status_at}>{new Date(attempt.status_at).toLocaleString()}</time>
      </li>)}</ul>
      <p className="text-xs text-text-muted">Delivered means the receiving mail server accepted it; it does not confirm the client read it.</p>
    </>}
  </section>;
}
