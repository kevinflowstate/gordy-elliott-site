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

function getQuickAccessCards(tier: Tier, totalPlanItems: number, completedPlanItems: number) {
  const cards = [
    {
      href: "/portal/exercise-plan",
      title: "Training Plan",
      description: totalPlanItems > 0 ? `${completedPlanItems}/${totalPlanItems} actions done` : "Open today's session",
    },
    {
      href: "/portal/nutrition-plan",
      title: "Nutrition",
      description: "Keep your daily food plan close",
    },
    {
      href: "/portal/daily-tracker",
      title: "Daily Tracker",
      description: "Sleep, water, energy, stress",
    },
    {
      href: "/portal/progress",
      title: "Insights",
      description: "Recovery, trends, photos, and progress",
    },
  ];

  if (tier === "premium" || tier === "vip") {
    cards.splice(2, 0, {
      href: "/portal/calendar",
      title: "Calendar",
      description: tier === "vip" ? "Stay close to every support touchpoint" : "Keep your week and check-ins visible",
    });
  }

  if (tier === "vip") {
    cards.push({
      href: "/portal/checkin",
      title: "Priority Check-in",
      description: "Log what Gordy needs to review first",
    });
  }

  if (tier === "ai_only") {
    cards.push({
      href: "/portal/ai",
      title: "SHIFT AI",
      description: "Your always-on coaching support",
    });
  }

  return cards;
}

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
    <section className="rounded-3xl border border-[#E040D0]/15 bg-bg-card p-5 shadow-[0_12px_32px_rgba(10,10,10,0.06)] sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-heading font-bold text-text-primary">{title}</h2>
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
  const currentWeek = checkins.length > 0 ? checkins[0].week_number : 1;
  const nextCheckinDate = getNextCheckinDate(checkinDay);
  const checkinToday = isToday(nextCheckinDate);
  const latestCheckin = checkins[0];
  const latestReply = checkins.find((checkin) => checkin.admin_reply);
  const checkinStreak = useMemo(() => computeCheckinStreak(checkins), [checkins]);
  const tier: Tier = (profile?.tier as Tier) || "coached";
  const tierInfo = tierDisplay[tier];
  const quickAccessCards = getQuickAccessCards(tier, totalPlanItems, completedPlanItems);
  const isAiOnly = tier === "ai_only";
  const isHighTouch = tier === "premium" || tier === "vip";

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

  const focusItems = [
    totalOutstandingTasks > 0
      ? `${totalOutstandingTasks} task${totalOutstandingTasks === 1 ? "" : "s"} still open`
      : "Your task list is clear",
    submittedThisWeek
      ? `Check-in logged for this week${latestCheckin?.week_number ? ` (Week ${latestCheckin.week_number})` : ""}`
      : checkinToday
        ? "Your weekly check-in is due today"
        : `Next check-in: ${nextCheckinDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}`,
    totalPlanItems > 0 ? `Training plan is ${planPct}% complete` : "Your training plan is ready to start",
  ];

  if (loading) {
    return <DashboardSkeleton />;
  }

  // Hero styling changes when check-in is due today for high-touch tiers
  const heroBg = checkinToday && !submittedThisWeek && tier === "vip"
    ? "bg-[radial-gradient(circle_at_20%_0%,rgba(245,158,11,0.14),transparent_42%),linear-gradient(135deg,rgba(245,158,11,0.07),rgba(224,64,208,0.04)_58%,transparent)] border-amber-500/25"
    : checkinToday && !submittedThisWeek && tier === "premium"
      ? "bg-[radial-gradient(circle_at_20%_0%,rgba(14,165,233,0.14),transparent_42%),linear-gradient(135deg,rgba(14,165,233,0.07),rgba(224,64,208,0.04)_58%,transparent)] border-sky-500/25"
      : "bg-[radial-gradient(circle_at_20%_0%,rgba(224,64,208,0.14),transparent_42%),linear-gradient(135deg,rgba(224,64,208,0.07),rgba(224,64,208,0.035)_58%,transparent)] border-[#E040D0]/15";

  return (
    <div className="space-y-6">
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
      <section className={`relative overflow-hidden rounded-[32px] border px-6 py-7 sm:px-8 ${heroBg}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(224,64,208,0.12),transparent_58%)] pointer-events-none" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl rounded-3xl border border-[rgba(0,0,0,0.06)] bg-bg-card/85 p-5 shadow-sm backdrop-blur-sm sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#E040D0]">
              {tier === "ai_only" ? "Self-Coaching Hub" : "Personal Dashboard"}
            </div>
            <h1 className="text-3xl font-heading font-bold text-text-primary sm:text-4xl">
              {`What matters most${userName ? `, ${userName.split(" ")[0]}` : ""}`}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary sm:text-base">
              {tierInfo.heroCopy}
            </p>
            {!isAiOnly && !submittedThisWeek && checkinToday && (
              <Link
                href="/portal/checkin"
                className="mt-4 inline-flex items-center gap-2 rounded-xl gradient-accent px-4 py-2.5 text-sm font-semibold text-white no-underline"
              >
                Submit this week&apos;s check-in
              </Link>
            )}
            {isAiOnly && incompleteCoachTasks.length === 0 && incompletePersonalTasks.length === 0 && (
              <Link
                href="/portal/ai"
                className="mt-4 inline-flex items-center gap-2 rounded-xl gradient-accent px-4 py-2.5 text-sm font-semibold text-white no-underline"
              >
                Ask SHIFT AI what to focus on
              </Link>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[430px]">
            <div className={`rounded-2xl border bg-bg-card/80 px-4 py-3 ${tierInfo.accentClass}`}>
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Open Tasks</div>
              <div className="mt-2 text-2xl font-heading font-bold text-text-primary">{totalOutstandingTasks}</div>
            </div>
            <div className={`rounded-2xl border bg-bg-card/80 px-4 py-3 ${tierInfo.accentClass}`}>
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                {isHighTouch ? "Check-in Streak" : "Training Week"}
              </div>
              <div className="mt-2 text-2xl font-heading font-bold text-text-primary">
                {isHighTouch ? `${checkinStreak}` : `Week ${currentWeek}`}
              </div>
              {isHighTouch && (
                <div className="text-[10px] text-text-muted mt-0.5">
                  {checkinStreak === 0 ? "Start this week" : checkinStreak === 1 ? "week in a row" : "weeks in a row"}
                </div>
              )}
            </div>
            <div className={`rounded-2xl border bg-bg-card/80 px-4 py-3 ${tierInfo.accentClass}`}>
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Status</div>
              <div className="mt-2 text-lg font-heading font-bold text-text-primary">
                {checkinToday && !submittedThisWeek
                  ? "Check-in today"
                  : profile?.status === "green"
                    ? "On track"
                    : profile?.status === "amber"
                      ? "Needs attention"
                      : "Reset this week"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Priority clients get a prominent strip immediately below the hero. */}
      {tier === "vip" && (
        <VipPriorityStrip
          checkinToday={checkinToday}
          submittedThisWeek={submittedThisWeek}
          nextCheckinDate={nextCheckinDate}
          topCoachTask={incompleteCoachTasks[0]?.task_text || null}
          openCoachTasks={incompleteCoachTasks.length}
          latestReply={latestReply?.admin_reply || null}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          {!isAiOnly && (
            <SectionCard
              title="Coach Priorities"
              subtitle={
                tier === "vip"
                  ? "The highest-priority actions Gordy wants visible right now."
                  : tier === "premium"
                    ? "What Gordy wants you focused on, with closer support this week."
                    : "What Gordy has set for you right now."
              }
              right={
                <Link
                  href="/portal/checkin"
                  className="text-xs font-semibold text-accent-bright no-underline transition-colors hover:text-accent-light"
                >
                  Weekly check-in
                </Link>
              }
            >
              {coachTasks.length === 0 ? (
                <EmptyTaskState text="No coach priorities have been added yet. Gordy can set tasks here so your weekly focus is crystal clear." />
              ) : (
                <div className="space-y-3">
                  {coachTasks.map((task) => (
                    <label key={task.id} className="flex items-center gap-3 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(e) => toggleTask(task.id, e.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-2 border-[rgba(0,0,0,0.15)] accent-[#E040D0]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm ${task.completed ? "text-text-muted line-through" : "text-text-primary"}`}>{task.task_text}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
                          {task.completed ? "Completed" : "From Gordy"}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {isAiOnly && (
            <SectionCard
              title="SHIFT AI Focus"
              subtitle="Your AI coach is your primary support layer — use it to set direction, plan sessions, and stay honest with progress."
              right={
                <Link href="/portal/ai" className="text-xs font-semibold text-accent-bright no-underline transition-colors hover:text-accent-light">
                  Open SHIFT AI
                </Link>
              }
            >
              <div className="space-y-3">
                <div className="rounded-2xl border border-[#E040D0]/15 bg-[#E040D0]/6 px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#E040D0]">Prompt idea</div>
                  <p className="mt-2 text-sm leading-relaxed text-text-primary">
                    &ldquo;Based on my last check-in and plan, what are the two things I should focus on this week?&rdquo;
                  </p>
                </div>
                <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Prompt idea</div>
                  <p className="mt-2 text-sm leading-relaxed text-text-primary">
                    &ldquo;Help me plan today&apos;s session so it matches my energy and what&apos;s already on my plan.&rdquo;
                  </p>
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard
            title="Your Checklist"
            subtitle="Quick personal reminders you want to keep front and center."
          >
            <form onSubmit={addPersonalTask} className="mb-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={personalTask}
                onChange={(e) => setPersonalTask(e.target.value)}
                placeholder="Add a personal reminder for this week"
                className="w-full rounded-2xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#E040D0]/40 transition-colors"
              />
              <button
                type="submit"
                disabled={savingTask || !personalTask.trim()}
                className="rounded-2xl gradient-accent px-5 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              >
                {savingTask ? "Adding..." : "Add"}
              </button>
            </form>

            {personalTasks.length === 0 ? (
              <EmptyTaskState text="Use this as your own quick-fire list so the home screen becomes the first place you check each day." />
            ) : (
              <div className="space-y-3">
                {personalTasks.map((task) => (
                  <label key={task.id} className="flex items-center gap-3 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={(e) => toggleTask(task.id, e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-2 border-[rgba(0,0,0,0.15)] accent-[#E040D0]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${task.completed ? "text-text-muted line-through" : "text-text-primary"}`}>{task.task_text}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">Personal reminder</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Quick Access"
            subtitle={
              tier === "vip"
                ? "Your key training, support, and accountability touchpoints."
                : tier === "premium"
                  ? "The places you'll use most to stay close to your plan."
                  : tier === "ai_only"
                    ? "Your daily self-coaching surfaces."
                    : "Jump straight into the parts of the portal you'll use most."
            }
          >
            <div className={`grid gap-3 ${quickAccessCards.length > 3 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
              {quickAccessCards.map((card) => (
                <Link key={card.href} href={card.href} className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary p-4 no-underline transition-all hover:-translate-y-0.5 hover:border-[#E040D0]/25">
                  <div className="text-sm font-semibold text-text-primary">{card.title}</div>
                  <div className="mt-1 text-sm text-text-secondary">{card.description}</div>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          {isHighTouch && (
            <TierSupportLane
              tier={tier}
              checkinToday={checkinToday}
              submittedThisWeek={submittedThisWeek}
              nextCheckinDate={nextCheckinDate}
              latestReply={latestReply?.admin_reply || null}
              latestReplyDate={latestReply?.replied_at || latestReply?.created_at || null}
              topCoachTask={incompleteCoachTasks[0]?.task_text || null}
              openCoachTasks={incompleteCoachTasks.length}
              planPct={planPct}
            />
          )}

          {/* "This Week" — action-first focus points + latest coach reply (kept tight) */}
          <SectionCard
            title="This Week"
            subtitle="The short version of where things stand."
          >
            <div className="space-y-3">
              {focusItems.map((item, idx) => (
                <div key={`focus-${idx}`} className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3 text-sm text-text-primary">
                  {item}
                </div>
              ))}
              {!isAiOnly && latestReply?.admin_reply && (
                <div className="rounded-2xl border border-[#E040D0]/15 bg-[#E040D0]/6 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#E040D0]">Latest Reply</div>
                  <p className="mt-2 text-sm leading-relaxed text-text-primary">{latestReply.admin_reply}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {!isAiOnly && (
            <NextEventCard checkinToday={checkinToday} nextCheckinDate={nextCheckinDate} submittedThisWeek={submittedThisWeek} tier={tier} />
          )}

          {recentModules.length > 0 && (
            <SectionCard
              title="New For You"
              subtitle="Fresh training content from Gordy."
            >
              <div className="space-y-2">
                {recentModules.slice(0, 3).map((module) => (
                  <Link
                    key={module.id}
                    href={`/portal/training/${module.id}`}
                    className="flex items-center justify-between rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-3 no-underline transition-colors hover:border-[#E040D0]/25 min-h-[56px]"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="text-sm font-medium text-text-primary truncate">{module.title}</div>
                      <div className="mt-0.5 text-xs text-text-muted">{new Date(module.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                    </div>
                    <span className="text-xs font-semibold text-accent-bright flex-shrink-0">Open</span>
                  </Link>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
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
}: {
  checkinToday: boolean;
  nextCheckinDate: Date;
  submittedThisWeek: boolean;
  tier: Tier;
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
        checkinToday && !submittedThisWeek ? (
          <Link href="/portal/checkin" className="rounded-xl gradient-accent px-3 py-2 text-xs font-semibold text-white no-underline">
            {tier === "vip" ? "Priority check-in" : "Check-in now"}
          </Link>
        ) : null
      }
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-primary px-4 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Weekly Check-in</div>
          <div className="mt-2 text-sm font-semibold text-text-primary">{checkinLabel}</div>
          {submittedThisWeek && (
            <div className="mt-1 text-xs text-text-muted">You can update it any time before the week ends.</div>
          )}
        </div>

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
