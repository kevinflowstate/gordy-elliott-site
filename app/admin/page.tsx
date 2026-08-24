"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import type { AdminClient } from "@/lib/admin-data";
import type { ProgrammeType, TrafficLight, CheckInMood, CheckIn, InboxConversation } from "@/lib/types";

interface CapacityScanClient {
  id: string;
  name: string;
  status: "red" | "amber" | "green" | "paused";
  flags: Array<{ severity: "red" | "amber"; label: string }>;
}

const statusLabel: Record<TrafficLight, { text: string; dotClass: string; bgClass: string; textClass: string }> = {
  red: { text: "Needs Attention", dotClass: "bg-red-500", bgClass: "bg-red-500/10", textClass: "text-red-400" },
  amber: { text: "Needs Attention", dotClass: "bg-amber-500", bgClass: "bg-amber-500/10", textClass: "text-amber-400" },
  green: { text: "Up to Date", dotClass: "bg-emerald-500", bgClass: "bg-emerald-500/10", textClass: "text-emerald-400" },
};

const moodConfig: Record<CheckInMood, { bgClass: string; textClass: string }> = {
  great: { bgClass: "bg-emerald-500/10", textClass: "text-emerald-400" },
  good: { bgClass: "bg-blue-500/10", textClass: "text-blue-400" },
  okay: { bgClass: "bg-amber-500/10", textClass: "text-amber-400" },
  struggling: { bgClass: "bg-red-500/10", textClass: "text-red-400" },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

function formatDate(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const d = date.getDate();
  const suffix = d === 1 || d === 21 || d === 31 ? "st" : d === 2 || d === 22 ? "nd" : d === 3 || d === 23 ? "rd" : "th";
  return `${days[date.getDay()]} ${d}${suffix} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

const BRIEFING_SNOOZE_KEY = "at-capacity:admin-briefing-snoozes";
const briefingStorageListeners = new Set<() => void>();
let briefingSnoozeFallback = "{}";

function readBriefingSnoozes() {
  if (typeof window === "undefined") return "{}";
  try {
    return window.localStorage.getItem(BRIEFING_SNOOZE_KEY) || briefingSnoozeFallback;
  } catch {
    return briefingSnoozeFallback;
  }
}

function subscribeToBriefingSnoozes(listener: () => void) {
  briefingStorageListeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === BRIEFING_SNOOZE_KEY) listener();
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    briefingStorageListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function writeBriefingSnoozes(value: Record<string, string>) {
  briefingSnoozeFallback = JSON.stringify(value);
  try {
    window.localStorage.setItem(BRIEFING_SNOOZE_KEY, briefingSnoozeFallback);
  } catch {
    // The in-memory fallback still keeps the current admin session usable.
  }
  briefingStorageListeners.forEach((listener) => listener());
}

export default function AdminDashboard() {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<EnrichedCheckin[]>([]);
  const [inboxConversations, setInboxConversations] = useState<InboxConversation[]>([]);
  const [capacityScanClients, setCapacityScanClients] = useState<CapacityScanClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [adminName, setAdminName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    programmeType: ProgrammeType;
  }>({ firstName: "", lastName: "", email: "", programmeType: "capacity" });
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteResult, setInviteResult] = useState<{ emailSent: boolean; setupUrl: string | null } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [clientsRes, meRes] = await Promise.all([
          fetch("/api/admin/clients"),
          fetch("/api/portal/me"),
        ]);
        if (clientsRes.ok) {
          const data = await clientsRes.json();
          setClients(data.clients || []);
          // Build recent checkins from client data
          const checkins = (data.clients || []).flatMap((c: AdminClient) =>
            c.checkins.map((ck: CheckIn) => ({
              ...ck,
              client_name: c.name,
              client_business: c.business_name,
              client_status: c.status,
            }))
          ).sort((a: EnrichedCheckin, b: EnrichedCheckin) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setRecentCheckins(checkins);
        }
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.fullName) {
            setAdminName(meData.fullName.split(" ")[0]);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    async function loadBriefingSignals() {
      try {
        const [inboxRes, capacityRes] = await Promise.all([
          fetch("/api/inbox"),
          fetch("/api/admin/capacity-scan"),
        ]);
        if (inboxRes.ok) {
          const inboxData = await inboxRes.json();
          setInboxConversations(inboxData.conversations || []);
        }
        if (capacityRes.ok) {
          const capacityData = await capacityRes.json();
          setCapacityScanClients(capacityData.clients || []);
        }
      } catch {
        // Core dashboard data still renders when supplementary live signals are unavailable.
      }
    }

    void load();
    void loadBriefingSignals();
  }, []);

  if (loading) {
    return (
      <>
        <div className="mb-8">
          <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-8 w-64 mb-2" />
          <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-bg-card/80 border border-[rgba(0,0,0,0.06)] rounded-2xl p-6">
              <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-3 w-20 mb-3" />
              <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-8 w-12" />
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-bg-card/80 border border-[rgba(0,0,0,0.06)] rounded-2xl p-5">
              <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-5 w-32 mb-4" />
              {[...Array(4)].map((_, j) => (
                <div key={j} className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-10 w-full mb-2" />
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  const activeClients = clients.filter((c) => c.lifecycle_status === "active");
  const pausedCount = clients.length - activeClients.length;
  const greenCount = activeClients.filter((c) => c.status === "green").length;
  const amberCount = activeClients.filter((c) => c.status === "amber").length;
  const redCount = activeClients.filter((c) => c.status === "red").length;
  const activeClientIds = new Set(activeClients.map((client) => client.id));
  const unreplied = recentCheckins.filter((c) => !c.admin_reply && activeClientIds.has(c.client_id)).length;
  const today = new Date();
  const todayMonthDay = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todaysKeyDates = activeClients.flatMap((client) => {
    const birthday = client.date_of_birth?.slice(5) === todayMonthDay
      ? [{ client, label: "Birthday" }]
      : [];
    const keyDates = (client.key_dates || [])
      .filter((item) => {
        if (item.recurring) return item.date.slice(5) === todayMonthDay;
        return item.date === today.toISOString().split("T")[0];
      })
      .map((item) => ({ client, label: item.label }));
    return [...birthday, ...keyDates];
  });

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">
          Welcome Back{adminName ? `, ${adminName}` : ""}
        </h1>
        <p className="text-text-secondary mt-1">{formatDate(new Date())}</p>
      </div>

      <ShiftOverview
        clients={clients}
        recentCheckins={recentCheckins}
        inboxConversations={inboxConversations}
        capacityScanClients={capacityScanClients}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Clients - gold accent */}
        <div className="group relative bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:border-accent/20">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent-dark via-accent to-accent-light rounded-t-2xl" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(0,0,0,1)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          <div className="text-text-muted text-xs uppercase tracking-wider mb-1">Total Clients</div>
          <div className="text-3xl font-heading font-bold text-text-primary">{clients.length}</div>
          {pausedCount > 0 && <div className="mt-1 text-xs text-text-muted">{pausedCount} paused or frozen</div>}
        </div>

        {/* Up to Date - emerald accent */}
        <Link href="/admin/clients?status=green" className="group relative block bg-bg-card/80 backdrop-blur-sm border border-[rgba(16,185,129,0.15)] rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(16,185,129,0.14)] hover:border-emerald-500/30 no-underline">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-500/70 rounded-t-2xl" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(16,185,129,1)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-text-muted text-xs uppercase tracking-wider mb-1">Up to Date</div>
          <div className="text-3xl font-heading font-bold text-emerald-400">{greenCount}</div>
        </Link>

        {/* Needs Attention - amber/red accent */}
        <Link href="/admin/clients?status=attention" className="group relative block bg-bg-card/80 backdrop-blur-sm border border-[rgba(245,158,11,0.15)] rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(245,158,11,0.14)] hover:border-amber-500/30 no-underline">
          <div className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl ${redCount > 0 ? "bg-red-500/70" : "bg-amber-500/70"}`} />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(245,158,11,1)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <div className="text-text-muted text-xs uppercase tracking-wider mb-1">Needs Attention</div>
          <div className={`text-3xl font-heading font-bold ${amberCount + redCount > 0 ? "text-amber-400" : "text-text-primary"}`}>
            {amberCount + redCount}
          </div>
          {redCount > 0 && (
            <div className="text-red-400 text-xs mt-1">{redCount} behind schedule</div>
          )}
        </Link>

        {/* Unreplied - red if any, neutral if zero */}
        <div className="group relative bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:border-[rgba(0,0,0,0.1)]">
          <div className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl ${unreplied > 0 ? "bg-red-500/70" : "bg-[rgba(0,0,0,0.08)]"}`} />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(0,0,0,1)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
          <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${unreplied > 0 ? "bg-red-500/10 border border-red-500/20" : "bg-[rgba(0,0,0,0.04)] border border-[rgba(0,0,0,0.06)]"}`}>
              <svg className={`w-5 h-5 ${unreplied > 0 ? "text-red-400" : "text-text-muted"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
          </div>
          <div className="text-text-muted text-xs uppercase tracking-wider mb-1">Unreplied Check-ins</div>
          <div className={`text-3xl font-heading font-bold ${unreplied > 0 ? "text-red-400" : "text-text-primary"}`}>
            {unreplied}
          </div>
        </div>
      </div>

      {todaysKeyDates.length > 0 && (
        <div className="mb-8 rounded-2xl border border-[#E040D0]/20 bg-[#E040D0]/8 px-5 py-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E040D0]">Today</div>
          <div className="flex flex-wrap gap-2">
            {todaysKeyDates.map((item) => (
              <Link
                key={`${item.client.id}-${item.label}`}
                href={`/admin/clients/${item.client.id}`}
                className="rounded-full border border-[rgba(0,0,0,0.08)] bg-bg-card px-3 py-1.5 text-xs font-semibold text-text-primary no-underline hover:border-[#E040D0]/30"
              >
                {item.client.name} · {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link
          href="/admin/calendar"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.08)] rounded-xl text-sm font-medium text-text-primary hover:border-accent/30 hover:bg-accent/5 transition-all no-underline group"
        >
          <svg className="w-4 h-4 text-accent-bright group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Add To Calendar
        </Link>
        <Link
          href="/admin/training"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.08)] rounded-xl text-sm font-medium text-text-primary hover:border-accent/30 hover:bg-accent/5 transition-all no-underline group"
        >
          <svg className="w-4 h-4 text-accent-bright group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add New Training
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Compact client list with expandable detail */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text-primary">Clients</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white gradient-accent rounded-lg cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New
              </button>
              <Link href="/admin/clients" className="text-sm text-accent-bright hover:text-accent-light transition-colors no-underline">
                View All
              </Link>
            </div>
          </div>
          <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden">
            {clients.map((client) => {
              const sl = statusLabel[client.status];
              const isExpanded = expandedClient === client.id;
              const activePlan = client.training_plan.find((p) => p.status === "active");
              const allItems = activePlan?.phases.flatMap((ph) => ph.items) || [];
              const planTotal = allItems.length;
              const planDone = allItems.filter((p) => p.completed).length;
              const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

              return (
                <div key={client.id} className="border-b border-[rgba(0,0,0,0.03)] last:border-b-0">
                  {/* Compact row - name + glow */}
                  <button
                    onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgba(0,0,0,0.02)] transition-colors text-left cursor-pointer"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border ${sl.bgClass} ${sl.textClass} ${
                      client.status === "red" ? "border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                      : client.status === "amber" ? "border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                      : "border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    }`}>
                      {client.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <span className="text-sm font-medium text-text-primary flex-1">{client.name}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${sl.bgClass} ${sl.textClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sl.dotClass}`} />
                      {sl.text}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className={`px-4 pb-4 pt-1 border-l-2 ml-4 ${
                      client.status === "red" ? "border-red-500/30" : client.status === "amber" ? "border-amber-500/30" : "border-emerald-500/30"
                    }`}>
                      <div className="bg-[rgba(255,255,255,0.015)] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="text-xs text-text-muted">{client.business_name} - {client.business_type}</div>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sl.bgClass} ${sl.textClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sl.dotClass}`} />
                            {sl.text}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                          <div>
                            <div className="text-text-muted text-xs mb-0.5">Week</div>
                            <div className="text-text-primary font-semibold">{client.current_week}/12</div>
                          </div>
                          <div>
                            <div className="text-text-muted text-xs mb-0.5">Last Check-in</div>
                            <div className={`font-semibold ${
                              new Date().getTime() - new Date(client.last_checkin).getTime() > 7 * 24 * 60 * 60 * 1000
                                ? "text-red-400" : "text-text-primary"
                            }`}>
                              {timeAgo(client.last_checkin)}
                            </div>
                          </div>
                          <div>
                            <div className="text-text-muted text-xs mb-0.5">Plan</div>
                            <div className="text-text-primary font-semibold">{planDone}/{planTotal} ({planPct}%)</div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2.5 bg-[rgba(0,0,0,0.04)] rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              client.status === "red" ? "bg-red-500/60" : client.status === "amber" ? "bg-amber-500/60" : "bg-emerald-500/60"
                            }`}
                            style={{ width: `${planPct}%` }}
                          />
                        </div>

                        <Link
                          href={`/admin/clients/${client.id}`}
                          className="text-xs text-accent-bright hover:text-accent-light transition-colors no-underline inline-flex items-center gap-1"
                        >
                          View Full Profile
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent check-ins - grouped by week */}
        <CheckInsPanel checkins={recentCheckins} />
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setInviteOpen(false); setInviteError(""); setInviteResult(null); }} />
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-heading font-bold text-text-primary">Invite New Client</h3>
              <button onClick={() => { setInviteOpen(false); setInviteError(""); setInviteResult(null); }} className="text-text-muted hover:text-text-secondary transition-colors cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {inviteResult ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-text-primary font-semibold mb-1">Client Added</p>
                <p className="text-text-secondary text-sm">
                  {inviteResult.emailSent
                    ? "Their account setup email has been sent."
                    : "Email delivery is not configured yet. Share the secure setup link below."}
                </p>
                {inviteResult.setupUrl && (
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(inviteResult.setupUrl || "")}
                    className="mt-4 w-full rounded-xl border border-accent/25 bg-accent/8 px-4 py-2.5 text-sm font-semibold text-accent"
                  >
                    Copy setup link
                  </button>
                )}
                <button
                  onClick={() => { setInviteOpen(false); setInviteResult(null); setInviteForm({ firstName: "", lastName: "", email: "", programmeType: "capacity" }); }}
                  className="mt-4 px-6 py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setInviteSending(true);
                setInviteError("");
                try {
                  const res = await fetch("/api/admin/invite-client", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: inviteForm.email,
                      name: `${inviteForm.firstName} ${inviteForm.lastName}`.trim(),
                      programme_type: inviteForm.programmeType,
                    }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    throw new Error(data.error || "Failed to send invite");
                  }
                  setInviteResult({
                    emailSent: data.emailSent === true,
                    setupUrl: typeof data.setupUrl === "string" ? data.setupUrl : null,
                  });
                  // Refresh client list
                  const clientsRes = await fetch("/api/admin/clients");
                  if (clientsRes.ok) {
                    const data = await clientsRes.json();
                    setClients(data.clients || []);
                  }
                } catch (err) {
                  setInviteError(err instanceof Error ? err.message : "Failed to send invite");
                } finally {
                  setInviteSending(false);
                }
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">First Name</label>
                    <input
                      type="text"
                      required
                      value={inviteForm.firstName}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/40 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">Last Name</label>
                    <input
                      type="text"
                      required
                      value={inviteForm.lastName}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/40 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="client@example.com"
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Programme</label>
                  <select
                    value={inviteForm.programmeType}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, programmeType: e.target.value as ProgrammeType }))}
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/40 transition-colors"
                  >
                    <option value="capacity">CAPACITY</option>
                    <option value="shift">SHIFT</option>
                    <option value="in_person">IN PERSON</option>
                  </select>
                  <p className="mt-1.5 text-xs text-text-muted">Controls calls, documents, education and AI allowance.</p>
                </div>
                {inviteError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">{inviteError}</div>
                )}
                <button
                  type="submit"
                  disabled={inviteSending}
                  className="w-full py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 cursor-pointer transition-opacity"
                >
                  {inviteSending ? "Sending Invite..." : "Send Invite"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// --- SHIFT AI Overview ---

interface BriefingInsight {
  id: string;
  icon: string;
  text: string;
  category: "Reply" | "Capacity" | "Consistency" | "Plan";
  severity: "red" | "amber" | "neutral";
  action?: { type: "nudge"; clientName: string; userId: string; clientId: string }
    | { type: "reply-checkin"; clientId: string }
    | { type: "reply-dm"; clientId: string }
    | { type: "view-plan"; clientId: string }
    | { type: "view-client"; clientId: string };
}

function ShiftOverview({
  clients,
  recentCheckins,
  inboxConversations,
  capacityScanClients,
}: {
  clients: AdminClient[];
  recentCheckins: EnrichedCheckin[];
  inboxConversations: InboxConversation[];
  capacityScanClients: CapacityScanClient[];
}) {
  const dismissalSnapshot = useSyncExternalStore(subscribeToBriefingSnoozes, readBriefingSnoozes, () => "{}");
  let dismissedUntil: Record<string, string> = {};
  try {
    const parsed = JSON.parse(dismissalSnapshot) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      dismissedUntil = parsed as Record<string, string>;
    }
  } catch {
    dismissedUntil = {};
  }
  const [nudgeTarget, setNudgeTarget] = useState<{ name: string; userId: string; clientId: string } | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [nudgeSending, setNudgeSending] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [nudgeDelivery, setNudgeDelivery] = useState("");

  const activeClients = clients.filter(c => c.lifecycle_status === "active");
  const activeClientIds = new Set(activeClients.map(c => c.id));
  const redClients = activeClients.filter(c => c.status === "red");
  const amberClients = activeClients.filter(c => c.status === "amber");
  const unrepliedCheckins = recentCheckins.filter(c => !c.admin_reply && activeClientIds.has(c.client_id));
  const stalledClients = activeClients.filter(c => {
    const activePlan = c.training_plan.find(p => p.status === "active");
    if (!activePlan) return false;
    const items = activePlan.phases.flatMap(ph => ph.items);
    const total = items.length;
    const done = items.filter(i => i.completed).length;
    return total > 0 && (done / total) < 0.3 && c.current_week > 4;
  });

  const insights: BriefingInsight[] = [];

  for (const c of [...redClients, ...amberClients]) {
    const reason = c.attention_reasons[0];
    if (!reason) continue;
    insights.push({
      id: `${reason.signal}-${c.id}`,
      icon: reason.severity === "red" ? "alert" : "clock",
      text: `${c.name}: ${reason.detail}`,
      category: "Consistency",
      severity: reason.severity,
      action: { type: "nudge", clientName: c.name, userId: c.user_id, clientId: c.id },
    });
  }

  for (const conversation of inboxConversations.filter((item) => item.unread_count > 0)) {
    insights.push({
      id: `dm-${conversation.client_id}`,
      icon: "message",
      text: `${conversation.client_name}: ${conversation.unread_count} unread message${conversation.unread_count === 1 ? "" : "s"}`,
      category: "Reply",
      severity: "red",
      action: { type: "reply-dm", clientId: conversation.client_id },
    });
  }

  if (unrepliedCheckins.length > 0) {
    // Group by client for individual actions
    const byClient = new Map<string, EnrichedCheckin[]>();
    for (const ck of unrepliedCheckins) {
      if (!byClient.has(ck.client_id)) byClient.set(ck.client_id, []);
      byClient.get(ck.client_id)!.push(ck);
    }
    for (const [clientId, cks] of byClient) {
      const name = cks[0].client_name;
      insights.push({
        id: `reply-${clientId}`,
        icon: "reply",
        text: `${cks.length} unreplied check-in${cks.length > 1 ? "s" : ""} from ${name}`,
        category: "Reply",
        severity: "red",
        action: { type: "reply-checkin", clientId },
      });
    }
  }

  for (const scanClient of capacityScanClients) {
    const flag = scanClient.flags[0];
    if (!flag) continue;
    insights.push({
      id: `capacity-${scanClient.id}-${flag.label}`,
      icon: "capacity",
      text: `${scanClient.name}: ${flag.label}`,
      category: "Capacity",
      severity: flag.severity,
      action: { type: "view-client", clientId: scanClient.id },
    });
  }

  for (const c of stalledClients) {
    const activePlan = c.training_plan.find(p => p.status === "active");
    const items = activePlan!.phases.flatMap(ph => ph.items);
    const pct = Math.round((items.filter(i => i.completed).length / items.length) * 100);
    insights.push({
      id: `plan-${c.id}`,
      icon: "plan",
      text: `${c.name}'s plan is only ${pct}% complete at week ${c.current_week}`,
      category: "Plan",
      severity: "amber",
      action: { type: "view-plan", clientId: c.id },
    });
  }

  const severityOrder = { red: 0, amber: 1, neutral: 2 } as const;
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  const now = Date.now();
  const visibleInsights = insights.filter((insight) => {
    const until = dismissedUntil[insight.id];
    return !until || new Date(until).getTime() <= now;
  });
  const replyCount = visibleInsights.filter((insight) => insight.category === "Reply").length;
  const signalCount = visibleInsights.filter((insight) => insight.category === "Capacity" || insight.category === "Consistency").length;
  const planCount = visibleInsights.filter((insight) => insight.category === "Plan").length;

  const iconMap: Record<string, React.ReactNode> = {
    alert: <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>,
    clock: <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    reply: <svg className="w-4 h-4 text-accent-bright flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
    message: <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8m-8 4h5m-7 6h12a2 2 0 002-2V8a2 2 0 00-.586-1.414l-4-4A2 2 0 0014 2H6a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    capacity: <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v3m6.364-.364-2.122 2.122M21 12h-3m.364 6.364-2.122-2.122M12 21v-3m-6.364.364 2.122-2.122M3 12h3m-.364-6.364 2.122 2.122M12 9a3 3 0 100 6 3 3 0 000-6z" /></svg>,
    plan: <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    check: <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  };

  function handleNudge(insight: BriefingInsight) {
    if (insight.action?.type !== "nudge") return;
    const firstName = insight.action.clientName.split(" ")[0];
    setNudgeTarget({ name: insight.action.clientName, userId: insight.action.userId, clientId: insight.action.clientId });
    setNudgeMessage(`Hey ${firstName}, just checking in - haven't seen you in the portal for a bit. Everything OK? Jump back in when you're ready, your plan is waiting.`);
    setNudgeSent(false);
    setNudgeDelivery("");
  }

  function snoozeInsight(insightId: string, days: number) {
    writeBriefingSnoozes({
      ...dismissedUntil,
      [insightId]: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  async function sendNudge(insightId: string) {
    if (!nudgeTarget) return;
    setNudgeSending(true);
    try {
      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: nudgeTarget.clientId,
          message: nudgeMessage,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        const notification = result.notification || {};
        setNudgeSent(true);
        setNudgeDelivery(notification.suppressed
          ? "DM saved. Notifications are paused for this client."
          : notification.sent > 0
            ? "DM saved and device notification delivered."
            : "DM saved. No device notification is currently enabled.");
        snoozeInsight(insightId, 1);
      } else {
        alert(result.error || "The DM could not be sent.");
      }
    } finally {
      setNudgeSending(false);
    }
  }

  return (
    <>
      <section className="relative mb-8 overflow-hidden rounded-[26px] border border-accent/20 bg-bg-card/90 shadow-[0_18px_55px_rgba(31,18,29,0.08)]">
        <div className="h-1 bg-accent" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/20 bg-accent/10">
            <svg className="w-4 h-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-bright">AT CAPACITY AI</div>
                <h2 className="mt-1 text-xl font-heading font-bold text-text-primary">Today&apos;s attention list</h2>
                <p className="mt-1 text-sm text-text-secondary">Who needs you, why, and the quickest useful next action.</p>
              </div>
            </div>
            <div className={`w-fit rounded-full border px-3 py-1.5 text-xs font-bold ${
              visibleInsights.length > 0
                ? "border-amber-500/25 bg-amber-500/10 text-amber-500"
                : "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
            }`}>
              {visibleInsights.length > 0 ? `${visibleInsights.length} to review` : "All clear"}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-[rgba(0,0,0,0.05)] bg-bg-primary/60 p-2">
            {[["Replies", replyCount], ["Signals", signalCount], ["Plans", planCount]].map(([label, count]) => (
              <div key={label} className="rounded-xl px-3 py-2 text-center">
                <div className="text-lg font-heading font-bold text-text-primary">{count}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 divide-y divide-[rgba(0,0,0,0.055)]">
            {visibleInsights.length === 0 ? (
              <div className="flex items-center gap-3 py-5">
                {iconMap.check}
                <div>
                  <div className="text-sm font-semibold text-text-primary">No immediate actions</div>
                  <div className="mt-0.5 text-xs text-text-muted">Snoozed items return automatically when their timer ends.</div>
                </div>
              </div>
            ) : visibleInsights.map((insight) => (
              <div key={insight.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    insight.severity === "red" ? "bg-red-500/10" : insight.severity === "amber" ? "bg-amber-500/10" : "bg-accent/10"
                  }`}>{iconMap[insight.icon]}</div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">{insight.category}</div>
                    <p className="mt-1 text-sm leading-5 text-text-primary">{insight.text}</p>
                  </div>
                </div>
                {insight.action && (
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {insight.action.type === "nudge" && (
                      <button
                        onClick={() => handleNudge(insight)}
                        className="text-[11px] px-3 py-1 rounded-lg font-semibold text-accent-bright bg-accent/10 border border-accent/20 hover:bg-accent/20 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        Send Nudge
                      </button>
                    )}
                    {insight.action.type === "reply-checkin" && (
                      <Link
                        href={`/admin/clients/${insight.action.clientId}`}
                        className="text-[11px] px-3 py-1 rounded-lg font-semibold text-accent-bright bg-accent/10 border border-accent/20 hover:bg-accent/20 transition-colors no-underline inline-flex items-center gap-1.5"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        Open Check-in
                      </Link>
                    )}
                    {insight.action.type === "reply-dm" && (
                      <Link
                        href={`/admin/inbox?client=${encodeURIComponent(insight.action.clientId)}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent-bright no-underline transition-colors hover:bg-accent/20"
                      >
                        Open DM
                      </Link>
                    )}
                    {insight.action.type === "view-plan" && (
                      <Link
                        href={`/admin/clients/${insight.action.clientId}`}
                        className="text-[11px] px-3 py-1 rounded-lg font-semibold text-accent-bright bg-accent/10 border border-accent/20 hover:bg-accent/20 transition-colors no-underline inline-flex items-center gap-1.5"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        View Plan
                      </Link>
                    )}
                    {insight.action.type === "view-client" && (
                      <Link
                        href={`/admin/clients/${insight.action.clientId}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent-bright no-underline transition-colors hover:bg-accent/20"
                      >
                        View Client
                      </Link>
                    )}
                    <button
                      onClick={() => snoozeInsight(insight.id, 1)}
                      className="text-[11px] px-2 py-1 rounded-lg text-text-muted hover:text-text-secondary hover:bg-[rgba(0,0,0,0.05)] transition-colors cursor-pointer"
                    >
                      Done today
                    </button>
                    <button
                      onClick={() => snoozeInsight(insight.id, 7)}
                      className="text-[11px] px-2 py-1 rounded-lg text-text-muted hover:text-text-secondary hover:bg-[rgba(0,0,0,0.05)] transition-colors cursor-pointer"
                    >
                      Snooze 7d
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nudge Modal */}
      {nudgeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-text-primary">Nudge {nudgeTarget.name.split(" ")[0]}</h3>
                <p className="text-xs text-text-muted">Save a DM and alert their device when notifications are enabled</p>
              </div>
            </div>

            {nudgeSent ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-sm text-emerald-400 font-medium">Nudge sent by DM</div>
                  <div className="mt-0.5 text-xs text-text-muted">{nudgeDelivery}</div>
                </div>
              </div>
            ) : (
              <textarea
                value={nudgeMessage}
                onChange={(e) => setNudgeMessage(e.target.value)}
                rows={4}
                placeholder="Type your message..."
                className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50 mb-4 resize-none"
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setNudgeTarget(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] rounded-xl transition-colors cursor-pointer"
              >
                {nudgeSent ? "Done" : "Cancel"}
              </button>
              {!nudgeSent && (
                <button
                  disabled={!nudgeMessage.trim() || nudgeSending}
                  onClick={() => {
                    const insightId = insights.find(i => i.action?.type === "nudge" && (i.action as { userId: string }).userId === nudgeTarget.userId)?.id;
                    if (insightId) sendNudge(insightId);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white gradient-accent rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {nudgeSending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </>
                  ) : "Send Nudge"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- Check-Ins Panel with weekly grouping + expandable items + reply ---

interface EnrichedCheckin {
  id: string;
  client_id: string;
  week_number: number;
  mood: CheckInMood;
  wins?: string;
  challenges?: string;
  questions?: string;
  admin_reply?: string;
  replied_at?: string;
  created_at: string;
  client_name: string;
  client_business: string;
  client_status: TrafficLight;
}

function getWeekBucket(dateStr: string): "this_week" | "last_week" | "earlier" {
  const now = new Date();
  const d = new Date(dateStr);
  const startOfThisWeek = new Date(now);
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfThisWeek.setDate(now.getDate() - diffToMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  if (d >= startOfThisWeek) return "this_week";
  if (d >= startOfLastWeek) return "last_week";
  return "earlier";
}

function CheckInsPanel({ checkins }: { checkins: EnrichedCheckin[] }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["earlier"]));
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [sentReplies, setSentReplies] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  const thisWeek = checkins.filter((c) => getWeekBucket(c.created_at) === "this_week");
  const lastWeek = checkins.filter((c) => getWeekBucket(c.created_at) === "last_week");
  const earlier = checkins.filter((c) => getWeekBucket(c.created_at) === "earlier");

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSection(key: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleReply(checkinId: string) {
    const text = replies[checkinId];
    if (!text?.trim()) return;
    setSendingReply(checkinId);
    setReplyError(null);

    try {
      const res = await fetch("/api/admin/reply-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkin_id: checkinId, reply_text: text }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send reply");
      }

      setSentReplies((prev) => ({ ...prev, [checkinId]: text }));
      setReplies((prev) => ({ ...prev, [checkinId]: "" }));
      toast("Reply sent successfully");
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to send reply");
      toast("Failed to send reply", "error");
    } finally {
      setSendingReply(null);
    }
  }

  const sections = [
    { key: "this_week", label: "This Week", items: thisWeek },
    { key: "last_week", label: "Last Week", items: lastWeek },
    { key: "earlier", label: "Earlier", items: earlier },
  ].filter((s) => s.items.length > 0);

  return (
    <div>
      <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Recent Check-Ins</h2>
      <div className="space-y-3">
        {sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.key);
          return (
            <div key={section.key} className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-[rgba(0,0,0,0.02)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{section.label}</span>
                  <span className="text-[10px] text-text-muted bg-[rgba(0,0,0,0.06)] px-2 py-0.5 rounded-full">
                    {section.items.length}
                  </span>
                  {section.items.some((c) => !c.admin_reply && !sentReplies[c.id]) && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
                      {section.items.filter((c) => !c.admin_reply && !sentReplies[c.id]).length} pending
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {!isCollapsed && (
                <div className="border-t border-[rgba(0,0,0,0.03)]">
                  {section.items.map((checkin) => (
                    <CheckInRow
                      key={checkin.id}
                      checkin={checkin}
                      isExpanded={expanded.has(checkin.id)}
                      onToggle={() => toggleExpand(checkin.id)}
                      replyText={replies[checkin.id] || ""}
                      onReplyChange={(text) => setReplies((prev) => ({ ...prev, [checkin.id]: text }))}
                      onReplySubmit={() => handleReply(checkin.id)}
                      sentReply={sentReplies[checkin.id]}
                      isSending={sendingReply === checkin.id}
                      error={sendingReply === checkin.id ? replyError : null}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckInRow({
  checkin,
  isExpanded,
  onToggle,
  replyText,
  onReplyChange,
  onReplySubmit,
  sentReply,
  isSending,
  error,
}: {
  checkin: EnrichedCheckin;
  isExpanded: boolean;
  onToggle: () => void;
  replyText: string;
  onReplyChange: (text: string) => void;
  onReplySubmit: () => void;
  sentReply?: string;
  isSending?: boolean;
  error?: string | null;
}) {
  const mc = moodConfig[checkin.mood];
  const hasReply = checkin.admin_reply || sentReply;

  return (
    <div className="border-b border-[rgba(0,0,0,0.02)] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 py-3 px-5 hover:bg-[rgba(0,0,0,0.02)] transition-colors text-left cursor-pointer"
      >
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full mt-0.5 uppercase tracking-wider flex-shrink-0 ${mc.bgClass} ${mc.textClass}`}>
          {checkin.mood}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-text-primary">{checkin.client_name}</span>
            <span className="text-[10px] text-text-muted">Week {checkin.week_number}</span>
          </div>
          {!isExpanded && (
            <p className="text-xs text-text-secondary truncate">
              {checkin.wins || checkin.challenges || checkin.questions || "No details"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasReply ? (
            <span className="text-[10px] text-emerald-400 font-medium">Replied</span>
          ) : (
            <span className="text-[10px] text-amber-400 font-medium">Pending</span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-4 pt-1 ml-[38px]">
          <div className="bg-[rgba(255,255,255,0.015)] border border-[rgba(0,0,0,0.06)] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-text-muted mb-2">
              <span>{checkin.client_business}</span>
              <span>{new Date(checkin.created_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
            </div>

            {checkin.wins && (
              <div>
                <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-1">Wins</div>
                <p className="text-xs text-text-secondary leading-relaxed">{checkin.wins}</p>
              </div>
            )}
            {checkin.challenges && (
              <div>
                <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider mb-1">Challenges</div>
                <p className="text-xs text-text-secondary leading-relaxed">{checkin.challenges}</p>
              </div>
            )}
            {checkin.questions && (
              <div>
                <div className="text-[10px] text-accent-bright font-semibold uppercase tracking-wider mb-1">Questions</div>
                <p className="text-xs text-text-secondary leading-relaxed">{checkin.questions}</p>
              </div>
            )}

            {/* Reply section */}
            {checkin.admin_reply ? (
              <div className="mt-2 pl-3 border-l-2 border-accent/30 bg-accent/5 rounded-r-lg py-2 pr-3">
                <div className="text-[10px] text-accent-bright font-semibold uppercase tracking-wider mb-1">Gordy&apos;s Reply</div>
                <p className="text-xs text-text-secondary leading-relaxed">{checkin.admin_reply}</p>
              </div>
            ) : sentReply ? (
              <div className="mt-2 pl-3 border-l-2 border-emerald-500/30 bg-emerald-500/5 rounded-r-lg py-2 pr-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Gordy&apos;s Reply</div>
                  <span className="text-[10px] text-emerald-400/60">Just now</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{sentReply}</p>
              </div>
            ) : (
              <div className="mt-2 pt-3 border-t border-[rgba(0,0,0,0.06)]">
                <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-2">Reply to this check-in</div>
                <textarea
                  value={replyText}
                  onChange={(e) => onReplyChange(e.target.value)}
                  rows={3}
                  placeholder="Type your reply..."
                  disabled={isSending}
                  className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none disabled:opacity-50"
                />
                {error && (
                  <div className="text-xs text-red-400 mt-1">{error}</div>
                )}
                <div className="flex justify-end mt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onReplySubmit(); }}
                    disabled={!replyText.trim() || isSending}
                    className="px-4 py-2 gradient-accent text-white rounded-lg text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity inline-flex items-center gap-1.5"
                  >
                    {isSending ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send Reply
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
