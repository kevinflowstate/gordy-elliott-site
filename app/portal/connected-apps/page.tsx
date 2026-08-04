"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import CyclingStatusText from "@/components/ui/CyclingStatusText";
import type { WearableConnection, WearableDailySummary } from "@/lib/wearable-insights";

type IntegrationsPayload = {
  mockMode: boolean;
  available: boolean;
  consentAccepted: boolean;
  connections: WearableConnection[];
  latestSummary: WearableDailySummary | null;
  summaries: WearableDailySummary[];
};

type ProviderCard = {
  id: string;
  name: string;
  description: string;
  disabled?: boolean;
};

const providers: ProviderCard[] = [
  { id: "garmin", name: "Garmin", description: "Training load, workouts, steps, heart rate and sleep signals." },
  { id: "oura", name: "Oura", description: "Sleep, recovery, HRV and resting heart rate." },
  { id: "myfitnesspal", name: "MyFitnessPal", description: "Calories, protein, carbs, fats and hydration when available." },
  { id: "fitbit", name: "Fitbit", description: "Daily activity, sleep and heart-rate data through Terra." },
  { id: "whoop", name: "WHOOP and Strava", description: "Available after their provider credentials and account-level tests are complete.", disabled: true },
  { id: "apple_health", name: "Apple Health", description: "Later native HealthKit phase. Apple Health is not included in the first App Store release.", disabled: true },
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "Not synced yet";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function statusClass(status?: string) {
  if (status === "connected") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-400";
  if (status === "disconnected" || status === "error") return "border-red-500/25 bg-red-500/10 text-red-400";
  if (status === "pending") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  return "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] text-text-muted";
}

export default function ConnectedAppsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<IntegrationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const handledReturn = useRef(false);
  const browserFinishedListener = useRef<PluginListenerHandle | null>(null);

  const load = useCallback(async (showLoading = true): Promise<IntegrationsPayload | null> => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/portal/integrations");
      const json = await res.json() as IntegrationsPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Couldn't load connected apps");
      setData(json);
      if (json.consentAccepted) setConsentAccepted(true);
      return json;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't load connected apps", "error");
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

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
      const refreshed = await load(false);
      if (cancelled || !refreshed) return;
      const connection = refreshed.connections.find((item) => item.provider === provider);
      if (connection?.status === "connected") {
        toast(`${providers.find((item) => item.id === provider)?.name || "App"} connected`);
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

  const connectionByProvider = useMemo(() => {
    const map = new Map<string, WearableConnection>();
    for (const connection of data?.connections || []) map.set(connection.provider, connection);
    return map;
  }, [data?.connections]);

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

            const refreshed = await load(false);
            const connection = refreshed?.connections.find((item) => item.provider === provider);
            if (connection?.status !== "pending") return;

            await fetch("/api/portal/integrations/terra/session", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ provider }),
            });
            await load(false);
            toast(
              provider === "myfitnesspal"
                ? "Terra couldn't complete the MyFitnessPal sign-in. Please try again shortly."
                : "That connection wasn't completed. You can try again when you're ready.",
              "error",
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

  const latest = data?.latestSummary || null;
  const hasNutritionConnection = data?.connections.some((connection) =>
    connection.provider === "myfitnesspal" && connection.status === "connected"
  ) || latest?.providers.includes("myfitnesspal");
  const sleepValue = latest?.sleep_minutes
    ? `${Math.floor(latest.sleep_minutes / 60)}h ${latest.sleep_minutes % 60}m`
    : latest?.sleep_score !== null && latest?.sleep_score !== undefined
      ? `${latest.sleep_score}/100`
      : "—";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-28 sm:pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/portal/settings" className="mb-3 inline-flex text-sm font-semibold text-accent-bright no-underline">
            ← Back to settings
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-bright">Connected Apps</p>
          <h1 className="mt-1 text-3xl font-heading font-bold text-text-primary">Health data sync</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Connect wearable and nutrition apps so Gordy can see recovery signals alongside your training and daily tracker.
          </p>
        </div>
        {data?.mockMode && (
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300">
            Preview mode: Terra credentials are not live yet.
          </div>
        )}
        {data && !data.available && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-text-secondary">
            Connected apps are coming soon.
          </div>
        )}
      </div>

      {latest && (
        <section className="app-card rounded-[28px] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Today&apos;s recovery</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-text-primary">
                {latest.readiness_score ?? "—"}/100 · {latest.recovery_status.replace(/_/g, " ")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">{latest.insight}</p>
            </div>
            <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${statusClass(latest.recovery_status === "good" ? "connected" : "pending")}`}>
              {latest.providers.map((provider) => provider.toUpperCase()).join(" + ")}
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Metric label={latest.sleep_minutes ? "Sleep" : "Sleep score"} value={sleepValue} />
            <Metric label="HRV" value={latest.hrv_ms ? `${Math.round(latest.hrv_ms)} ms` : "—"} />
            <Metric label="Resting HR" value={latest.resting_hr_bpm ? `${latest.resting_hr_bpm} bpm` : "—"} />
            <Metric label="Steps" value={latest.steps ? latest.steps.toLocaleString("en-GB") : "—"} />
            {hasNutritionConnection && (
              <>
                <Metric label="Calories" value={latest.nutrition_calories ? latest.nutrition_calories.toLocaleString("en-GB") : "—"} />
                <Metric label="Protein" value={latest.protein_g ? `${Math.round(latest.protein_g)}g` : "—"} />
                <Metric label="Carbs" value={latest.carbs_g ? `${Math.round(latest.carbs_g)}g` : "—"} />
                <Metric label="Fat" value={latest.fat_g ? `${Math.round(latest.fat_g)}g` : "—"} />
              </>
            )}
          </div>
        </section>
      )}

      {data && !data.consentAccepted && (
        <section className="rounded-[24px] border border-accent/20 bg-accent/[0.06] p-5">
          <h2 className="font-heading text-lg font-bold text-text-primary">Before you connect</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Your chosen app will share sleep, recovery, heart-rate, activity or nutrition data with AT CAPACITY through Terra,
            our connection provider. Gordy uses these signals for coaching suggestions only; they never change your training plan
            automatically. Raw delivery payloads are kept for up to 90 days, while useful coaching summaries remain with your
            account until you delete it or ask for deletion. Disconnecting stops new data from being received.
          </p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
            />
            <span className="text-sm font-semibold leading-relaxed text-text-primary">
              I explicitly consent to this health-data use and want to connect my chosen app. I have read the{" "}
              <Link href="/privacy" className="text-accent-bright underline underline-offset-2">AT CAPACITY Privacy Notice</Link>
              {" "}and{" "}
              <a
                href="https://tryterra.co/end-user-privacy"
                target="_blank"
                rel="noreferrer"
                className="text-accent-bright underline underline-offset-2"
              >
                Terra End User Privacy Policy
              </a>.
            </span>
          </label>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((provider) => {
          const connection = connectionByProvider.get(provider.id);
          const connected = connection?.status === "connected";
          return (
            <section key={provider.id} className="app-card rounded-[24px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-heading text-lg font-bold text-text-primary">{provider.name}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">{provider.description}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusClass(connection?.status)}`}>
                  {provider.disabled ? "Later" : connected ? "Live" : connection?.status || "Off"}
                </span>
              </div>

              {connection && (
                <p className="mt-4 text-xs text-text-muted">Last sync: {formatDate(connection.last_sync_at)}</p>
              )}

              <div className="mt-5 flex gap-2">
                {connected ? (
                  <button
                    type="button"
                    onClick={() => disconnect(connection)}
                    disabled={disconnecting === connection.id}
                    className="rounded-xl border border-red-500/25 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <CyclingStatusText active={disconnecting === connection.id} idle="Disconnect" messages={["Disconnecting...", "Updating...", "Nearly there..."]} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => connect(provider.id)}
                    disabled={Boolean(provider.disabled) || !consentAccepted || data?.available === false || connecting === provider.id}
                    className="rounded-xl gradient-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    <CyclingStatusText active={connecting === provider.id} idle={data?.mockMode ? "Preview sync" : "Connect"} messages={["Starting...", "Creating session...", "Opening Terra...", "Nearly there..."]} />
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {loading && (
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-5 text-sm text-text-muted">
          Loading connected apps...
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</div>
      <div className="mt-1 text-lg font-heading font-bold text-text-primary">{value}</div>
    </div>
  );
}
