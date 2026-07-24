"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { getCoachNoteOfDay } from "@/lib/coach-quotes";
import type { CalendarEvent, CheckIn, ClientProfile, ClientTask, TrainingPlanPhase } from "@/lib/types";
import type { WearableDailySummary } from "@/lib/wearable-insights";
import FounderDashboard from "@/components/portal/FounderDashboard";
import type { CapacityBaseline, CapacityMetrics } from "@/lib/capacity-baseline";
import type { StormWarningClientState } from "@/lib/storm-warning";
import type { EarlyWinView } from "@/lib/early-win";

type Tier = "coached" | "premium" | "vip" | "ai_only";
type BaselineComparison = {
  baseline: CapacityBaseline | null;
  current: { period_start: string; period_end: string; metrics: CapacityMetrics };
  comparison: Record<keyof CapacityMetrics, {
    baseline: number | null;
    current: number | null;
    delta: number | null;
    direction: "improved" | "declined" | "unchanged" | "missing";
  }> | null;
};

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
    supportCopy: "AT CAPACITY AI is your main support layer here. Keep your actions simple, track what matters, and use the portal as your daily self-coaching hub.",
    heroCopy: "Start here for your personal priorities, your checklist, and the actions that will keep your momentum moving.",
    ctaLabel: "Ask AT CAPACITY AI",
  },
} as const satisfies Record<Tier, unknown>;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getWeekNumber(startDate?: string | null): number | null {
  if (!startDate) return null;
  const start = new Date(startDate).getTime();
  if (Number.isNaN(start) || start > Date.now()) return null;
  return Math.max(1, Math.ceil((Date.now() - start) / (7 * 24 * 60 * 60 * 1000)));
}

function ProgressRing({ pct, label, sublabel }: { pct: number; label: string; sublabel: string }) {
  const size = 148;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className="relative h-[132px] w-[132px] flex-shrink-0 sm:h-[148px] sm:w-[148px]">
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="ring-accent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#B830A8" />
            <stop offset="100%" stopColor="#F060E0" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ring-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)", filter: "drop-shadow(0 0 8px rgba(224, 64, 208, 0.45))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="metric-num text-[2.1rem] font-bold leading-none text-white sm:text-[2.4rem]">{clamped}<span className="text-base text-white/55 sm:text-lg">%</span></div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#F7A8EE]">{label}</div>
        <div className="mt-0.5 text-[10px] text-white/55">{sublabel}</div>
      </div>
    </div>
  );
}

