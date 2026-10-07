"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { useCallback, useEffect, useRef, useState } from "react";
import HealthCapacityOverview from "@/components/portal/HealthCapacityOverview";
import WearableConnectionsPanel, { wearableProviders } from "@/components/portal/WearableConnectionsPanel";
import { useToast } from "@/components/ui/Toast";
import type { WearableConnection, WearableDailySummary } from "@/lib/wearable-insights";
import { matchesTerraConnectionAttempt } from "@/lib/terra/events";

type IntegrationsPayload = {
  mockMode: boolean;
  available: boolean;
  providerAvailability: { whoop: boolean };
  consentAccepted: boolean;
  connections: WearableConnection[];
  latestSummary: WearableDailySummary | null;
  summaries: WearableDailySummary[];
};

type HealthSyncPayload = {
  accepted?: boolean;
  partial?: boolean;
  error?: string;
  results?: Array<{ provider: string; dataType: string; accepted: boolean }>;
};

export default function ConnectedAppsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<IntegrationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [view, setView] = useState<"health" | "connections">("health");
  const handledReturn = useRef(false);
  const consentTouched = useRef(false);
  const verificationRun = useRef(0);
  const disposed = useRef(false);
  const browserFinishedListener = useRef<PluginListenerHandle | null>(null);

  const requestHealthSync = useCallback(async () => {
    const response = await fetch("/api/portal/integrations/terra/sync", { method: "POST" });
    const payload = await response.json().catch(() => ({})) as HealthSyncPayload;
    if (response.status === 409) return { requested: false, partial: false };
    if (!response.ok) throw new Error(payload.error || "Connected health data could not be refreshed yet.");
    return { requested: Boolean(payload.accepted), partial: Boolean(payload.partial) };
  }, []);

  const load = useCallback(async (showLoading = true): Promise<IntegrationsPayload | null> => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/portal/integrations");
      const json = await res.json() as IntegrationsPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Couldn't load connected apps");
      setData(json);
      setLoadError(null);
      if (!consentTouched.current) setConsentAccepted(json.consentAccepted);
      return json;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load connected apps";
      setLoadError(message);
      toast(message, "error");
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const syncView = () => {
      const params = new URLSearchParams(window.location.search);
      setView(params.get("view") === "connections" ? "connections" : "health");
    };
    syncView();
    window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, []);

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      verificationRun.current += 1;
      void browserFinishedListener.current?.remove();
    };
  }, []);

  const verifyConnection = useCallback(async (provider: string, attempt?: string, userId?: string) => {
    if (disposed.current) return;
    const run = ++verificationRun.current;
    setConnecting(provider);
    try {
      for (let index = 0; index < 10; index += 1) {
        if (run !== verificationRun.current) return;
        if (index % 2 === 0 || index === 9) {
          const response = await fetch("/api/portal/integrations/terra/reconcile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider, attempt, userId }),
          });
          const result = await response.json().catch(() => ({}));
          if (run !== verificationRun.current) return;
          if (result.staleAttempt) {
            await load(false);
            toast("This return belongs to an earlier connection attempt. Check the current status below.", "info");
            return;
          }
          if (!response.ok) throw new Error(result.error || "The connection could not be verified yet. Please try again.");
        }
        const refreshed = await load(false);
        if (run !== verificationRun.current || !refreshed) return;
        const connection = refreshed.connections.find((item) => item.provider === provider);
        if (attempt && !matchesTerraConnectionAttempt(connection?.consented_at, attempt)) return;
        if (connection?.status === "connected") {
          await requestHealthSync().catch(() => null);
          if (run !== verificationRun.current) return;
          toast(`${wearableProviders.find((item) => item.id === provider)?.name || "App"} connected. Data may take a moment to arrive.`);
          return;
        }
        if (connection?.status === "error" || connection?.status === "disconnected") {
          toast("That connection wasn't completed. Choose Reconnect to try again.", "error");
          return;
        }
        if (index < 9) await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
      if (run === verificationRun.current) toast("We haven't verified this connection yet. If you closed the provider window, choose Reconnect to try again.", "info");
    } catch (error) {
      if (run === verificationRun.current) toast(error instanceof Error ? error.message : "The connection could not be verified yet. Please try again.", "error");
    } finally {
      if (run === verificationRun.current) setConnecting(null);
    }
  }, [load, requestHealthSync, toast]);

  function clearReturnParams() {
    if (disposed.current || window.location.pathname !== "/portal/connected-apps") return;
    const url = new URL(window.location.href);
    for (const key of ["terra", "provider", "attempt", "user_id"]) url.searchParams.delete(key);
    url.searchParams.set("view", "connections");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  useEffect(() => {
    if (handledReturn.current) return;
    const params = new URLSearchParams(window.location.search);
    const terraResult = params.get("terra");
    const provider = params.get("provider");
    const attempt = params.get("attempt") || undefined;
    const userId = params.get("user_id") || undefined;
    if (!terraResult) return;
    handledReturn.current = true;
    setView("connections");

    if (terraResult === "failed") {
      void (async () => {
        try {
          if (provider && attempt) {
            const response = await fetch("/api/portal/integrations/terra/session", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider, attempt }),
            });
            const result = await response.json().catch(() => ({}));
            if (result.staleAttempt) {
              await load(false);
              toast("This return belongs to an earlier connection attempt. Check the current status below.", "info");
              return;
            }
            if (!response.ok && response.status !== 409) throw new Error("Connection status could not be updated. Please refresh and try again.");
          }
          await load(false);
          toast("That connection wasn't completed. Check the current status below and reconnect when you're ready.", "error");
        } catch (error) {
          toast(error instanceof Error ? error.message : "Connection status could not be checked.", "error");
        } finally {
          clearReturnParams();
        }
      })();
      return;
    }
    if (terraResult !== "success" || !provider) return;

    void verifyConnection(provider, attempt, userId).finally(clearReturnParams);
  }, [load, verifyConnection, toast]);

  async function connect(provider: string) {
    if (!consentAccepted || connecting) return;
    handledReturn.current = false;
    setConnecting(provider);
    let listener: PluginListenerHandle | null = null;
    let attemptStartedAt: string | undefined;
    try {
      const res = await fetch("/api/portal/integrations/terra/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          consent: consentAccepted,
          native: Capacitor.isNativePlatform(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't start connection");
      if (disposed.current) return;
      attemptStartedAt = json.attemptStartedAt;
      setData((current) => current ? { ...current, consentAccepted: true } : current);

      if (json.mock) {
        toast("Preview connection added");
        await load();
        return;
      }

      if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Browser")) {
        await browserFinishedListener.current?.remove();
        listener = await Browser.addListener("browserFinished", () => {
          void (async () => {
            await listener?.remove();
            if (browserFinishedListener.current === listener) browserFinishedListener.current = null;
            await new Promise((resolve) => setTimeout(resolve, 1_500));
            if (handledReturn.current || disposed.current) return;

            await verifyConnection(provider, attemptStartedAt);
          })();
        });
        browserFinishedListener.current = listener;
        await Browser.open({ url: json.url });
      } else {
        window.location.assign(json.url);
      }
    } catch (err) {
      await listener?.remove();
      if (browserFinishedListener.current === listener) browserFinishedListener.current = null;
      if (attemptStartedAt) {
        await fetch("/api/portal/integrations/terra/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, attempt: attemptStartedAt }),
        }).catch(() => null);
        await load(false);
      }
      toast(err instanceof Error ? err.message : "Couldn't connect that app", "error");
    } finally {
      setConnecting(null);
    }
  }

  async function disconnect(connection: WearableConnection) {
    setDisconnecting(connection.id);
    try {
      const res = await fetch(`/api/portal/integrations/${connection.id}/disconnect`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't disconnect");
      toast("Connection disconnected");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't disconnect", "error");
    } finally {
      setDisconnecting(null);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const sync = await requestHealthSync();
      if (sync.requested) await new Promise((resolve) => setTimeout(resolve, 1_500));
      await load(false);
      if (sync.requested) {
        toast(
          sync.partial
            ? "Health refresh started. One connected source may take a little longer."
            : "Health refresh started. New data can take a moment to appear.",
          "info",
        );
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Health data could not be refreshed yet.", "error");
    } finally {
      setRefreshing(false);
    }
  }

  function openConnections() {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "connections");
    url.searchParams.delete("terra");
    url.searchParams.delete("provider");
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
    setView("connections");
  }

  function closeConnections() {
    const url = new URL(window.location.href);
    if (url.searchParams.get("view") === "connections") {
      window.history.back();
      return;
    }
    setView("health");
  }

  if (loadError && !data && !loading) {
    return (
      <div className="mx-auto flex min-h-[58vh] w-full max-w-3xl items-center justify-center pb-28 sm:pb-8">
        <div className="w-full rounded-[28px] border border-red-400/15 bg-red-400/[0.055] p-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-white">Health data could not load</h1>
          <p className="mt-2 text-sm leading-6 text-white/52">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 min-h-11 rounded-full bg-[#f7f4f7] px-5 text-sm font-bold text-[#171419]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (view === "connections") {
    return (
      <WearableConnectionsPanel
        connections={data?.connections || []}
        consentAccepted={consentAccepted}
        available={Boolean(data?.available) && !loading}
        mockMode={Boolean(data?.mockMode)}
        whoopAvailable={Boolean(data?.providerAvailability?.whoop)}
        connecting={connecting}
        disconnecting={disconnecting}
        onConsentChange={(accepted) => { consentTouched.current = true; setConsentAccepted(accepted); }}
        onConnect={(provider) => void connect(provider)}
        onDisconnect={(connection) => void disconnect(connection)}
        onBack={closeConnections}
      />
    );
  }

  return (
    <HealthCapacityOverview
      summaries={data?.summaries || []}
      connections={data?.connections || []}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      onManageConnections={openConnections}
    />
  );
}
