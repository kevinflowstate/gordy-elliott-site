"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import CyclingStatusText from "@/components/ui/CyclingStatusText";
import type { WearableConnection, WearableDailySummary } from "@/lib/wearable-insights";

type IntegrationsPayload = {
  mockMode: boolean;
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
  { id: "whoop", name: "WHOOP / Strava", description: "Recovery, strain and workout history, depending on provider." },
  { id: "apple_health", name: "Apple Health", description: "Future mobile app phase. Apple Health needs a native/mobile wrapper.", disabled: true },
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "Not synced yet";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function statusClass(status?: string) {
  if (status === "connected") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-400";
  if (status === "disconnected") return "border-red-500/25 bg-red-500/10 text-red-400";
  return "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] text-text-muted";
}

export default function ConnectedAppsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<IntegrationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/integrations");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't load connected apps");
      setData(json);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't load connected apps", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const connectionByProvider = useMemo(() => {
    const map = new Map<string, WearableConnection>();
    for (const connection of data?.connections || []) map.set(connection.provider, connection);
    return map;
  }, [data?.connections]);

  async function connect(provider: string) {
    setConnecting(provider);
    try {
      const res = await fetch("/api/portal/integrations/terra/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't start connection");

      if (json.mock) {
        toast("Preview connection added");
        await load();
        return;
      }

      window.open(json.url, "_blank", "noopener,noreferrer");
      toast("Opening secure Terra connection");
    } catch (err) {
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
      toast("Connection removed locally");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't disconnect", "error");
    } finally {
      setDisconnecting(null);
    }
  }

  const latest = data?.latestSummary || null;

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
            <Metric label="Sleep" value={latest.sleep_minutes ? `${Math.round(latest.sleep_minutes / 60)}h ${latest.sleep_minutes % 60}m` : "—"} />
            <Metric label="HRV" value={latest.hrv_ms ? `${Math.round(latest.hrv_ms)} ms` : "—"} />
            <Metric label="Steps" value={latest.steps ? latest.steps.toLocaleString("en-GB") : "—"} />
            <Metric label="Protein" value={latest.protein_g ? `${Math.round(latest.protein_g)}g` : "—"} />
          </div>
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
                    disabled={Boolean(provider.disabled) || connecting === provider.id}
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
