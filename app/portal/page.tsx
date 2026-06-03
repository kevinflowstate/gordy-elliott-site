"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import type { CalendarEvent, CheckIn, ClientProfile, ClientTask, TrainingPlanPhase } from "@/lib/types";

type Tier = "coached" | "premium" | "vip" | "ai_only";

const tierDisplay = {
  coached: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    accentClass: "border-emerald-500/20",
    supportTitle: "Coaching Support",
    supportCopy: "Your core coaching plan is live. Use this hub to stay on top of Gordy's priorities and your own daily actions.",
    heroCopy: "Start here for your priorities, your checklist, and the one or two things Gordy wants you focused on this week.",
    ctaLabel: "Open Weekly Check-in",
  },
  premium: {
    badgeClass: "border-sky-500/20 bg-sky-500/10 text-sky-500",
    accentClass: "border-sky-500/20",
    supportTitle: "Closer Support",
    supportCopy: "Use this dashboard as your weekly control center for deeper support and closer oversight.",
    heroCopy: "Start here for the priorities, check-ins, and support prompts that keep your week tighter and more accountable.",
    ctaLabel: "Open Check-in",
  },
  vip: {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-500",
    accentClass: "border-amber-500/20",
    supportTitle: "Priority Support",
    supportCopy: "Keep this front page tight so you can see your priorities, support points, and next key action at a glance.",
    heroCopy: "Start here for your highest-priority actions, upcoming touchpoints, and the details Gordy wants front and center this week.",
    ctaLabel: "Open Priority Check-in",
  },
  ai_only: {
    badgeClass: "border-[#E040D0]/20 bg-[#E040D0]/10 text-[#E040D0]",
    accentClass: "border-[#E040D0]/20",
    supportTitle: "AI Coaching",
    supportCopy: "SHIFT AI is your main support layer here. Keep your actions simple, track what matters, and use the portal as your daily self-coaching hub.",
    heroCopy: "Start here for your personal priorities, your checklist, and the actions that will keep your momentum moving.",
    ctaLabel: "Ask SHIFT AI",
  },
} as const satisfies Record<Tier, unknown>;

function getNextOccurrence(event: CalendarEvent): Date | null {
  const now = new Date();
  if (event.recurrence === "none") {
    const d = new Date(event.event_date);
    return d > now ? d : null;
  }
  const [hours, minutes] = event.event_time.split(":").map(Number);
  const targetDay = event.recurrence_day ?? 0;
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  const currentDay = next.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0 || (daysUntil === 0 && next <= now)) daysUntil += 7;
  next.setDate(next.getDate() + daysUntil);
  if (event.recurrence === "biweekly") {
    const start = new Date(event.event_date);
    const weeksDiff = Math.floor((next.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeksDiff % 2 !== 0) next.setDate(next.getDate() + 7);
  }
  return next;
}

function getNextCheckinDate(checkinDay: string) {
  const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const targetDay = dayMap[checkinDay.toLowerCase()] ?? 1;
  const now = new Date();
  const next = new Date(now);
  let daysUntil = targetDay - now.getDay();
  if (daysUntil < 0) daysUntil += 7;
  next.setDate(now.getDate() + daysUntil);
  return next;
}

