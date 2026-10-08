"use client";

import { useCallback, useEffect, useState } from "react";

type Device = { platform: string; last_seen_at: string; disabled_at: string | null; failure_count: number; last_failure: string | null };
type Status = { devices: Device[]; webSubscriptions: number };

export default function ClientPushStatus({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(""); setStatus(null);
    try {
      const response = await fetch(`/api/admin/client-push-status?client_id=${encodeURIComponent(clientId)}`, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load notification status");
      if (!signal?.aborted) setStatus(data);
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "Could not load notification status");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [clientId]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const active = status?.devices.filter(d => !d.disabled_at) || [];
  return <section className="rounded-xl border border-white/10 bg-bg-card p-4 min-w-0" aria-label="Notification devices">
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-text-primary">Notification devices</h3><button type="button" disabled={loading} onClick={() => void load()} className="text-xs text-accent disabled:opacity-40">Refresh</button></div>
    {loading ? <p className="mt-2 text-xs text-text-muted">Checking registration…</p> : error ? <p className="mt-2 text-xs text-red-400" role="alert">{error}</p> : status && <>
      <p className="mt-2 text-xs text-text-secondary">Native app: {active.length} active · Browser: {status.webSubscriptions} registered</p>
      {!active.length && !status.webSubscriptions && <p className="mt-2 text-xs text-text-muted">No device registered. Ask the client to open the app while signed in and use Turn on notifications. If they previously declined, they may need to allow notifications in their phone settings.</p>}
      <ul className="mt-2 space-y-2">{status.devices.map((device, index) => <li key={index} className="text-xs text-text-muted break-words">
        <span className="font-medium text-text-secondary">{device.platform === "ios" ? "iPhone / iPad" : "Android"}: {device.disabled_at ? "registration disabled" : "registered"}</span>
        <span className="block">Last registered {new Date(device.last_seen_at).toLocaleString("en-GB")}</span>
        {device.last_failure && <span className="block text-red-400">Last failure: {device.last_failure}</span>}
      </li>)}</ul>
      <p className="mt-3 text-[11px] leading-relaxed text-text-muted">Registration does not confirm current phone permissions or that an alert appeared. Use Test Push, then ask the client to confirm receipt.</p>
    </>}
  </section>;
}
