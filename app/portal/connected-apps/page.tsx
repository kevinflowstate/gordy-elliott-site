"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { useCallback, useEffect, useRef, useState } from "react";
import HealthCapacityOverview from "@/components/portal/HealthCapacityOverview";
import WearableConnectionsPanel, { wearableProviders } from "@/components/portal/WearableConnectionsPanel";
import { useToast } from "@/components/ui/Toast";
import type { WearableConnection, WearableDailySummary } from "@/lib/wearable-insights";

type IntegrationsPayload = {
  mockMode: boolean;
  available: boolean;
  consentAccepted: boolean;
  connections: WearableConnection[];
  latestSummary: WearableDailySummary | null;
  summaries: WearableDailySummary[];
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
  const browserFinishedListener = useRef<PluginListenerHandle | null>(null);

  const load = useCallback(async (showLoading = true): Promise<IntegrationsPayload | null> => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/portal/integrations");
      const json = await res.json() as IntegrationsPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Couldn't load connected apps");
      setData(json);
      setLoadError(null);
      if (json.consentAccepted) setConsentAccepted(true);
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

  useEffect(() => () => {
    void browserFinishedListener.current?.remove();
  }, []);

  useEffect(() => {
    if (handledReturn.current) return;
    const params = new URLSearchParams(window.location.search);
    const terraResult = params.get("terra");
    const provider = params.get("provider");
    if (!terraResult) return;
    handledReturn.current = true;

    if (terraResult === "failed") {
      void (async () => {
        if (provider) {
          await fetch("/api/portal/integrations/terra/session", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider }),
          });
          await load(false);
        }
        toast("That connection wasn't completed. You can try again when you're ready.", "error");
        window.history.replaceState({}, "", window.location.pathname);
      })();
      return;
    }
    if (terraResult !== "success" || !provider) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const poll = async () => {
      if ([0, 2, 5, 9].includes(attempts)) {
        await fetch("/api/portal/integrations/terra/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        }).catch(() => null);
      }
      const refreshed = await load(false);
      if (cancelled || !refreshed) return;
      const connection = refreshed.connections.find((item) => item.provider === provider);
      if (connection?.status === "connected") {
        toast(`${wearableProviders.find((item) => item.id === provider)?.name || "App"} connected`);
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }
      if (connection?.status === "error" || attempts >= 9) {
        toast(
          connection?.status === "error"
            ? "That connection could not be completed. Please try again."
            : "Connection received. The first sync is still finishing.",
          connection?.status === "error" ? "error" : "info",
        );
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }
      attempts += 1;
      timeoutId = setTimeout(poll, 1_500);
    };
    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [load, toast]);

  async function connect(provider: string) {
    setConnecting(provider);
    let listener: PluginListenerHandle | null = null;
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
            if (handledReturn.current) return;

            await fetch("/api/portal/integrations/terra/reconcile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider }),
            }).catch(() => null);

            const refreshed = await load(false);
            const connection = refreshed?.connections.find((item) => item.provider === provider);
            if (connection?.status !== "pending") return;
            toast(
              "Connection received. Verification is still finishing; check again in a moment.",
              "info",
            );
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
      await load(false);
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
        available={data?.available !== false}
        mockMode={Boolean(data?.mockMode)}
        connecting={connecting}
        disconnecting={disconnecting}
        onConsentChange={setConsentAccepted}
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