function isToday(date: Date) {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

// Count consecutive weeks with a check-in, starting from most recent backwards
function computeCheckinStreak(checkins: CheckIn[]): number {
  if (!checkins.length) return 0;
  const sorted = [...checkins].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const weeks = new Set<number>();
  for (const c of sorted) {
    if (typeof c.week_number === "number") weeks.add(c.week_number);
  }
  const weekNums = Array.from(weeks).sort((a, b) => b - a);
  if (!weekNums.length) return 0;
  let streak = 1;
  for (let i = 1; i < weekNums.length; i++) {
    if (weekNums[i] === weekNums[i - 1] - 1) streak++;
    else break;
  }
  return streak;
}

interface RecentModule {
  id: string;
  title: string;
  created_at: string;
}

function SectionCard({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#E040D0]/18 bg-bg-card/95 p-5 shadow-[0_18px_46px_rgba(10,10,10,0.08)] ring-1 ring-white/60 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.18em] text-[#E040D0]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-6">
        <div className="mb-3 h-5 w-40 animate-pulse rounded-lg bg-[rgba(0,0,0,0.08)]" />
        <div className="mb-2 h-8 w-72 animate-pulse rounded-lg bg-[rgba(0,0,0,0.08)]" />
        <div className="h-4 w-52 animate-pulse rounded-lg bg-[rgba(0,0,0,0.06)]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-3xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-6">
              <div className="mb-4 h-5 w-32 animate-pulse rounded-lg bg-[rgba(0,0,0,0.08)]" />
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-12 animate-pulse rounded-2xl bg-[rgba(0,0,0,0.06)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-3xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-6">
              <div className="mb-4 h-5 w-28 animate-pulse rounded-lg bg-[rgba(0,0,0,0.08)]" />
              <div className="space-y-3">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="h-16 animate-pulse rounded-2xl bg-[rgba(0,0,0,0.06)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyTaskState({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-[rgba(0,0,0,0.08)] px-4 py-5 text-sm text-text-muted">{text}</p>;
}

export default function PortalDashboard() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [userName, setUserName] = useState("");
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [planPhases, setPlanPhases] = useState<TrainingPlanPhase[]>([]);
  const [checkinDay, setCheckinDay] = useState("monday");
  const [recentModules, setRecentModules] = useState<RecentModule[]>([]);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [personalTask, setPersonalTask] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoadError(null);
    try {
      const [dashboardRes, tasksRes] = await Promise.all([
        fetch("/api/portal/dashboard"),
        fetch("/api/portal/tasks"),
      ]);

      if (dashboardRes.ok) {
        const data = await dashboardRes.json();
        setProfile(data.profile);
        setUserName(data.userName);
        setCheckins(data.checkins || []);
        setPlanPhases(data.planPhases || []);
        setCheckinDay(data.checkinDay || "monday");
        setRecentModules(data.recentModules || []);
      } else {
        setLoadError("We couldn't load your dashboard. Pull-to-refresh or try again.");
      }

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      } else if (dashboardRes.ok) {
        // Dashboard loaded but tasks failed — softer signal
        toast("Couldn't load your tasks. They'll refresh next time.", "error");
      }
    } catch {
      setLoadError("We couldn't reach the portal just now. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function toggleTask(taskId: string, completed: boolean) {
    try {
      const res = await fetch("/api/portal/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, completed }),
      });

      if (!res.ok) {
        toast("Couldn't update that task. Try again in a moment.", "error");
        return;
      }
      setTasks((prev) => prev.map((task) => (
        task.id === taskId
          ? { ...task, completed, completed_at: completed ? new Date().toISOString() : undefined }
          : task
      )));
    } catch {
      toast("Couldn't update that task. Check your connection.", "error");
    }
  }

  async function addPersonalTask(e: React.FormEvent) {
    e.preventDefault();
    if (!personalTask.trim()) return;
    setSavingTask(true);
    try {
      const res = await fetch("/api/portal/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_text: personalTask }),
      });

      if (!res.ok) {
        toast("Couldn't save that reminder. Try again.", "error");
        return;
      }
      const data = await res.json();
      setTasks((prev) => [...prev, data.task]);
      setPersonalTask("");
    } catch {
      toast("Couldn't save that reminder. Check your connection.", "error");
    } finally {
      setSavingTask(false);
    }
  }

  const coachTasks = useMemo(() => tasks.filter((task) => task.source !== "client"), [tasks]);
  const personalTasks = useMemo(() => tasks.filter((task) => task.source === "client"), [tasks]);
  const incompleteCoachTasks = coachTasks.filter((task) => !task.completed);
  const incompletePersonalTasks = personalTasks.filter((task) => !task.completed);
  const totalOutstandingTasks = incompleteCoachTasks.length + incompletePersonalTasks.length;

  const allPlanItems = planPhases.flatMap((phase) => phase.items || []);
  const completedPlanItems = allPlanItems.filter((item) => item.completed).length;
  const totalPlanItems = allPlanItems.length;
  const planPct = totalPlanItems > 0 ? Math.round((completedPlanItems / totalPlanItems) * 100) : 0;
  const nextCheckinDate = getNextCheckinDate(checkinDay);
  const checkinToday = isToday(nextCheckinDate);
  const latestCheckin = checkins[0];
  const latestReply = checkins.find((checkin) => checkin.admin_reply);
  const checkinStreak = useMemo(() => computeCheckinStreak(checkins), [checkins]);
  const tier: Tier = (profile?.tier as Tier) || "coached";
  const isAiOnly = tier === "ai_only";

  // Submitted this week? Match check-in API week-start logic (Monday).
  const submittedThisWeek = useMemo(() => {
    if (!checkins.length) return false;
    const now = new Date();
    const weekStart = new Date(now);
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    return checkins.some((c) => new Date(c.created_at).getTime() >= weekStart.getTime());
  }, [checkins]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="-mx-4 min-h-[calc(100dvh-7rem)] space-y-5 bg-[radial-gradient(circle_at_8%_0%,rgba(224,64,208,0.13),transparent_30%),radial-gradient(circle_at_100%_12%,rgba(245,158,11,0.12),transparent_28%),linear-gradient(180deg,#fff7fc_0%,#fff_36%,#f7f3f5_100%)] px-4 pb-8 pt-1 sm:mx-0 sm:rounded-[32px] sm:p-6">
      {loadError && (
        <div className="flex flex-col gap-3 rounded-3xl border border-amber-500/25 bg-amber-500/8 px-5 py-4 text-sm text-amber-500 sm:flex-row sm:items-center sm:justify-between">
          <div>{loadError}</div>
          <button
            type="button"
            onClick={() => { setLoading(true); loadDashboard(); }}
            className="inline-flex w-fit items-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-500 transition-colors hover:bg-amber-500/15"
          >
            Retry
          </button>
        </div>
      )}
      <section className="overflow-hidden rounded-[30px] border border-[#E040D0]/20 bg-[#171018] px-5 py-5 text-white shadow-[0_20px_52px_rgba(74,18,67,0.22)] sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#F060E0]">SHIFT Today</div>
            <h1 className="mt-1 text-3xl font-heading font-bold leading-none text-white">
              {`Start here${userName ? `, ${userName.split(" ")[0]}` : ""}`}
            </h1>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Plan</div>
            <div className="text-lg font-heading font-bold text-white">{totalPlanItems > 0 ? `${planPct}%` : "Ready"}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">TODAY&apos;S PRIORITY</div>
            <div className="mt-1 text-sm font-semibold text-white">{totalOutstandingTasks > 0 ? `${totalOutstandingTasks} open` : "Clear"}</div>
          </div>
          {!isAiOnly && (
            <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">Check-in</div>
              <div className="mt-1 text-sm font-semibold text-white">{submittedThisWeek ? "Logged" : checkinToday ? "Due today" : nextCheckinDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</div>
            </div>
          )}
          <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">{isAiOnly ? "SHIFT AI" : "Gordy"}</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {isAiOnly ? "Ready" : latestReply?.admin_reply ? "Reply waiting" : "No new reply"}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title="TODAY'S PRIORITY"
          subtitle={isAiOnly ? "Keep the next action simple." : "The first thing to clear from Gordy's list."}
          right={isAiOnly ? (
            <Link href="/portal/ai" className="text-xs font-semibold text-accent-bright no-underline transition-colors hover:text-accent-light">
              SHIFT AI
            </Link>
          ) : null}
        >
          {isAiOnly ? (
            <div className="space-y-3">
              <p className="rounded-2xl border border-[#E040D0]/20 bg-[#E040D0]/8 px-4 py-4 text-sm font-medium leading-relaxed text-text-primary">
                Use SHIFT AI to choose one priority for today, then keep the rest of the portal out of the way.
              </p>
              {incompletePersonalTasks.length > 0 && (
                <details className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-text-secondary">Your reminders</summary>
                  <div className="mt-3 space-y-3">
                    {incompletePersonalTasks.map((task) => (
                      <label key={task.id} className="flex items-center gap-3 rounded-xl border border-[rgba(0,0,0,0.05)] bg-bg-card px-3 py-2">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={(e) => toggleTask(task.id, e.target.checked)}
                          className="h-4 w-4 cursor-pointer rounded border-2 border-[rgba(0,0,0,0.15)] accent-[#E040D0]"
                        />
                        <span className={`min-w-0 flex-1 text-sm ${task.completed ? "text-text-muted line-through" : "text-text-primary"}`}>{task.task_text}</span>
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : incompleteCoachTasks.length > 0 ? (
            <div className="space-y-3">
              {incompleteCoachTasks.slice(0, 3).map((task) => (
                <label key={task.id} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-[#E040D0]/12 bg-[linear-gradient(135deg,rgba(224,64,208,0.07),rgba(245,158,11,0.04))] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={(e) => toggleTask(task.id, e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-2 border-[rgba(0,0,0,0.15)] accent-[#E040D0]"
                  />
                  <span className="min-w-0 flex-1 text-sm text-text-primary">{task.task_text}</span>
                </label>
              ))}
              {(incompleteCoachTasks.length > 3 || incompletePersonalTasks.length > 0) && (
                <details className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-text-secondary">
                    {incompleteCoachTasks.length > 3
                      ? `${incompleteCoachTasks.length - 3} more coach ${incompleteCoachTasks.length - 3 === 1 ? "priority" : "priorities"}`
                      : "Your reminders"}
                  </summary>
                  <div className="mt-3 space-y-3">
                    {incompleteCoachTasks.slice(3).map((task) => (
                      <label key={task.id} className="flex items-center gap-3 rounded-xl border border-[rgba(0,0,0,0.05)] bg-bg-card px-3 py-2">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={(e) => toggleTask(task.id, e.target.checked)}
                          className="h-4 w-4 cursor-pointer rounded border-2 border-[rgba(0,0,0,0.15)] accent-[#E040D0]"
                        />
                        <span className="min-w-0 flex-1 text-sm text-text-primary">{task.task_text}</span>
                      </label>
                    ))}
                    {incompletePersonalTasks.map((task) => (
                      <label key={task.id} className="flex items-center gap-3 rounded-xl border border-[rgba(0,0,0,0.05)] bg-bg-card px-3 py-2">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={(e) => toggleTask(task.id, e.target.checked)}
                          className="h-4 w-4 cursor-pointer rounded border-2 border-[rgba(0,0,0,0.15)] accent-[#E040D0]"
                        />
                        <span className={`min-w-0 flex-1 text-sm ${task.completed ? "text-text-muted line-through" : "text-text-primary"}`}>{task.task_text}</span>
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : incompletePersonalTasks.length > 0 ? (
            <details open className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-text-secondary">Your reminders</summary>
              <div className="mt-3 space-y-3">
                {incompletePersonalTasks.map((task) => (
                  <label key={task.id} className="flex items-center gap-3 rounded-xl border border-[rgba(0,0,0,0.05)] bg-bg-card px-3 py-2">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={(e) => toggleTask(task.id, e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-2 border-[rgba(0,0,0,0.15)] accent-[#E040D0]"
                    />
                    <span className={`min-w-0 flex-1 text-sm ${task.completed ? "text-text-muted line-through" : "text-text-primary"}`}>{task.task_text}</span>
                  </label>
                ))}
              </div>
            </details>
          ) : (
            <EmptyTaskState text="No open priority from Gordy right now." />
          )}
          <details className="mt-3 rounded-2xl border border-dashed border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-text-secondary">Add reminder</summary>
            <form onSubmit={addPersonalTask} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={personalTask}
                onChange={(e) => setPersonalTask(e.target.value)}
                placeholder="Personal reminder"
                className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#E040D0]/40"
              />
              <button
                type="submit"
                disabled={savingTask || !personalTask.trim()}
                className="rounded-xl gradient-accent px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              >
                {savingTask ? "Adding..." : "Add"}
              </button>
            </form>
          </details>
        </SectionCard>

        {!isAiOnly && (
          <SectionCard
            title="CHECK-IN DUE"
            subtitle={submittedThisWeek ? "Logged for this week." : "Your weekly accountability point."}
            right={!submittedThisWeek && checkinToday ? null : (
              <Link href="/portal/checkin" className="text-xs font-semibold text-accent-bright no-underline transition-colors hover:text-accent-light">
                {submittedThisWeek ? "Update" : "Submit"}
              </Link>
            )}
          >
            <div className="rounded-2xl border border-[#E040D0]/12 bg-[linear-gradient(135deg,rgba(224,64,208,0.07),rgba(245,158,11,0.04))] px-4 py-4">
              <div className="text-lg font-heading font-bold text-text-primary">
                {submittedThisWeek
                  ? "Submitted this week"
                  : checkinToday
                    ? "Due today"
                    : nextCheckinDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
              </div>
              {latestCheckin?.week_number && (
                <div className="mt-1 text-xs text-text-muted">Latest check-in: Week {latestCheckin.week_number}</div>
              )}
              {!submittedThisWeek && checkinToday && (
                <Link href="/portal/checkin" className="mt-4 inline-flex w-full justify-center rounded-xl gradient-accent px-4 py-2.5 text-sm font-semibold text-white no-underline sm:w-auto">
                  Submit check-in
                </Link>
              )}
            </div>
          </SectionCard>
        )}

        {!isAiOnly && (
          <NextEventCard checkinToday={checkinToday} nextCheckinDate={nextCheckinDate} submittedThisWeek={submittedThisWeek} tier={tier} showCheckin={false} />
        )}

        {!isAiOnly && (
          <SectionCard
            title="GORDY'S REPLY"
            subtitle="Latest note back from your check-in."
            right={<Link href="/portal/checkin" className="text-xs font-semibold text-accent-bright no-underline transition-colors hover:text-accent-light">Open</Link>}
          >
            {latestReply?.admin_reply ? (
              <p className="rounded-2xl border border-[#E040D0]/18 bg-[#E040D0]/8 px-4 py-4 text-sm font-medium leading-relaxed text-text-primary">{latestReply.admin_reply}</p>
            ) : (
              <EmptyTaskState text="No new reply from Gordy yet." />
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function VipPriorityStrip({
  checkinToday,
  submittedThisWeek,
  nextCheckinDate,
  topCoachTask,
  openCoachTasks,
  latestReply,
}: {
  checkinToday: boolean;
  submittedThisWeek: boolean;
  nextCheckinDate: Date;
  topCoachTask: string | null;
  openCoachTasks: number;
  latestReply: string | null;
}) {
  const nextTouchLabel = submittedThisWeek
    ? "Check-in already submitted this week"
    : checkinToday
      ? "Check-in due today"
      : `Next check-in · ${nextCheckinDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}`;

  return (
    <section className="rounded-[28px] border border-amber-500/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),rgba(0,0,0,0.02))] px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-500 text-sm font-bold">
            !
          </span>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">Gordy&apos;s Priority Focus</div>
            <div className="mt-1 text-sm font-semibold text-text-primary">
              {topCoachTask
                ? topCoachTask
                : openCoachTasks > 0
                  ? "Check your coach priorities below."
                  : "No open priorities from Gordy. Use this week to push the plan."}
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              {nextTouchLabel}
              {latestReply ? " · coach reply waiting in your lane" : ""}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/portal/checkin"
            className="rounded-xl gradient-accent px-4 py-2 text-xs font-semibold text-white no-underline"
          >
            {submittedThisWeek ? "Update Check-in" : "Open Priority Check-in"}
          </Link>
          <Link
            href="/portal/calendar"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-500 no-underline hover:bg-amber-500/15"
          >
            Calendar
          </Link>
        </div>
      </div>
    </section>
  );
}

function TierSupportLane({
  tier,
  checkinToday,
  submittedThisWeek,
  nextCheckinDate,
  latestReply,
  latestReplyDate,
  topCoachTask,
  openCoachTasks,
  planPct,
}: {
  tier: "premium" | "vip";
  checkinToday: boolean;
  submittedThisWeek: boolean;
  nextCheckinDate: Date;
  latestReply: string | null;
  latestReplyDate: string | null;
  topCoachTask: string | null;
  openCoachTasks: number;
  planPct: number;
}) {
  const isVip = tier === "vip";
  const touchLabel = submittedThisWeek
    ? "Submitted this week"
    : checkinToday
      ? "Check-in due today"
      : nextCheckinDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  const replyAge = useMemo(() => {
    if (!latestReplyDate) return null;
    const d = Math.floor((new Date().getTime() - new Date(latestReplyDate).getTime()) / (1000 * 60 * 60 * 24));
    if (d <= 0) return "today";
    if (d === 1) return "1 day ago";
    return `${d} days ago`;
  }, [latestReplyDate]);

  return (
    <SectionCard
      title={isVip ? "Priority Support Lane" : "Support Lane"}
      subtitle={isVip ? "A tighter view of the support points Gordy wants kept visible." : "Your elevated support view for staying close to the plan this week."}
      right={<div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${isVip ? "border-amber-500/20 bg-amber-500/10 text-amber-500" : "border-sky-500/20 bg-sky-500/10 text-sky-500"}`}>Support</div>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Next Touchpoint</div>
          <div className="mt-2 text-sm font-semibold text-text-primary">{touchLabel}</div>
          <div className="mt-1 text-sm text-text-secondary">
            {isVip ? "Keep this visible so Gordy's support cadence stays obvious." : "Use this as your weekly accountability anchor."}
          </div>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Coach Focus</div>
          <div className="mt-2 text-sm font-semibold text-text-primary">
            {topCoachTask || (openCoachTasks > 0 ? "See your coach priorities list." : "No coach priority is overdue right now.")}
          </div>
          <div className="mt-1 text-sm text-text-secondary">
            {topCoachTask
              ? openCoachTasks > 1
                ? `${openCoachTasks} open priorities — this is the first to clear.`
                : "If this is still open, this is the first thing to clear."
              : `Training plan is ${planPct}% complete.`}
          </div>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-4 sm:col-span-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{isVip ? "Coach Reply Lane" : "Support Lane"}</div>
          <div className="mt-2 text-sm font-semibold text-text-primary">
            {latestReply
              ? `A coach reply is sitting in your dashboard${replyAge ? ` · ${replyAge}` : ""}.`
              : isVip
                ? "No fresh reply is waiting, so use your check-in or calendar to stay connected."
                : "No fresh reply is waiting, so keep your next check-in and plan actions tight."}
          </div>
          {latestReply && <p className="mt-2 text-sm leading-relaxed text-text-secondary">{latestReply}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/portal/checkin" className="rounded-xl gradient-accent px-3 py-2 text-xs font-semibold text-white no-underline">
              Open Check-in
            </Link>
            <Link href="/portal/calendar" className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-card px-3 py-2 text-xs font-semibold text-text-primary no-underline">
              Open Calendar
            </Link>
            <Link href="/portal/ai" className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-card px-3 py-2 text-xs font-semibold text-text-primary no-underline">
              Ask SHIFT AI
            </Link>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function NextEventCard({
  checkinToday,
  nextCheckinDate,
  submittedThisWeek,
  tier,
  showCheckin = true,
}: {
  checkinToday: boolean;
  nextCheckinDate: Date;
  submittedThisWeek: boolean;
  tier: Tier;
  showCheckin?: boolean;
}) {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [nextDate, setNextDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarError, setCalendarError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/calendar");
        if (!res.ok) {
          setCalendarError(true);
          return;
        }
        const data = await res.json();
        const events: CalendarEvent[] = data.events || [];
        let earliest: { event: CalendarEvent; date: Date } | null = null;

        for (const candidate of events) {
          const occurrence = getNextOccurrence(candidate);
          if (occurrence && (!earliest || occurrence < earliest.date)) {
            earliest = { event: candidate, date: occurrence };
          }
        }

        if (earliest) {
          setEvent(earliest.event);
          setNextDate(earliest.date);
        }
      } catch {
        setCalendarError(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const checkinLabel = submittedThisWeek
    ? "Submitted"
    : checkinToday
      ? "Due today"
      : nextCheckinDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });

  return (
    <SectionCard
      title="Upcoming"
      subtitle="What's coming up next so nothing catches you cold."
      right={
        showCheckin && checkinToday && !submittedThisWeek ? (
          <Link href="/portal/checkin" className="rounded-xl gradient-accent px-3 py-2 text-xs font-semibold text-white no-underline">
            {tier === "vip" ? "Priority check-in" : "Check-in now"}
          </Link>
        ) : null
      }
    >
      <div className="space-y-3">
        {showCheckin && (
          <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Weekly Check-in</div>
            <div className="mt-2 text-sm font-semibold text-text-primary">{checkinLabel}</div>
            {submittedThisWeek && (
              <div className="mt-1 text-xs text-text-muted">You can update it any time before the week ends.</div>
            )}
          </div>
          )}

        {loading ? (
          <div className="h-16 animate-pulse rounded-2xl bg-[rgba(0,0,0,0.06)]" />
        ) : calendarError ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-500">
            Couldn&apos;t load your calendar. Try refreshing the page.
          </div>
        ) : event && nextDate ? (
          <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Calendar Event</div>
            <div className="mt-2 text-sm font-semibold text-text-primary">{event.title}</div>
            <div className="mt-1 text-sm text-text-secondary">
              {nextDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
              {event.event_time ? ` at ${event.event_time}` : ""}
            </div>
            {event.link && (
              <a href={event.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-xs font-semibold text-accent-bright no-underline">
                {event.link_label || "Open event"}
              </a>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[rgba(0,0,0,0.08)] px-4 py-5 text-sm text-text-muted">
            No upcoming calendar events right now.
          </div>
        )}
      </div>
    </SectionCard>
  );
}
