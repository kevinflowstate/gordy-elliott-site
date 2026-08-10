"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  calendarProviderLabel,
  type CalendarConnection,
  type CalendarProvider,
} from "@/lib/composio/types";

type ProviderOption = {
  provider: CalendarProvider;
  label: string;
  configured: boolean;
};

type ConnectionWithCount = Pick<
  CalendarConnection,
  "id" | "provider" | "status" | "last_sync_at" | "connected_at" | "disconnected_at" | "created_at" | "updated_at"
> & { event_count: number };

type IntegrationsResponse = {
  available: boolean;
  providers: ProviderOption[];
  connections: ConnectionWithCount[];
};

function statusLabel(status: CalendarConnection["status"]) {
  if (status === "connected") return "Connected";
  if (status === "connecting") return "Available";
  if (status === "needs_reauth") return "Reconnect needed";
  if (status === "error") return "Needs attention";
  return "Not connected";
}

function formatSyncDate(value: string | null) {
  if (!value) return "Not synced yet";
  return `Last synced ${new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function CalendarConnections({
  onEventsChanged,
}: {
  onEventsChanged: () => void;
}) {
  const [data, setData] = useState<IntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const browserFinishedListener = useRef<PluginListenerHandle | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/calendar-integrations", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Connected calendars could not be loaded.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Connected calendars could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callbackState = params.get("calendar");
    const provider = params.get("provider") as CalendarProvider | null;
    if (callbackState === "connected") {
      setNotice(`${provider ? calendarProviderLabel(provider) : "Calendar"} connected and synced.`);
      onEventsChanged();
    } else if (callbackState === "error") {
      setError("The calendar connection did not finish. Please try again.");
    }
    if (callbackState) {
      params.delete("calendar");
      params.delete("provider");
      const nextQuery = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`);
    }
    load();
  }, [load, onEventsChanged]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void browserFinishedListener.current?.remove();
    };
  }, []);

  async function connect(provider: CalendarProvider) {
    setActiveAction(`connect:${provider}`);
    setError(null);
    setNotice(null);
    let listener: PluginListenerHandle | null = null;
    try {
      const response = await fetch(`/api/portal/calendar-integrations/providers/${provider}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ native: Capacitor.isNativePlatform() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Calendar connection could not be started.");
      if (payload.redirectUrl) {
        if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Browser")) {
          await browserFinishedListener.current?.remove();
          listener = await Browser.addListener("browserFinished", () => {
            void (async () => {
              await listener?.remove();
              if (browserFinishedListener.current === listener) browserFinishedListener.current = null;
              await load();
              onEventsChanged();
            })();
          });
          if (!mounted.current) {
            await listener.remove();
            return;
          }
          browserFinishedListener.current = listener;
          await Browser.open({ url: payload.redirectUrl });
          return;
        }
        window.location.assign(payload.redirectUrl);
        return;
      }
      setNotice(`${calendarProviderLabel(provider)} connected and synced.`);
      await load();
      onEventsChanged();
    } catch (connectError) {
      await listener?.remove();
      if (browserFinishedListener.current === listener) browserFinishedListener.current = null;
      setError(connectError instanceof Error ? connectError.message : "Calendar connection could not be started.");
    } finally {
      setActiveAction(null);
    }
  }

  async function sync(connection: ConnectionWithCount) {
    setActiveAction(`sync:${connection.id}`);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/portal/calendar-integrations/connections/${connection.id}/sync`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Calendar sync failed.");
      setNotice(`${calendarProviderLabel(connection.provider)} is up to date.`);
      await load();
      onEventsChanged();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Calendar sync failed.");
      await load();
    } finally {
      setActiveAction(null);
    }
  }

  async function disconnect(connection: ConnectionWithCount) {
    if (!window.confirm(`Disconnect ${calendarProviderLabel(connection.provider)} and remove its synced events?`)) {
      return;
    }
    setActiveAction(`disconnect:${connection.id}`);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/portal/calendar-integrations/connections/${connection.id}/disconnect`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Calendar could not be disconnected.");
      setNotice(`${calendarProviderLabel(connection.provider)} disconnected.`);
      await load();
      onEventsChanged();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Calendar could not be disconnected.");
    } finally {
      setActiveAction(null);
    }
  }

  if (loading) {
    return <div className="mb-6 h-36 animate-pulse rounded-xl bg-[rgba(0,0,0,0.05)]" />;
  }

  return (
    <section className="mb-6 border-y border-[rgba(0,0,0,0.06)] py-5" aria-labelledby="connected-calendars-heading">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-bright">Connected calendars</div>
          <h2 id="connected-calendars-heading" className="mt-1 text-lg font-heading font-bold text-text-primary">
            Bring your week into one view
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-text-secondary">
            Read-only access syncs event times and titles for the next seven days. Private events appear as Busy.
            AT CAPACITY uses your schedule to show meeting load and help you and Gordy plan training and nutrition around busier weeks.
          </p>
        </div>
      </div>

      {(notice || error) && (
        <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${
          error
            ? "border-red-500/20 bg-red-500/10 text-red-400"
            : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
        }`}>
          {error || notice}
        </div>
      )}

      <section
        className="mb-4 rounded-xl border border-[#4285F4]/25 bg-[#4285F4]/[0.06] p-4"
        aria-labelledby="google-calendar-disclosure-heading"
        id="google-calendar-consent-summary"
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#4285F4]">Before you connect Google Calendar</div>
        <h3 id="google-calendar-disclosure-heading" className="mt-1 text-sm font-bold text-text-primary">
          Read-only schedule access, with AI kept separate
        </h3>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-text-secondary">
          <li>
            <span className="font-semibold text-text-primary">Access:</span>{" "}
            calendar identifiers and event titles, times, busy/all-day status and meeting links for today and the next seven days. Private events appear as Busy.
          </li>
          <li>
            <span className="font-semibold text-text-primary">Use:</span>{" "}
            your schedule, meeting load, deterministic Capacity Checker and Storm Warning, and Gordy&apos;s coaching view.
          </li>
          <li>
            <span className="font-semibold text-text-primary">Handling:</span>{" "}
            Composio processes the secure Google connection, Vercel processes the app request and Supabase stores the limited synced copy. Google Calendar data is never sent to Anthropic, OpenRouter or a downstream AI model, and is never used for advertising or general-purpose AI training.
          </li>
        </ul>
        <p className="mt-3 text-[11px] leading-5 text-text-muted">
          Disconnecting stops future access and removes AT CAPACITY&apos;s synced event copies. See the{" "}
          <Link href="/privacy" className="font-semibold text-accent-bright">Privacy Policy</Link>.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {(data?.providers || []).map((provider) => {
          const connection = data?.connections.find((item) => item.provider === provider.provider);
          const connected = connection?.status === "connected";
          const canConnect = provider.configured && !connected;
          const providerAction = activeAction === `connect:${provider.provider}`;
          return (
            <div key={provider.provider} className="rounded-lg border border-[rgba(0,0,0,0.07)] bg-bg-card p-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg text-sm font-bold text-white ${
                  provider.provider === "google_calendar" ? "bg-[#4285F4]" : "bg-[#0078D4]"
                }`}>
                  {provider.provider === "google_calendar" ? "G" : "O"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">{provider.label}</h3>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                      connected ? "text-emerald-400" : connection?.status === "error" || connection?.status === "needs_reauth"
                        ? "text-amber-400"
                        : "text-text-muted"
                    }`}>
                      {connection ? statusLabel(connection.status) : provider.configured ? "Available" : "Coming soon"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {connection?.last_sync_at
                      ? `${formatSyncDate(connection.last_sync_at)} · ${connection.event_count} upcoming`
                      : provider.configured
                        ? "Connect securely through Composio."
                        : `${provider.label} connection is being prepared.`}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {connected && connection ? (
                  <>
                    <button
                      type="button"
                      onClick={() => disconnect(connection)}
                      disabled={Boolean(activeAction)}
                      className="rounded-lg px-3 py-2 text-xs font-semibold text-text-muted disabled:opacity-50"
                    >
                      {activeAction === `disconnect:${connection.id}` ? "Disconnecting..." : "Disconnect"}
                    </button>
                    <button
                      type="button"
                      onClick={() => sync(connection)}
                      disabled={Boolean(activeAction)}
                      className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent-bright disabled:opacity-50"
                    >
                      {activeAction === `sync:${connection.id}` ? "Syncing..." : "Sync now"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => connect(provider.provider)}
                    disabled={!canConnect || Boolean(activeAction)}
                    aria-describedby={provider.provider === "google_calendar" ? "google-calendar-consent-summary" : undefined}
                    className="rounded-lg gradient-accent px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {providerAction
                      ? "Opening..."
                      : connection?.status === "needs_reauth" || connection?.status === "error"
                        ? `Reconnect ${provider.label}`
                        : `Connect ${provider.label}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
