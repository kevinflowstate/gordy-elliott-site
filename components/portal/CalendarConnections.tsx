"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  CALENDAR_CONSENT_VERSION,
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
  "id" | "provider" | "status" | "last_sync_at" | "connected_at" | "disconnected_at" | "consent_version" | "consented_at" | "created_at" | "updated_at"
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
  const [consentProvider, setConsentProvider] = useState<CalendarProvider | null>(null);
  const browserFinishedListener = useRef<PluginListenerHandle | null>(null);
  const consentContinueRef = useRef<HTMLButtonElement | null>(null);
  const consentTriggerRef = useRef<HTMLButtonElement | null>(null);
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

  useEffect(() => {
    if (!consentProvider) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => consentContinueRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConsentProvider(null);
        window.requestAnimationFrame(() => consentTriggerRef.current?.focus());
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [consentProvider]);

  function closeConsent() {
    setConsentProvider(null);
    window.requestAnimationFrame(() => consentTriggerRef.current?.focus());
  }

  function requestConnect(provider: CalendarProvider, trigger: HTMLButtonElement) {
    consentTriggerRef.current = trigger;
    const hasCurrentCalendarConsent = data?.connections.some(
      (connection) => connection.consent_version === CALENDAR_CONSENT_VERSION && Boolean(connection.consented_at),
    );
    if (!hasCurrentCalendarConsent) {
      setConsentProvider(provider);
      return;
    }
    void connect(provider);
  }

  function continueFromConsent() {
    if (!consentProvider) return;
    const provider = consentProvider;
    setConsentProvider(null);
    void connect(provider);
  }

  async function connect(provider: CalendarProvider) {
    setActiveAction(`connect:${provider}`);
    setError(null);
    setNotice(null);
    let listener: PluginListenerHandle | null = null;
    try {
      const response = await fetch(`/api/portal/calendar-integrations/providers/${provider}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          native: Capacitor.isNativePlatform(),
          consentVersion: CALENDAR_CONSENT_VERSION,
        }),
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
            Plan around real life
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-text-secondary">
            Connect your calendar to sync AT CAPACITY with your week, helping you and Gordy plan training and nutrition around your busiest days.
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
                        ? "Securely connect your account."
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
                    onClick={(event) => requestConnect(provider.provider, event.currentTarget)}
                    disabled={!canConnect || Boolean(activeAction)}
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

      {consentProvider && typeof document !== "undefined" && createPortal((
        <div
          className="fixed inset-0 z-[1000] flex h-[100dvh] items-end justify-center bg-black/70 px-2 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-4"
          onClick={closeConsent}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-consent-title"
            aria-describedby="calendar-consent-description"
            className="w-full max-w-md rounded-t-[28px] border border-white/[0.10] bg-[#111114] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:rounded-[28px] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F060E0]">One quick check</div>
                <h3 id="calendar-consent-title" className="mt-1.5 text-xl font-heading font-bold text-white">
                  Connect {calendarProviderLabel(consentProvider)}?
                </h3>
                <p id="calendar-consent-description" className="mt-2 text-sm leading-6 text-white/60">
                  AT CAPACITY uses your next seven days to help plan training and nutrition around your schedule.
                </p>
              </div>
              <button
                type="button"
                onClick={closeConsent}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/[0.10] bg-white/[0.05] text-white/70"
                aria-label="Close calendar connection"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              <div className="flex gap-3 py-3.5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E040D0]/12 text-[#F060E0]" aria-hidden="true">✓</span>
                <div>
                  <p className="text-sm font-semibold text-white">Read-only</p>
                  <p className="mt-0.5 text-xs leading-5 text-white/50">We can&apos;t add, edit or delete anything in your calendar.</p>
                </div>
              </div>
              <div className="flex gap-3 py-3.5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E040D0]/12 text-[#F060E0]" aria-hidden="true">7</span>
                <div>
                  <p className="text-sm font-semibold text-white">Only what helps</p>
                  <p className="mt-0.5 text-xs leading-5 text-white/50">We sync event times and titles for seven days. Private events appear as Busy.</p>
                </div>
              </div>
              <div className="flex gap-3 py-3.5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E040D0]/12 text-[#F060E0]" aria-hidden="true">×</span>
                <div>
                  <p className="text-sm font-semibold text-white">You stay in control</p>
                  <p className="mt-0.5 text-xs leading-5 text-white/50">Your calendar isn&apos;t used for ads or sent to AI. Disconnecting removes the synced copy.</p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] leading-5 text-white/40">
              See how your data is handled in the{" "}
              <Link href="/privacy" className="font-semibold text-[#F060E0]">Privacy Policy</Link>.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-[0.7fr_1.3fr]">
              <button
                type="button"
                onClick={closeConsent}
                className="min-h-12 rounded-xl border border-white/[0.10] px-4 text-sm font-semibold text-white/65"
              >
                Not now
              </button>
              <button
                ref={consentContinueRef}
                type="button"
                onClick={continueFromConsent}
                className="min-h-12 rounded-xl bg-[#E040D0] px-4 text-sm font-bold text-white transition-colors hover:bg-[#F060E0]"
              >
                Continue to {consentProvider === "google_calendar" ? "Google" : "Microsoft"}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </section>
  );
}
