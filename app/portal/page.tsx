"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { CalendarEvent, ClientProfile, ClientTask } from "@/lib/types";
import type { WearableDailySummary } from "@/lib/wearable-insights";
import FounderDashboard from "@/components/portal/FounderDashboard";
import type { CapacityBaseline, CapacityMetrics } from "@/lib/capacity-baseline";
import type { StormWarningClientState } from "@/lib/storm-warning";
import type { EarlyWinView } from "@/lib/early-win";
import type { WeeklyCapacityResult } from "@/lib/weekly-capacity";
import MonthlyCallPrompt from "@/components/portal/MonthlyCallPrompt";

type BaselineComparison = {
  baseline: CapacityBaseline | null;
  current: { period_start: string; period_end: string; metrics: CapacityMetrics };
  comparison: Record<keyof CapacityMetrics, {
    baseline: number | null;
    current: number | null;
    delta: number | null;
    direction: "improved" | "declined" | "unchanged" | "missing";
  }> | null;
  month4Review?: {
    review_date: string;
    outcome_note: string;
    completed_at: string | null;
    source_period: { start: string; end: string } | null;
    comparison_period: { start: string; end: string } | null;
  } | null;
};

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
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
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [wearableSummary, setWearableSummary] = useState<WearableDailySummary | null>(null);
  const [wearableMockMode, setWearableMockMode] = useState(false);
  const [todayTraining, setTodayTraining] = useState<string | null>(null);
  const [activeTrainingPlan, setActiveTrainingPlan] = useState<string | null>(null);
  const [baselineComparison, setBaselineComparison] = useState<BaselineComparison | null>(null);
  const [stormWarning, setStormWarning] = useState<StormWarningClientState | null>(null);
  const [earlyWinView, setEarlyWinView] = useState<EarlyWinView | null>(null);
  const [weeklyCapacity, setWeeklyCapacity] = useState<WeeklyCapacityResult | null | undefined>(undefined);

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
        const [calendarRes, integrationsRes, exercisePlanRes, baselineRes, weeklyCapacityRes] = await Promise.all([
          fetch("/api/calendar"),
          fetch("/api/portal/integrations"),
          fetch("/api/portal/exercise-plan"),
          fetch("/api/portal/capacity-baseline"),
          fetch("/api/portal/weekly-capacity"),
        ]);
        const data = calendarRes.ok ? await calendarRes.json() : { events: [] };
        const events: CalendarEvent[] = data.events || [];
        if (active) setCalendarEvents(events);
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
        if (weeklyCapacityRes.ok) {
          const weeklyCapacityData = await weeklyCapacityRes.json();
          if (active) setWeeklyCapacity(weeklyCapacityData);
        } else if (active) {
          setWeeklyCapacity(null);
        }
      } catch {
        if (active) setWeeklyCapacity(null);
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

  async function addPersonalTask(taskText: string) {
    try {
      const res = await fetch("/api/portal/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_text: taskText }),
      });
      if (!res.ok) {
        toast("Couldn't save that reminder. Try again.", "error");
        return false;
      }
      const data = await res.json();
      setTasks((current) => [...current, data.task]);
      return true;
    } catch {
      toast("Couldn't save that reminder. Check your connection.", "error");
      return false;
    }
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  // Every coached programme shares one Home composition. Programme type still
  // controls calls and entitlements, but it must never swap the entire screen.
  if (profile) {
    return (
      <div className="space-y-5" data-testid="unified-client-home" data-programme={profile.programme_type || "capacity"}>
        <MonthlyCallPrompt />
        {loadError && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/8 px-5 py-4 text-sm text-amber-300 sm:flex-row sm:items-center sm:justify-between">
            <div>{loadError}</div>
            <button
              type="button"
              onClick={() => { setLoading(true); void loadDashboard(); }}
              className="inline-flex min-h-11 w-fit items-center rounded-xl border border-amber-400/30 px-4 py-2 text-xs font-semibold text-amber-200"
            >
              Retry
            </button>
          </div>
        )}
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
          weeklyCapacity={weeklyCapacity}
          onToggleTask={(taskId, completed) => void toggleTask(taskId, completed)}
          onAddTask={addPersonalTask}
          onDismissStormWarning={() => void dismissStormWarning()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-amber-500/25 bg-amber-500/8 px-5 py-5 text-sm text-amber-200" data-testid="client-home-load-error">
      <p>{loadError || "We couldn't load your coaching profile just now."}</p>
      <button
        type="button"
        onClick={() => { setLoading(true); void loadDashboard(); }}
        className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-amber-400/30 px-4 py-2 text-xs font-semibold text-amber-100"
      >
        Retry
      </button>
    </div>
  );
}