function MetricTile({ value, unit, label, hint }: { value: string; unit?: string; label: string; hint: string }) {
  return (
    <div className="app-hero-tile min-w-0 rounded-2xl px-2.5 py-3 sm:px-3">
      <div className="metric-num text-xl font-bold leading-none text-white sm:text-[1.5rem]">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-white/55">{unit}</span>}
      </div>
      <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">{label}</div>
      <div className="mt-0.5 text-[10px] leading-4 text-white/50">{hint}</div>
    </div>
  );
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

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
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
    <section className="app-card app-rise app-rise-2 rounded-[28px] p-5 sm:p-6">
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
        <div className="mb-2 h-8 w-72 max-w-full animate-pulse rounded-lg bg-[rgba(0,0,0,0.08)]" />
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
  const [nextEvent, setNextEvent] = useState<{ title: string; date: Date } | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [wearableSummary, setWearableSummary] = useState<WearableDailySummary | null>(null);
  const [wearableMockMode, setWearableMockMode] = useState(false);
  const [todayTraining, setTodayTraining] = useState<string | null>(null);
  const [activeTrainingPlan, setActiveTrainingPlan] = useState<string | null>(null);
  const [baselineComparison, setBaselineComparison] = useState<BaselineComparison | null>(null);
  const [stormWarning, setStormWarning] = useState<StormWarningClientState | null>(null);
  const [earlyWinView, setEarlyWinView] = useState<EarlyWinView | null>(null);

  const loadStormWarning = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/storm-warning");
      if (res.ok) setStormWarning(await res.json());
    } catch {
      /* The dashboard simply stays quiet without an evaluation. */
    }
  }, []);

  const dismissStormWarning = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/storm-warning", { method: "POST" });
      if (res.ok) setStormWarning(await res.json());
    } catch {
      /* Leave the warning visible if the dismissal could not be saved. */
    }
  }, []);

  useEffect(() => {
    void loadStormWarning();
  }, [loadStormWarning]);

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

  // Surface the next calendar event in the hero "Upcoming" tile.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [calendarRes, integrationsRes, exercisePlanRes, baselineRes] = await Promise.all([
          fetch("/api/calendar"),
          fetch("/api/portal/integrations"),
          fetch("/api/portal/exercise-plan"),
          fetch("/api/portal/capacity-baseline"),
        ]);
        const data = calendarRes.ok ? await calendarRes.json() : { events: [] };
        const events: CalendarEvent[] = data.events || [];
        if (active) setCalendarEvents(events);
        let earliest: { title: string; date: Date } | null = null;
        for (const candidate of events) {
          const occurrence = getNextOccurrence(candidate);
          if (occurrence && (!earliest || occurrence < earliest.date)) {
            earliest = { title: candidate.title, date: occurrence };
          }
        }
        if (active) setNextEvent(earliest);
        if (integrationsRes.ok) {
          const integrations = await integrationsRes.json();
          if (active) {
            setWearableSummary(integrations.latestSummary || null);
            setWearableMockMode(Boolean(integrations.mockMode));
          }
        }
        if (exercisePlanRes.ok) {
          const exerciseData = await exercisePlanRes.json();
          const exercisePlan = exerciseData.plan as {
            id: string;
            name: string;
            sessions: Array<{ id: string; name: string }>;
          } | null;
          if (active) setActiveTrainingPlan(exercisePlan?.name || null);
          if (exercisePlan) {
            const today = new Date();
            const day = today.getDay();
            const monday = new Date(today);
            monday.setDate(today.getDate() + (day === 0 ? -6 : 1 - day));
            const plannerRes = await fetch(
              `/api/portal/training-planner?plan_id=${exercisePlan.id}&week_start=${localDateKey(monday)}`,
            );
            if (plannerRes.ok) {
              const plannerData = await plannerRes.json();
              const assignment = (plannerData.assignments || []).find(
                (item: { planned_date: string | null }) => item.planned_date === localDateKey(today),
              );
              const session = assignment
                ? exercisePlan.sessions.find((item) => item.id === assignment.session_id)
                : null;
              if (active) setTodayTraining(session?.name || null);
            }
          }
        }
        if (baselineRes.ok) {
          const baselineData = await baselineRes.json();
          if (active) setBaselineComparison(baselineData);
        }
      } catch {
        /* Upcoming tile falls back to the calendar link. */
      }
    })();
    return () => { active = false; };
  }, []);

  // The early win card exists only after Gordy explicitly creates one.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/portal/early-win");
        if (!res.ok) return;
        const data = await res.json();
        if (active) setEarlyWinView(data?.earlyWin ? data : null);
      } catch {
        /* The card simply stays hidden. */
      }
    })();
    return () => { active = false; };
  }, []);

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

  const coachNote = getCoachNoteOfDay();

  const weekNumber = getWeekNumber(profile?.start_date);
  const todayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const ringPct = totalPlanItems > 0 ? planPct : submittedThisWeek ? 100 : 0;
  const ringLabel = totalPlanItems > 0 ? "Plan" : "This Week";
  const ringSublabel = totalPlanItems > 0
    ? `${completedPlanItems} of ${totalPlanItems} actions`
    : submittedThisWeek
      ? "check-in logged"
      : "check-in due";

  // When Gordy has no open priority, never show a dead/empty state — surface a
  // useful, plan-aware fallback so the home always has a next action.
  const fallbackPriority = useMemo(() => {
    if (!submittedThisWeek && (checkinToday || isAiOnly === false)) {
      return {
        label: checkinToday ? "Check-in is due today" : "Weekly check-in",
        body: checkinToday
          ? "Take two minutes to log how the week went — it's what Gordy reviews."
          : "Stay ahead of it. A quick check-in keeps your coaching on track.",
        href: "/portal/checkin",
        cta: "Open check-in",
      };
    }
    if (totalPlanItems > 0 && planPct < 100) {
      return {
        label: "Keep the plan moving",
        body: `You're ${planPct}% through your current plan. Pick up the next session and log it.`,
        href: "/portal/exercise-plan",
        cta: "Go to training",
      };
    }
    const rotation = [
      { label: "Recovery focus", body: "Nothing scheduled today — treat it as recovery. Sleep, water, light movement.", href: "/portal/daily-tracker", cta: "Log recovery" },
      { label: "Stay on top of nutrition", body: "Quiet training day is the perfect time to nail your nutrition. Log today's totals.", href: "/portal/nutrition-plan", cta: "Open nutrition" },
      { label: "Quick daily check", body: "Log sleep, energy and stress so the trends Gordy sees stay accurate.", href: "/portal/daily-tracker", cta: "Open daily tracker" },
    ];
    return rotation[new Date().getDate() % rotation.length];
  }, [submittedThisWeek, checkinToday, isAiOnly, totalPlanItems, planPct]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (profile?.experience_mode === "founder_dashboard") {
    return (
      <FounderDashboard
        profile={profile}
        userName={userName}
        tasks={tasks}
        calendarEvents={calendarEvents}
        wearableSummary={wearableSummary}
        wearableMockMode={wearableMockMode}
        todayTraining={todayTraining}
        activeTrainingPlan={activeTrainingPlan}
        baselineComparison={baselineComparison}
        stormWarning={stormWarning}
        earlyWin={earlyWinView}
        onToggleTask={(taskId, completed) => void toggleTask(taskId, completed)}
        onDismissStormWarning={() => void dismissStormWarning()}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 pb-8 pt-1 sm:max-w-2xl">
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
      <section className="app-hero app-rise app-rise-1 flex flex-col overflow-hidden rounded-[24px] px-4 py-4 text-white sm:rounded-[30px] sm:px-6 sm:py-5">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#F7A8EE]">AT CAPACITY Today</div>
          <h1 className="mt-1 text-2xl font-heading font-bold leading-none text-white sm:text-3xl">
            {`${getGreeting()}${userName ? `, ${userName.split(" ")[0]}` : ""}`}
          </h1>
          <p className="mt-1.5 text-[13px] text-white/60">
            {todayLabel}
            {weekNumber ? ` · Week ${weekNumber}` : ""}
          </p>
        </div>

        {/* Data first: programme ring + the three numbers that matter */}
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          <ProgressRing pct={ringPct} label={ringLabel} sublabel={ringSublabel} />
          <div className="grid w-full flex-1 grid-cols-3 gap-2">
            <MetricTile
              value={totalPlanItems > 0 ? `${completedPlanItems}/${totalPlanItems}` : "—"}
              label="Plan"
              hint={totalPlanItems > 0 ? "actions done" : "plan incoming"}
            />
            <MetricTile
              value={submittedThisWeek ? "Done" : checkinToday ? "Today" : nextCheckinDate.toLocaleDateString("en-GB", { weekday: "short" })}
              label="Check-in"
              hint={submittedThisWeek ? "logged this week" : checkinToday ? "due today — get it in" : "next check-in"}
            />
            <MetricTile
              value={`${checkinStreak}`}
              unit={checkinStreak === 1 ? "wk" : "wks"}
              label="Streak"
              hint="consecutive check-ins"
            />
          </div>
        </div>

        {/* Coach note of the day */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#F060E0]/22 bg-[#E040D0]/10 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#F7A8EE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 8h10M7 12h6m-6 8l-3 1 1-4a8 8 0 1116 0 8 8 0 01-11 7.3" />
          </svg>
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium leading-snug text-white/92">&ldquo;{coachNote.line}&rdquo;</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#F7A8EE]/80">{coachNote.tag} · note of the day</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Link
            href="#priorities"
            className="app-hero-tile flex min-h-[78px] flex-col justify-between rounded-2xl px-3.5 py-3 no-underline"
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Today&apos;s Priority</div>
            <div>
              <div className="text-[15px] font-semibold text-white">{totalOutstandingTasks > 0 ? `${totalOutstandingTasks} open` : fallbackPriority.label}</div>
              <div className="mt-0.5 line-clamp-2 text-[11px] text-white/50">{totalOutstandingTasks > 0 ? "Tap to action" : fallbackPriority.body}</div>
            </div>
          </Link>

          {!isAiOnly && (
            <Link
              href="/portal/checkin"
              className="app-hero-tile flex min-h-[78px] flex-col justify-between rounded-2xl px-3.5 py-3 no-underline"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Check-in</div>
              <div>
                <div className="text-[15px] font-semibold text-white">{submittedThisWeek ? "Logged" : checkinToday ? "Due today" : nextCheckinDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</div>
                <div className="mt-0.5 text-[11px] text-white/50">{submittedThisWeek ? "Update this week" : "Open check-in"}</div>
              </div>
            </Link>
          )}

          <Link
            href="/portal/calendar"
            className="app-hero-tile flex min-h-[78px] flex-col justify-between rounded-2xl px-3.5 py-3 no-underline"
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Upcoming</div>
            <div>
              <div className="line-clamp-2 text-[15px] font-semibold leading-tight text-white">{nextEvent ? nextEvent.title : "Nothing booked"}</div>
              <div className="mt-0.5 text-[11px] text-white/50">{nextEvent ? nextEvent.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "Open calendar"}</div>
            </div>
          </Link>

          <Link
            href={isAiOnly ? "/portal/ai" : "/portal/checkin"}
            className="app-hero-tile flex min-h-[78px] flex-col justify-between rounded-2xl px-3.5 py-3 no-underline"
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">{isAiOnly ? "AT CAPACITY AI" : "Gordy's Messages"}</div>
            <div>
              <div className="text-[15px] font-semibold text-white">{isAiOnly ? "Ask anything" : latestReply?.admin_reply ? "Reply waiting" : "No new reply"}</div>
              <div className="mt-0.5 text-[11px] text-white/50">{isAiOnly ? "Open AT CAPACITY AI" : "View replies"}</div>
            </div>
          </Link>
        </div>
      </section>

      <div id="priorities" className="scroll-mt-4">
        <SectionCard
          title="TODAY'S PRIORITY"
          subtitle={isAiOnly ? "Keep the next action simple." : "The first thing to clear from Gordy's list."}
          right={isAiOnly ? (
            <Link href="/portal/ai" className="text-xs font-semibold text-accent-bright no-underline transition-colors hover:text-accent-light">
              AT CAPACITY AI
            </Link>
          ) : null}
        >
          {isAiOnly ? (
            <div className="space-y-3">
              <p className="rounded-2xl border border-[#E040D0]/20 bg-[#E040D0]/8 px-4 py-4 text-sm font-medium leading-relaxed text-text-primary">
                Use AT CAPACITY AI to choose one priority for today, then keep the rest of the portal out of the way.
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
            <Link
              href={fallbackPriority.href}
              className="app-tap block rounded-2xl border border-[#E040D0]/20 bg-[linear-gradient(135deg,rgba(224,64,208,0.12),rgba(245,158,11,0.05))] px-4 py-4 no-underline"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E040D0]/20 text-[#F060E0]">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#F060E0]">{fallbackPriority.label}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{fallbackPriority.body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#F060E0]">
                {fallbackPriority.cta}
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </span>
            </Link>
          )}
          <details className="app-inset mt-3 rounded-2xl px-4 py-3">
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
              Ask AT CAPACITY AI
            </Link>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
