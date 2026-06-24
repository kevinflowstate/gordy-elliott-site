"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SystemCheck = {
  key: string;
  label: string;
  status: "ok" | "warning" | "blocked";
  detail: string;
};

const statusClass: Record<SystemCheck["status"], string> = {
  ok: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  blocked: "border-red-500/20 bg-red-500/10 text-red-400",
};

export default function AdminSettingsPage() {
  const [checks, setChecks] = useState<SystemCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch("/api/admin/system-status");
        if (res.ok) {
          const data = await res.json();
          setChecks(data.checks || []);
        }
      } finally {
        setLoading(false);
      }
    }

    loadStatus();
  }, []);

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Admin Settings</h1>
        <p className="text-text-secondary mt-1">Launch checks and portal configuration.</p>
      </div>

      <div className="mb-6 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary">Client Onboarding</h2>
            <p className="mt-1 text-sm text-text-muted">
              Add clients from the Clients area. That flow creates the account, assigns the tier, and gives Gordy an email/manual setup-link fallback.
            </p>
          </div>
          <Link
            href="/admin/clients"
            className="rounded-xl bg-[#E040D0] px-5 py-3 text-center text-sm font-semibold text-white no-underline transition-colors hover:bg-[#b830a8]"
          >
            Open Clients
          </Link>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-6">
        <h2 className="text-lg font-heading font-bold text-text-primary">Production Readiness</h2>
        <p className="mt-1 text-sm text-text-muted">
          These checks confirm the app has the runtime pieces it needs. Secret values stay hidden.
        </p>

        <div className="mt-5 space-y-3">
          {loading ? (
            [...Array(5)].map((_, idx) => (
              <div key={idx} className="h-16 animate-pulse rounded-xl bg-[rgba(0,0,0,0.06)]" />
            ))
          ) : checks.length === 0 ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
              Couldn&apos;t load system checks.
            </div>
          ) : checks.map((check) => (
            <div key={check.key} className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-text-primary">{check.label}</div>
                  <div className="mt-1 text-xs text-text-muted">{check.detail}</div>
                </div>
                <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusClass[check.status]}`}>
                  {check.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-6">
        <h2 className="text-lg font-heading font-bold text-text-primary">Portal Info</h2>
        <div className="mt-4 space-y-3">
          <div className="flex justify-between gap-4 border-b border-[rgba(0,0,0,0.06)] py-2">
            <span className="text-sm text-text-muted">Portal URL</span>
            <span className="text-sm text-text-primary">/portal</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-[rgba(0,0,0,0.06)] py-2">
            <span className="text-sm text-text-muted">Admin URL</span>
            <span className="text-sm text-text-primary">/admin</span>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <span className="text-sm text-text-muted">Authentication</span>
            <span className="text-sm text-text-primary">Supabase Auth, admin invite only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
