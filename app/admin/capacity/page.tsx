"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CapacityClient = {
  id: string;
  name: string;
  email: string;
  lifecycle_status: string;
  status: "red" | "amber" | "green" | "paused";
  flags: Array<{ severity: "red" | "amber"; label: string }>;
  capacity: {
    date: string;
    readiness_score: number | null;
    recovery_status: string;
    sleep_minutes: number | null;
    sleep_score: number | null;
    hrv_ms: number | null;
    resting_hr_bpm: number | null;
  } | null;
  daily: { date: string; energy: number | null; stress: number | null } | null;
  activity: { last_training: string | null; last_nutrition: string | null; last_wearable_sync: string | null } | null;
  calendar: { total: number; dense_days: number };
  storm: {
    warning: boolean;
    severity: "none" | "amber" | "red";
    window_key: string;
    overall: string;
    explanations: string[];
    used_history: boolean;
    dismissed: boolean;
    dismissed_at: string | null;
  } | null;
  connection: { provider: string; last_sync_at: string | null } | null;
};

type Filter = "all" | "red" | "amber" | "disconnected" | "missing" | "paused";

function age(value: string | null | undefined) {
  if (!value) return "No data";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "No data";
  const days = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
  return days <= 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
}

function sleepLabel(minutes: number | null) {
  if (minutes === null) return "—";
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
}

export default function CapacityScanPage() {
  const [clients, setClients] = useState<CapacityClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/capacity-scan")
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Capacity scan could not be loaded");
        setClients(payload.clients || []);
      })
      .catch((loadError) => {
        setClients([]);
        setError(loadError instanceof Error ? loadError.message : "Capacity Scan could not be loaded");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => clients.filter((client) => {
    if (filter === "red") return client.status === "red";
    if (filter === "amber") return client.status === "amber";
    if (filter === "disconnected") return !client.connection;
    if (filter === "missing") return !client.capacity || !client.connection;
    if (filter === "paused") return client.status === "paused";
    return true;
  }), [clients, filter]);

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-bg-card" />)}</div>;
  }

  return (
    <>
      <header className="mb-7">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E040D0]">Founder clients</div>
        <h1 className="mt-1 font-heading text-3xl font-bold text-text-primary">Capacity Scan</h1>
        <p className="mt-1 text-sm text-text-secondary">Recovery, adherence, mood and calendar pressure in one pass.</p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {([
          ["all", `All (${clients.length})`],
          ["red", `Red (${clients.filter((client) => client.status === "red").length})`],
          ["amber", `Amber (${clients.filter((client) => client.status === "amber").length})`],
          ["disconnected", `Disconnected (${clients.filter((client) => !client.connection).length})`],
          ["missing", `Missing data (${clients.filter((client) => !client.capacity || !client.connection).length})`],
          ["paused", `Paused (${clients.filter((client) => client.status === "paused").length})`],
        ] as Array<[Filter, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
              filter === value
                ? "border-[#E040D0]/30 bg-[#E040D0]/10 text-[#E040D0]"
                : "border-[rgba(0,0,0,0.08)] text-text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/8 px-5 py-5">
          <div className="text-sm font-semibold text-red-500">Capacity Scan is temporarily unavailable.</div>
          <div className="mt-1 text-xs text-text-secondary">{error}</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[rgba(0,0,0,0.10)] bg-bg-card px-6 py-12 text-center">
          <div className="text-sm font-semibold text-text-primary">No Founder clients match this view.</div>
          <div className="mt-1 text-xs text-text-muted">Assign Founder Dashboard on a client profile to include them here.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((client) => {
            const statusStyle = client.status === "red"
              ? "border-red-500/30 bg-red-500/5"
              : client.status === "amber"
                ? "border-amber-500/30 bg-amber-500/5"
                : client.status === "paused"
                  ? "border-[rgba(0,0,0,0.10)] bg-bg-card opacity-70"
                  : "border-emerald-500/20 bg-emerald-500/5";
            return (
              <Link key={client.id} href={`/admin/clients/${client.id}`} className={`block rounded-2xl border p-4 no-underline ${statusStyle}`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                  <div className="min-w-0 xl:w-56">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        client.status === "red" ? "bg-red-500" : client.status === "amber" ? "bg-amber-500" : client.status === "paused" ? "bg-text-muted" : "bg-emerald-500"
                      }`} />
                      <span className="truncate text-sm font-bold text-text-primary">{client.name}</span>
                    </div>
                    <div className="mt-1 truncate text-xs text-text-muted">{client.email}</div>
                    {client.flags[0] && <div className="mt-2 text-xs leading-4 text-text-secondary">{client.flags[0].label}</div>}
                  </div>

                  <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
                    {[
                      { label: "Capacity", value: client.capacity?.readiness_score === null || client.capacity?.readiness_score === undefined ? "—" : `${client.capacity.readiness_score}` },
                      { label: "Sleep", value: sleepLabel(client.capacity?.sleep_minutes ?? null) },
                      { label: "HRV", value: client.capacity?.hrv_ms ? `${Math.round(client.capacity.hrv_ms)} ms` : "—" },
                      { label: "Energy", value: client.daily?.energy ? `${client.daily.energy}/10` : "—" },
                      { label: "Training", value: age(client.activity?.last_training) },
                      { label: "Nutrition", value: age(client.activity?.last_nutrition) },
                      { label: "Week load", value: `${client.calendar.total} items` },
                      { label: "Last sync", value: age(client.connection?.last_sync_at || client.activity?.last_wearable_sync) },
                    ].map((metric) => (
                      <div key={metric.label} className="min-w-0 rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-2.5 py-2.5">
                        <div className="truncate text-[8px] font-bold uppercase tracking-wider text-text-muted">{metric.label}</div>
                        <div className="mt-1 truncate text-xs font-bold text-text-primary">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {client.storm?.warning && (
                  <div className={`mt-4 rounded-xl border px-3 py-2.5 ${
                    client.storm.severity === "red" ? "border-red-500/25 bg-red-500/5" : "border-amber-500/25 bg-amber-500/5"
                  }`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${
                        client.storm.severity === "red" ? "text-red-500" : "text-amber-500"
                      }`}>
                        Storm warning · {client.storm.severity}
                      </span>
                      {client.storm.dismissed && (
                        <span className="rounded-full border border-[rgba(0,0,0,0.10)] px-2 py-0.5 text-[9px] font-semibold text-text-muted">
                          Dismissed by client
                        </span>
                      )}
                      {!client.storm.used_history && (
                        <span className="text-[9px] text-text-muted">Absolute rules only - limited calendar history</span>
                      )}
                    </div>
                    <div className="mt-1.5 space-y-0.5">
                      {client.storm.explanations.map((line) => (
                        <div key={line} className="text-xs leading-4 text-text-secondary">- {line}</div>
                      ))}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
