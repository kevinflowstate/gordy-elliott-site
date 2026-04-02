"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { AdminClient } from "@/lib/admin-data";
import type { TrafficLight, CheckInMood, TrainingPlan, TrainingPlanPhase, CheckinFormConfig, FormQuestion, ClientExercisePlan, ClientNutritionPlan, ProgressMetric, ClientTask } from "@/lib/types";
import TrainingPlanBuilder from "@/components/admin/TrainingPlanBuilder";
import ExerciseTemplatePicker from "@/components/admin/ExerciseTemplatePicker";
import NutritionTemplatePicker from "@/components/admin/NutritionTemplatePicker";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot } from "recharts";
import PhotoGallery from "@/components/portal/PhotoGallery";

type TabId = "dashboard" | "checkins" | "training" | "nutrition" | "gallery" | "tasks";

const glowClass: Record<TrafficLight, string> = {
  green: "glow-green",
  amber: "glow-amber",
  red: "glow-red",
};

const statusConfig: Record<TrafficLight, { label: string; dotClass: string; bgClass: string; textClass: string; ringClass: string }> = {
  red: { label: "Needs Attention", dotClass: "bg-red-500", bgClass: "bg-red-500/10", textClass: "text-red-400", ringClass: "ring-red-500" },
  amber: { label: "Check In Due", dotClass: "bg-amber-500", bgClass: "bg-amber-500/10", textClass: "text-amber-400", ringClass: "ring-amber-500" },
  green: { label: "On Track", dotClass: "bg-emerald-500", bgClass: "bg-emerald-500/10", textClass: "text-emerald-400", ringClass: "ring-emerald-500" },
};

const moodConfig: Record<CheckInMood, { bgClass: string; textClass: string }> = {
  great: { bgClass: "bg-emerald-500/10", textClass: "text-emerald-400" },
  good: { bgClass: "bg-blue-500/10", textClass: "text-blue-400" },
  okay: { bgClass: "bg-amber-500/10", textClass: "text-amber-400" },
  struggling: { bgClass: "bg-red-500/10", textClass: "text-red-400" },
};

const categoryIcons: Record<string, string> = {
  "Financial Foundation": "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "Pipeline & Sales": "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  "Team & People": "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  "Systems & Operations": "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  "Standards & Quality": "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
};

function getPhaseIcon(phaseName: string): string {
  const lower = phaseName.toLowerCase();
  if (lower.includes("financial") || lower.includes("pricing") || lower.includes("revenue")) return categoryIcons["Financial Foundation"];
  if (lower.includes("pipeline") || lower.includes("sales") || lower.includes("visibility") || lower.includes("growth")) return categoryIcons["Pipeline & Sales"];
  if (lower.includes("team") || lower.includes("hire") || lower.includes("people")) return categoryIcons["Team & People"];
  if (lower.includes("system") || lower.includes("operation") || lower.includes("quality") || lower.includes("standard")) return categoryIcons["Systems & Operations"];
  return categoryIcons["Standards & Quality"];
}

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

function timeAgoDetailed(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${diffHrs}hr ago`;
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

interface PhotoGroup {
  date: string;
  front?: string;
  back?: string;
  side?: string;
  signedUrls: Record<string, string>;
}

interface AdminGalleryTabProps {
  clientId: string;
  groups: PhotoGroup[];
  loading: boolean;
  loaded: boolean;
  onLoad: (groups: PhotoGroup[]) => void;
  onLoadStart: () => void;
}

function AdminGalleryTab({ clientId, groups, loading, loaded, onLoad, onLoadStart }: AdminGalleryTabProps) {
  const onLoadRef = useRef(onLoad);
  const onLoadStartRef = useRef(onLoadStart);
  onLoadRef.current = onLoad;
  onLoadStartRef.current = onLoadStart;

  useEffect(() => {
    if (loaded || loading) return;
    onLoadStartRef.current();
    fetch(`/api/admin/client-photos?clientId=${clientId}`)
      .then((r) => r.json())
      .then((data) => onLoadRef.current(data.groups || []))
      .catch(() => onLoadRef.current([]));
  }, [clientId, loaded, loading]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-heading font-bold text-text-primary">Progress Photos</h2>
      <PhotoGallery groups={groups} loading={loading} />
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [client, setClient] = useState<AdminClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryPlan, setExpandedHistoryPlan] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<"closed" | "create" | "edit">("closed");
  const [internalNotes, setInternalNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [coachNotes, setCoachNotes] = useState("");
  const [coachNotesSaving, setCoachNotesSaving] = useState(false);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [sentReplies, setSentReplies] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [expandedCheckins, setExpandedCheckins] = useState<Set<string>>(new Set());
  const [contentLookup, setContentLookup] = useState<Map<string, { title: string; moduleName: string; moduleId: string; duration?: number }>>(new Map());
  const [checkinConfig, setCheckinConfig] = useState<CheckinFormConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeConfirmText, setRevokeConfirmText] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newClientPassword, setNewClientPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [exercisePlans, setExercisePlans] = useState<ClientExercisePlan[]>([]);
  const [nutritionPlans, setNutritionPlans] = useState<ClientNutritionPlan[]>([]);
  const [recentExerciseLogs, setRecentExerciseLogs] = useState<Array<{ id: string; exercise_item_id: string; session_id: string | null; log_date: string; sets_data: Array<{ set_number: number; weight: string; reps: string; notes: string }>; completed: boolean }>>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showNutritionPicker, setShowNutritionPicker] = useState(false);
  const [assigningExercise, setAssigningExercise] = useState(false);
  const [assigningNutrition, setAssigningNutrition] = useState(false);
  const [nudgeSending, setNudgeSending] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [checkinDay, setCheckinDay] = useState<string>("");
  const [checkinDaySaving, setCheckinDaySaving] = useState(false);
  const [clientTier, setClientTier] = useState<string>("coached");
  const [tierSaving, setTierSaving] = useState(false);
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [goalPrimary, setGoalPrimary] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [goalNotes, setGoalNotes] = useState("");
  const [goalsSaving, setGoalsSaving] = useState(false);
  const [galleryGroups, setGalleryGroups] = useState<Array<{ date: string; front?: string; back?: string; side?: string; signedUrls: Record<string, string> }>>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [newTaskText, setNewTaskText] = useState("");

  const loadClient = useCallback(async () => {
    try {
      const [clientRes, trainingRes, configRes] = await Promise.all([
        fetch(`/api/admin/clients/${id}`),
        fetch("/api/admin/training"),
        fetch("/api/admin/form-config?type=checkin"),
      ]);

      if (clientRes.ok) {
        const data = await clientRes.json();
        setClient(data.client);
        setPlans(data.client?.training_plan || []);
        const activePlan = (data.client?.training_plan || []).find((p: TrainingPlan) => p.status === "active");
        setExpandedPhases(new Set(activePlan?.phases.map((ph: TrainingPlanPhase) => ph.id) || []));
        setInternalNotes(data.client?.internal_notes || "");
        setCoachNotes(data.client?.coach_notes || "");
        setCheckinDay(data.client?.checkin_day || "");
        setClientTier(data.client?.tier || "coached");
        setGoalPrimary(data.client?.primary_goal || "");
        setGoalTargetDate(data.client?.target_date || "");
        setGoalNotes(data.client?.goal_notes || "");
      }

      if (trainingRes.ok) {
        const tData = await trainingRes.json();
        const lookup = new Map<string, { title: string; moduleName: string; moduleId: string; duration?: number }>();
        for (const mod of tData.modules || []) {
          for (const c of mod.content || []) {
            lookup.set(c.id, { title: c.title, moduleName: mod.title, moduleId: mod.id, duration: c.duration_minutes });
          }
        }
        setContentLookup(lookup);
      }

      if (configRes.ok) {
        const cfgData = await configRes.json();
        setCheckinConfig(cfgData.config);
      }

      if (id) {
        const [exRes, nutRes] = await Promise.all([
          fetch(`/api/admin/client-exercise-plans?clientId=${id}`),
          fetch(`/api/admin/client-nutrition-plans?clientId=${id}`),
        ]);
        if (exRes.ok) {
          const exData = await exRes.json();
          setExercisePlans(exData.plans || []);
        }
        if (nutRes.ok) {
          const nutData = await nutRes.json();
          setNutritionPlans(nutData.plans || []);
        }
        const logsRes = await fetch(`/api/admin/client-exercise-logs?clientId=${id}`);
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setRecentExerciseLogs(logsData.logs || []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadClient(); }, [loadClient]);

  async function loadTasks() {
    if (!client) return;
    const res = await fetch(`/api/admin/client-tasks?clientId=${client.id}`);
    if (res.ok) { const data = await res.json(); setTasks(data.tasks || []); }
  }

  useEffect(() => { if (activeTab === "tasks" && client) { loadTasks(); } }, [activeTab, client?.id]);

  async function addTask() {
    if (!newTaskText.trim() || !client) return;
    const res = await fetch("/api/admin/client-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: client.id, task_text: newTaskText.trim() }),
    });
    if (res.ok) { setNewTaskText(""); loadTasks(); }
  }

  async function deleteTask(taskId: string) {
    await fetch(`/api/admin/client-tasks?id=${taskId}`, { method: "DELETE" });
    loadTasks();
  }

  async function handleAssignExercisePlan(templateId: string) {
    setAssigningExercise(true);
    try {
      const res = await fetch("/api/admin/client-exercise-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: id, template_id: templateId }),
      });
      if (res.ok) { setShowExercisePicker(false); loadClient(); }
    } finally { setAssigningExercise(false); }
  }

  async function handleAssignNutritionPlan(templateId: string) {
    setAssigningNutrition(true);
    try {
      const res = await fetch("/api/admin/client-nutrition-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: id, template_id: templateId }),
      });
      if (res.ok) { setShowNutritionPicker(false); loadClient(); }
    } finally { setAssigningNutrition(false); }
  }

  async function handleArchiveExercisePlan(planId: string) {
    await fetch("/api/admin/client-exercise-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: planId, status: "archived" }),
    });
    loadClient();
  }

  async function handleUnassignExercisePlan(planId: string) {
    await fetch("/api/admin/client-exercise-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: planId, status: "inactive" }),
    });
    loadClient();
  }

  async function saveCheckinDay(day: string) {
    if (!client) return;
    setCheckinDaySaving(true);
    await fetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkin_day: day }),
    });
    setCheckinDaySaving(false);
  }

  async function saveTier(tier: string) {
    if (!client) return;
    setTierSaving(true);
    await fetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    setTierSaving(false);
  }

  async function handleArchiveNutritionPlan(planId: string) {
    await fetch("/api/admin/client-nutrition-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: planId, status: "archived" }),
    });
    loadClient();
  }

  async function handleReply(checkinId: string) {
    const text = replyTexts[checkinId];
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
      setReplyTexts((prev) => ({ ...prev, [checkinId]: "" }));
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSendingReply(null);
    }
  }

  async function saveCoachNotes() {
    if (!client) return;
    setCoachNotesSaving(true);
    await fetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coach_notes: coachNotes }),
    });
    setCoachNotesSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-text-muted text-sm">Loading client...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-text-muted">
        <Link href="/admin/clients" className="text-accent-bright hover:text-accent-light transition-colors no-underline text-sm">
          Back to Clients
        </Link>
        <p className="mt-4">Client not found.</p>
      </div>
    );
  }

  const activePlans = plans.filter((p) => p.status === "active");
  const activePlan = activePlans.find((p) => p.phases.length > 0) || activePlans[0];
  const completedPlans = plans.filter((p) => p.status === "completed");
  const sc = statusConfig[client.status];

  const allItems = activePlan?.phases.flatMap((ph) => ph.items) || [];
  const planTotal = allItems.length;
  const planDone = allItems.filter((p) => p.completed).length;
  const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

  const now = new Date();
  const lastLoginDays = Math.floor((now.getTime() - new Date(client.last_login).getTime()) / (1000 * 60 * 60 * 24));
  const lastCheckinDays = Math.floor((now.getTime() - new Date(client.last_checkin).getTime()) / (1000 * 60 * 60 * 24));
  const weeksSinceStart = Math.floor((now.getTime() - new Date(client.start_date).getTime()) / (1000 * 60 * 60 * 24 * 7));
  const totalWeeksCount = Math.max(weeksSinceStart, client.current_week);
  const expectedCheckins = weeksSinceStart;
  const actualCheckins = client.checkins.length;
  const missedCheckins = Math.max(0, expectedCheckins - actualCheckins);

  // Weight trend from check-ins
  const checkinsWithWeight = client.checkins
    .filter((c) => {
      const w = c.responses?.weight || c.responses?.current_weight;
      return w && !isNaN(parseFloat(w));
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const latestWeight = checkinsWithWeight.length > 0
    ? parseFloat(checkinsWithWeight[checkinsWithWeight.length - 1].responses?.weight || checkinsWithWeight[checkinsWithWeight.length - 1].responses?.current_weight || "0")
    : null;
  const prevWeight = checkinsWithWeight.length > 1
    ? parseFloat(checkinsWithWeight[checkinsWithWeight.length - 2].responses?.weight || checkinsWithWeight[checkinsWithWeight.length - 2].responses?.current_weight || "0")
    : null;
  const startWeightVal = client.start_weight || (checkinsWithWeight.length > 0 ? parseFloat(checkinsWithWeight[0].responses?.weight || checkinsWithWeight[0].responses?.current_weight || "0") : null);
  const weightTrend = latestWeight && prevWeight ? latestWeight - prevWeight : null;

  // Build trend chart data for weight and other progress metrics
  const weightChartData = checkinsWithWeight.slice(-8).map((c) => ({
    date: new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    value: parseFloat(c.responses?.weight || c.responses?.current_weight || "0"),
  }));

  // Build trend data for other enabled progress metrics from checkin config
  const otherMetricTrends: Array<{ metric: ProgressMetric; data: Array<{ date: string; value: number }> }> =
    (checkinConfig?.progress_tracking || [])
      .filter((m) => m.enabled && m.id !== "weight" && m.id !== "current_weight")
      .map((m) => {
        const data = client.checkins
          .filter((c) => {
            const v = c.responses?.[m.id];
            return v !== undefined && v !== "" && !isNaN(parseFloat(v));
          })
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(-8)
          .map((c) => ({
            date: new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
            value: parseFloat(c.responses![m.id]),
          }));
        return { metric: m, data };
      })
      .filter((t) => t.data.length >= 2);

  async function toggleItem(phaseId: string, itemId: string) {
    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.status !== "active") return plan;
        return {
          ...plan,
          phases: plan.phases.map((phase) => {
            if (phase.id !== phaseId) return phase;
            return {
              ...phase,
              items: phase.items.map((item) =>
                item.id === itemId
                  ? { ...item, completed: !item.completed, completed_at: !item.completed ? new Date().toISOString() : undefined }
                  : item
              ),
            };
          }),
        };
      })
    );
    const res = await fetch(`/api/admin/plan-items/${itemId}`, { method: "PATCH" });
    if (!res.ok) {
      setPlans((prev) =>
        prev.map((plan) => {
          if (plan.status !== "active") return plan;
          return {
            ...plan,
            phases: plan.phases.map((phase) => {
              if (phase.id !== phaseId) return phase;
              return {
                ...phase,
                items: phase.items.map((item) =>
                  item.id === itemId
                    ? { ...item, completed: !item.completed, completed_at: !item.completed ? new Date().toISOString() : undefined }
                    : item
                ),
              };
            }),
          };
        })
      );
    }
  }

  function togglePhase(phaseId: string) {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }

  async function handleSavePlan(plan: TrainingPlan) {
    const existingActive = plans.find((p) => p.status === "active" && p.id !== plan.id);
    if (existingActive && !plans.find((p) => p.id === plan.id)) {
      await fetch("/api/admin/training-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", plan_id: existingActive.id }),
      });
    }
    await fetch("/api/admin/training-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    await loadClient();
    setBuilderMode("closed");
  }

  async function saveNotes() {
    if (!client) return;
    setNotesSaving(true);
    await fetch(`/api/admin/internal-notes/${client.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: internalNotes }),
    });
    setNotesSaving(false);
  }

  async function handleSaveGoals() {
    if (!client) return;
    setGoalsSaving(true);
    await fetch("/api/admin/client-goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: client.id,
        primary_goal: goalPrimary,
        target_date: goalTargetDate,
        goal_notes: goalNotes,
      }),
    });
    setGoalsSaving(false);
    setGoalsModalOpen(false);
    loadClient();
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "checkins", label: "Check-ins" },
    { id: "training", label: "Training" },
    { id: "nutrition", label: "Nutrition" },
    { id: "gallery", label: "Gallery" },
    { id: "tasks", label: "Tasks" },
  ];

  return (
    <>
      {/* Back link */}
      <Link
        href="/admin"
        className="text-text-muted text-sm hover:text-text-secondary transition-colors no-underline inline-flex items-center gap-1 mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>

      {/* Top bar - client identity */}
      <div className={`bg-bg-card border rounded-2xl p-6 mb-6 transition-all duration-300 overflow-visible ${glowClass[client.status]}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Left: avatar + name */}
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${sc.bgClass} ${sc.textClass} border ${
              client.status === "red" ? "border-red-500/30" : client.status === "amber" ? "border-amber-500/30" : "border-emerald-500/30"
            }`}>
              {client.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-text-primary leading-tight">{client.name}</h1>
              <p className="text-text-secondary text-sm mt-0.5">{client.email}</p>
              {(client.business_name || client.business_type) && (
                <p className="text-text-muted text-xs mt-0.5">{[client.business_name, client.business_type].filter(Boolean).join(" - ")}</p>
              )}
            </div>
          </div>

          {/* Right: last active + actions */}
          <div className="flex flex-col items-start sm:items-end gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${sc.bgClass} ${sc.textClass}`}>
                <span className={`w-2 h-2 rounded-full ${sc.dotClass}`} />
                {sc.label}
              </span>
              <span className="text-xs text-text-muted bg-[rgba(0,0,0,0.04)] px-2.5 py-1.5 rounded-full">
                Last active: {timeAgoDetailed(client.last_login)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowExercisePicker(true); }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#E040D0] hover:bg-[#b830a8] rounded-lg transition-colors"
              >
                Assign Workout
              </button>
              <button
                onClick={() => { setShowNutritionPicker(true); }}
                className="px-3 py-1.5 text-xs font-medium text-text-secondary border border-[rgba(0,0,0,0.08)] hover:border-[rgba(0,0,0,0.15)] rounded-lg transition-colors"
              >
                Nutrition Plan
              </button>
              <div className="relative">
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-white/5 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                {settingsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-xl shadow-xl py-1 min-w-[180px]">
                      <button
                        onClick={() => { setSettingsOpen(false); setPasswordModalOpen(true); setNewClientPassword(""); setPasswordResult(null); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-white/5 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        Set Password
                      </button>
                      <button
                        onClick={() => { setSettingsOpen(false); setRevokeModalOpen(true); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Revoke Access
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {/* Check-in Day */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-4">
          <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-1.5">Check-in Day</div>
          <div className="flex items-center gap-1.5">
            <select
              value={checkinDay}
              onChange={async (e) => {
                const day = e.target.value;
                setCheckinDay(day);
                await saveCheckinDay(day);
              }}
              className="text-sm font-bold text-text-primary bg-transparent border-none outline-none cursor-pointer w-full"
            >
              <option value="">Not set</option>
              {["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map((d) => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>
          {checkinDaySaving && <div className="text-[10px] text-text-muted mt-1">Saving...</div>}
        </div>

        {/* Tier */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-4">
          <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-1.5">Tier</div>
          <div className="flex items-center gap-1.5">
            <select
              value={clientTier}
              onChange={async (e) => {
                const t = e.target.value;
                setClientTier(t);
                await saveTier(t);
              }}
              className="text-sm font-bold text-text-primary bg-transparent border-none outline-none cursor-pointer w-full"
            >
              <option value="coached">Coached</option>
              <option value="ai_only">AI Only</option>
            </select>
          </div>
          {tierSaving && <div className="text-[10px] text-text-muted mt-1">Saving...</div>}
        </div>

        {/* Total Weeks */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-4">
          <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-1.5">Total Weeks</div>
          <div className="text-2xl font-heading font-bold text-text-primary">{totalWeeksCount}</div>
          <div className="text-[11px] text-text-muted">since {new Date(client.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
        </div>

        {/* Start Weight */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-4">
          <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-1.5">Start Weight</div>
          {startWeightVal ? (
            <div className="text-2xl font-heading font-bold text-text-primary">{startWeightVal}<span className="text-sm font-normal text-text-muted ml-1">kg</span></div>
          ) : (
            <div className="text-sm text-text-muted">—</div>
          )}
        </div>

        {/* Current Weight */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-4">
          <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-1.5">Current Weight</div>
          {latestWeight ? (
            <div className="flex items-center gap-1.5">
              <div className="text-2xl font-heading font-bold text-text-primary">{latestWeight}<span className="text-sm font-normal text-text-muted ml-1">kg</span></div>
              {weightTrend !== null && (
                <span className={`text-xs font-semibold ${weightTrend < 0 ? "text-emerald-400" : weightTrend > 0 ? "text-red-400" : "text-text-muted"}`}>
                  {weightTrend < 0 ? "▼" : weightTrend > 0 ? "▲" : "—"}{Math.abs(weightTrend).toFixed(1)}
                </span>
              )}
            </div>
          ) : (
            <div className="text-sm text-text-muted">—</div>
          )}
        </div>

        {/* Goal */}
        <div className="bg-bg-card border border-[#E040D0]/20 rounded-xl p-4 cursor-pointer hover:border-[#E040D0]/40 transition-colors" onClick={() => { setGoalPrimary(client.primary_goal || ""); setGoalTargetDate(client.target_date || ""); setGoalNotes(client.goal_notes || ""); setGoalsModalOpen(true); }}>
          <div className="text-[10px] text-[#E040D0] font-semibold uppercase tracking-wider mb-1.5">Goal</div>
          {client.primary_goal ? (
            <div className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">{client.primary_goal}</div>
          ) : (
            <div className="text-sm text-text-muted">Tap to set</div>
          )}
        </div>

        {/* Status */}
        <div className={`border rounded-xl p-4 ${sc.bgClass}`}>
          <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-1.5">Status</div>
          <div className={`flex items-center gap-1.5`}>
            <span className={`w-2 h-2 rounded-full ${sc.dotClass}`} />
            <span className={`text-sm font-bold ${sc.textClass}`}>{sc.label}</span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {lastCheckinDays === 0 ? "Checked in today" : `${lastCheckinDays}d since check-in`}
          </div>
        </div>
      </div>

      {/* Alert banners */}
      {client.status === "red" && (
        <div className="bg-red-500/[0.06] border border-red-500/20 rounded-2xl px-5 py-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-red-400 mb-0.5">This client needs attention</div>
              <div className="text-xs text-text-secondary leading-relaxed">
                Last login was <span className="text-red-400 font-medium">{lastLoginDays} days ago</span>
                {missedCheckins > 0 && (
                  <> and they have <span className="text-red-400 font-medium">missed {missedCheckins} check-in{missedCheckins !== 1 ? "s" : ""}</span></>
                )}
                . Consider reaching out directly to re-engage.
              </div>
            </div>
          </div>
          <button
            onClick={() => { setNudgeOpen(true); setNudgeSent(false); setNudgeMessage(`Hey ${client.name.split(" ")[0]}, just checking in - haven't seen you in the portal for a bit. Everything OK? Jump back in when you're ready, your plan is waiting.`); }}
            className="mt-3 ml-11 px-4 py-2 text-xs font-semibold text-white gradient-accent rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Send Nudge
          </button>
        </div>
      )}

      {client.status === "amber" && (
        <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl px-5 py-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-amber-400 mb-0.5">Check-in overdue</div>
              <div className="text-xs text-text-secondary leading-relaxed">
                Last check-in was <span className="text-amber-400 font-medium">{lastCheckinDays} days ago</span>
                {missedCheckins > 0 && (
                  <> - <span className="text-amber-400 font-medium">{missedCheckins} check-in{missedCheckins !== 1 ? "s" : ""} missed</span></>
                )}
                . A quick nudge might help keep momentum.
              </div>
            </div>
          </div>
          <button
            onClick={() => { setNudgeOpen(true); setNudgeSent(false); setNudgeMessage(`Hey ${client.name.split(" ")[0]}, your weekly check-in is due. Takes 2 minutes - let me know how things are going.`); }}
            className="mt-3 ml-11 px-4 py-2 text-xs font-semibold text-white gradient-accent rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Send Nudge
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-[rgba(0,0,0,0.06)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-semibold transition-colors relative ${
              activeTab === tab.id
                ? "text-[#E040D0]"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E040D0] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Dashboard Tab ── */}
      {activeTab === "dashboard" && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Activity Log */}
          <div>
            <h3 className="text-sm font-heading font-bold text-text-primary mb-3">Activity</h3>
            <ActivityTimeline clientId={client.id} />

            {/* Programme Timeline */}
            <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-5 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-heading font-bold text-text-primary">Programme Timeline</h3>
                <span className="text-xs text-text-muted">
                  Wk {client.current_week} of {totalWeeksCount}
                </span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalWeeksCount, 16) }).map((_, i) => {
                  const weekNum = i + 1;
                  const isCurrent = weekNum === client.current_week;
                  const isComplete = weekNum < client.current_week;
                  return (
                    <div
                      key={i}
                      className={`flex-1 h-6 rounded flex items-center justify-center text-[9px] font-semibold transition-all relative ${
                        isCurrent
                          ? "bg-[#E040D0]/20 text-[#E040D0] border border-[#E040D0]/40"
                          : isComplete
                          ? "bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/10"
                          : "bg-[rgba(0,0,0,0.02)] text-text-muted border border-[rgba(0,0,0,0.03)]"
                      }`}
                    >
                      {weekNum}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Middle: Coach Notes + Latest Check-ins */}
          <div>
            {/* Coach Notes */}
            <h3 className="text-sm font-heading font-bold text-text-primary mb-3">Coach Notes</h3>
            <div className="bg-bg-card border border-amber-500/20 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-[10px] text-text-muted">Private - never visible to client</span>
              </div>
              <textarea
                value={coachNotes}
                onChange={(e) => setCoachNotes(e.target.value)}
                onBlur={saveCoachNotes}
                rows={5}
                placeholder="Add private coaching notes... context, follow-up items, personal circumstances"
                className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-amber-400/40 transition-colors resize-y"
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-text-muted">Auto-saves on blur</span>
                <button
                  onClick={saveCoachNotes}
                  disabled={coachNotesSaving}
                  className="text-[10px] font-medium text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
                >
                  {coachNotesSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {/* Latest Check-ins */}
            <h3 className="text-sm font-heading font-bold text-text-primary mb-3">Latest Check-ins</h3>
            {client.checkins.length === 0 ? (
              <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 text-center">
                <p className="text-sm text-text-muted">No check-ins yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {client.checkins.slice(0, 3).map((c) => {
                  const mc = moodConfig[c.mood] || moodConfig.okay;
                  const isExpanded = expandedCheckins.has(c.id);
                  return (
                    <div key={c.id} className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedCheckins((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                          return next;
                        })}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[rgba(0,0,0,0.02)] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-text-primary">Week {c.week_number}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${mc.bgClass} ${mc.textClass}`}>{c.mood}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-muted">{timeAgo(c.created_at)}</span>
                          <svg className={`w-3.5 h-3.5 text-text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-3 border-t border-[rgba(0,0,0,0.04)] pt-3 space-y-2">
                          {c.responses && checkinConfig ? (
                            checkinConfig.questions.map((q: FormQuestion) => {
                              const answer = c.responses?.[q.id];
                              if (!answer) return null;
                              return (
                                <div key={q.id}>
                                  <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">{q.label}</span>
                                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{answer}</p>
                                </div>
                              );
                            })
                          ) : (
                            <>
                              {c.wins && <div><span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Wins</span><p className="text-xs text-text-secondary mt-0.5">{c.wins}</p></div>}
                              {c.challenges && <div><span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Challenges</span><p className="text-xs text-text-secondary mt-0.5">{c.challenges}</p></div>}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {client.checkins.length > 3 && (
                  <button onClick={() => setActiveTab("checkins")} className="text-xs text-[#E040D0] hover:text-[#b830a8] transition-colors w-full text-center py-2">
                    View all {client.checkins.length} check-ins
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Client Data */}
          <div>
            <h3 className="text-sm font-heading font-bold text-text-primary mb-3">Client Data</h3>

            {/* Weight card */}
            <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Weight Tracker</span>
                {checkinsWithWeight.length > 0 && (
                  <span className="text-[10px] text-text-muted">
                    Latest: {new Date(checkinsWithWeight[checkinsWithWeight.length - 1].created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>
              <div className="flex items-end gap-4">
                <div>
                  <div className="text-[10px] text-text-muted mb-0.5">Current</div>
                  <div className="text-2xl font-heading font-bold text-text-primary">
                    {latestWeight ? `${latestWeight}kg` : "—"}
                  </div>
                  {weightTrend !== null && (
                    <div className={`text-xs font-semibold mt-0.5 ${weightTrend < 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {weightTrend < 0 ? "▼" : "▲"} {Math.abs(weightTrend).toFixed(1)}kg vs last
                    </div>
                  )}
                </div>
                {startWeightVal && latestWeight && startWeightVal !== latestWeight && (
                  <div>
                    <div className="text-[10px] text-text-muted mb-0.5">Total change</div>
                    <div className={`text-lg font-heading font-bold ${latestWeight < startWeightVal ? "text-emerald-400" : "text-red-400"}`}>
                      {latestWeight < startWeightVal ? "▼" : "▲"} {Math.abs(latestWeight - startWeightVal).toFixed(1)}kg
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Weight trend chart */}
            {weightChartData.length >= 2 && (
              <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 mb-3">
                <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-3">Weight Trend</div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={weightChartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{ background: "var(--color-bg-card)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v) => [`${v}kg`, "Weight"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#E040D0"
                      strokeWidth={2}
                      dot={<Dot r={3} fill="#E040D0" stroke="#E040D0" />}
                      activeDot={{ r: 4, fill: "#E040D0" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Other metric trend charts */}
            {otherMetricTrends.map(({ metric, data }) => (
              <div key={metric.id} className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 mb-3">
                <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-3">
                  {metric.label} {metric.unit ? `(${metric.unit})` : metric.type === "scale" ? "(1–10)" : ""}
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} domain={metric.type === "scale" ? [1, metric.max ?? 10] : ["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{ background: "var(--color-bg-card)", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v) => [`${v}${metric.unit ? metric.unit : ""}`, metric.label]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#E040D0"
                      strokeWidth={2}
                      dot={<Dot r={3} fill="#E040D0" stroke="#E040D0" />}
                      activeDot={{ r: 4, fill: "#E040D0" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}

            {/* Goal card */}
            <div
              className="bg-bg-card border border-[#E040D0]/20 rounded-2xl p-4 mb-3 cursor-pointer hover:border-[#E040D0]/40 transition-colors"
              onClick={() => { setGoalPrimary(client.primary_goal || ""); setGoalTargetDate(client.target_date || ""); setGoalNotes(client.goal_notes || ""); setGoalsModalOpen(true); }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[#E040D0] font-semibold uppercase tracking-wider">Primary Goal</span>
                <span className="text-[10px] text-text-muted">{client.primary_goal ? "Edit" : "Set goal"}</span>
              </div>
              {client.primary_goal ? (
                <>
                  <div className="text-base font-heading font-bold text-[#E040D0] leading-snug">{client.primary_goal}</div>
                  {client.target_date && (
                    <div className="text-xs text-text-muted mt-1">
                      Target: {new Date(client.target_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  )}
                  {client.goal_notes && <p className="text-xs text-text-secondary mt-1 leading-relaxed">{client.goal_notes}</p>}
                </>
              ) : (
                <p className="text-sm text-text-muted">No goal set yet.</p>
              )}
            </div>

            {/* Internal notes (coach-only) */}
            <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4">
              <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-2">Internal Notes</div>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={3}
                placeholder="Follow-up items, context..."
                className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
              />
              <button
                onClick={saveNotes}
                disabled={notesSaving}
                className="text-[10px] font-medium text-accent-bright hover:text-accent-light transition-colors disabled:opacity-50 mt-1"
              >
                {notesSaving ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Check-ins Tab ── */}
      {activeTab === "checkins" && (
        <div>
          <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Check-In History</h2>
          {client.checkins.length === 0 ? (
            <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-8 text-center">
              <p className="text-text-muted text-sm">No check-ins submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {client.checkins.map((c) => {
                const mc = moodConfig[c.mood] || moodConfig.okay;
                return (
                  <div key={c.id} className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">Week {c.week_number}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${mc.bgClass} ${mc.textClass}`}>{c.mood}</span>
                      </div>
                      <span className="text-xs text-text-muted">{timeAgo(c.created_at)}</span>
                    </div>

                    {c.responses && checkinConfig ? (
                      checkinConfig.questions.map((q: FormQuestion) => {
                        const answer = c.responses?.[q.id];
                        if (!answer) return null;
                        return (
                          <div key={q.id} className="mb-2">
                            <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">{q.label}</span>
                            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{answer}</p>
                          </div>
                        );
                      })
                    ) : (
                      <>
                        {c.wins && (
                          <div className="mb-2">
                            <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Wins</span>
                            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{c.wins}</p>
                          </div>
                        )}
                        {c.challenges && (
                          <div className="mb-2">
                            <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Challenges</span>
                            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{c.challenges}</p>
                          </div>
                        )}
                        {c.questions && (
                          <div className="mb-2">
                            <span className="text-[10px] text-accent-bright font-semibold uppercase tracking-wider">Questions</span>
                            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{c.questions}</p>
                          </div>
                        )}
                      </>
                    )}

                    {c.admin_reply || sentReplies[c.id] ? (
                      <div className="mt-3 pl-3 border-l-2 border-[#E040D0]/30 bg-[#E040D0]/5 rounded-r-lg py-2 pr-3">
                        <div className="text-[10px] text-[#E040D0] font-semibold uppercase tracking-wider mb-1">
                          Gordy&apos;s Reply
                          {sentReplies[c.id] && !c.admin_reply && <span className="text-emerald-400/60 ml-2">Just sent</span>}
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">{sentReplies[c.id] || c.admin_reply}</p>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-[rgba(0,0,0,0.06)]">
                        <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-2">Reply to this check-in</div>
                        <textarea
                          value={replyTexts[c.id] || ""}
                          onChange={(e) => setReplyTexts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          rows={3}
                          placeholder="Type your reply..."
                          disabled={sendingReply === c.id}
                          className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#E040D0]/40 transition-colors resize-none disabled:opacity-50"
                        />
                        {replyError && sendingReply === null && (
                          <div className="text-xs text-red-400 mt-1">{replyError}</div>
                        )}
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => handleReply(c.id)}
                            disabled={!replyTexts[c.id]?.trim() || sendingReply === c.id}
                            className="px-4 py-2 bg-[#E040D0] hover:bg-[#b830a8] text-white rounded-lg text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
                          >
                            {sendingReply === c.id ? "Sending..." : "Send Reply"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Training Tab ── */}
      {activeTab === "training" && (
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
          {/* Business/milestone training plan */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-text-primary">Training Plan</h2>
              <div className="flex items-center gap-2">
                {activePlan ? (
                  <>
                    <button
                      onClick={() => setBuilderMode("edit")}
                      className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-[rgba(0,0,0,0.08)] hover:border-[rgba(0,0,0,0.1)] rounded-lg transition-colors inline-flex items-center gap-1.5"
                    >
                      Edit Plan
                    </button>
                    <button
                      onClick={() => setBuilderMode("create")}
                      className="px-3 py-1.5 text-xs font-semibold text-white gradient-accent rounded-lg inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      New Plan
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setBuilderMode("create")}
                    className="px-3 py-1.5 text-xs font-semibold text-white gradient-accent rounded-lg inline-flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Training Plan
                  </button>
                )}
              </div>
            </div>

            {activePlan ? (
              <>
                <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 mb-3">
                  <p className="text-text-secondary text-sm leading-relaxed">{activePlan.summary}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="h-2 w-24 bg-[rgba(0,0,0,0.03)] rounded-full overflow-hidden">
                      <div className="h-full gradient-accent rounded-full transition-all duration-500" style={{ width: `${planPct}%` }} />
                    </div>
                    <span className="text-xs text-accent-bright font-semibold">{planPct}%</span>
                    <span className="text-[10px] text-text-muted">({planDone}/{planTotal} items)</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {activePlan.phases.map((phase) => {
                    const isExpanded = expandedPhases.has(phase.id);
                    const phaseDone = phase.items.filter((i) => i.completed).length;
                    const phaseTotal = phase.items.length;
                    const phasePct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;
                    const iconPath = getPhaseIcon(phase.name);
                    return (
                      <div key={phase.id} className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden">
                        <button onClick={() => togglePhase(phase.id)} className="w-full flex items-center justify-between p-4 hover:bg-[rgba(0,0,0,0.02)] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                              <svg className="w-4 h-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-semibold text-text-primary">{phase.name}</div>
                              <div className="text-xs text-text-muted">{phaseDone}/{phaseTotal} completed</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 bg-[rgba(0,0,0,0.03)] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-300 ${phasePct === 100 ? "bg-emerald-500" : "gradient-accent"}`} style={{ width: `${phasePct}%` }} />
                              </div>
                              <span className="text-[10px] text-text-muted w-8 text-right">{phasePct}%</span>
                            </div>
                            <svg className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-[rgba(0,0,0,0.03)] px-4 pb-3">
                            {phase.notes && (
                              <div className="py-3 border-b border-[rgba(0,0,0,0.03)] mb-1">
                                <p className="text-xs text-text-muted leading-relaxed italic">{phase.notes}</p>
                              </div>
                            )}
                            {phase.items.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => toggleItem(phase.id, item.id)}
                                className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-[rgba(0,0,0,0.02)] transition-colors text-left group"
                              >
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${item.completed ? "bg-emerald-500 border-emerald-500" : "border-[rgba(0,0,0,0.1)] group-hover:border-accent/50"}`}>
                                  {item.completed && (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <span className={`text-sm transition-all duration-200 ${item.completed ? "text-text-muted line-through" : "text-text-secondary group-hover:text-text-primary"}`}>{item.title}</span>
                                {item.completed && item.completed_at && (
                                  <span className="text-[10px] text-text-muted ml-auto flex-shrink-0">
                                    {new Date(item.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                  </span>
                                )}
                              </button>
                            ))}
                            {phase.linked_trainings.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-[rgba(0,0,0,0.03)]">
                                <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-2 px-2">Linked Training</div>
                                <div className="space-y-1">
                                  {phase.linked_trainings.map((contentId) => {
                                    const info = contentLookup.get(contentId);
                                    if (!info) return null;
                                    return (
                                      <Link key={contentId} href={`/admin/training/${info.moduleId}`} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent/5 transition-colors no-underline group">
                                        <div className="w-5 h-5 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-3 h-3 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-xs text-text-secondary group-hover:text-text-primary transition-colors truncate">{info.title}</div>
                                          <div className="text-[10px] text-text-muted">{info.moduleName}{info.duration ? ` - ${info.duration}m` : ""}</div>
                                        </div>
                                      </Link>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {completedPlans.length > 0 && (
                  <div className="mt-4">
                    <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors mb-2">
                      <svg className={`w-3.5 h-3.5 transition-transform ${showHistory ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      Previous Plans ({completedPlans.length})
                    </button>
                    {showHistory && (
                      <div className="space-y-3">
                        {completedPlans.map((plan) => {
                          const prevItems = plan.phases.flatMap((ph) => ph.items);
                          const prevDone = prevItems.filter((i) => i.completed).length;
                          const prevTotal = prevItems.length;
                          const isOpen = expandedHistoryPlan === plan.id;
                          return (
                            <div key={plan.id} className="bg-bg-card/40 border border-[rgba(0,0,0,0.03)] rounded-2xl overflow-hidden">
                              <button onClick={() => setExpandedHistoryPlan(isOpen ? null : plan.id)} className="w-full p-4 text-left hover:bg-[rgba(0,0,0,0.02)] transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-text-muted">{new Date(plan.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                                  <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full font-semibold">
                                    Completed {plan.completed_at ? new Date(plan.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
                                  </span>
                                </div>
                                <p className="text-xs text-text-muted leading-relaxed mb-1">{plan.summary}</p>
                                <div className="text-[10px] text-text-muted">{prevDone}/{prevTotal} items across {plan.phases.length} phases</div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-8 text-center">
                <p className="text-sm text-text-muted mb-4">No active training plan.</p>
                <button onClick={() => setBuilderMode("create")} className="px-4 py-2 text-xs font-semibold text-white gradient-accent rounded-lg inline-flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Create Training Plan
                </button>
              </div>
            )}
          </div>

          {/* Exercise Plan */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold text-text-primary">Exercise Plan</h2>
              <button
                onClick={() => setShowExercisePicker(true)}
                disabled={assigningExercise}
                className="px-3 py-1.5 text-xs font-semibold text-white gradient-accent rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {exercisePlans.some((p) => p.status === "active") ? "Replace" : "Assign"}
              </button>
            </div>
            {(() => {
              const activeExPlan = exercisePlans.find((p) => p.status === "active");
              if (!activeExPlan) return (
                <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-6 text-center">
                  <p className="text-text-muted text-sm">No exercise plan assigned.</p>
                </div>
              );
              return (
                <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-text-primary">{activeExPlan.name}</h3>
                      {activeExPlan.description && <p className="text-[13px] text-text-secondary mt-0.5">{activeExPlan.description}</p>}
                      <span className="text-[13px] text-accent-bright">{activeExPlan.sessions.length} sessions</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleUnassignExercisePlan(activeExPlan.id)} className="text-[13px] text-text-secondary hover:text-amber-400 transition-colors">Remove</button>
                      <button onClick={() => handleArchiveExercisePlan(activeExPlan.id)} className="text-[13px] text-text-secondary hover:text-red-400 transition-colors">Archive</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {activeExPlan.sessions.map((session) => (
                      <div key={session.id} className="bg-[rgba(0,0,0,0.02)] rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-6 h-6 rounded-lg bg-accent-bright/10 text-accent-bright font-bold text-[11px] flex items-center justify-center">{session.day_number}</span>
                          <span className="font-medium text-text-primary text-[13px]">{session.name}</span>
                          <span className="text-[13px] text-text-secondary/50 ml-auto">{session.items.length} exercises</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {recentExerciseLogs.length > 0 && (() => {
                    const byDate = recentExerciseLogs.reduce((acc, log) => {
                      if (!acc[log.log_date]) acc[log.log_date] = [];
                      acc[log.log_date].push(log);
                      return acc;
                    }, {} as Record<string, typeof recentExerciseLogs>);
                    const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a)).slice(0, 5);
                    return (
                      <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.06)]">
                        <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Recent Training Logs</h4>
                        <div className="space-y-2">
                          {dates.map((date) => {
                            const dayLogs = byDate[date];
                            const completedCount = dayLogs.filter((l) => l.completed).length;
                            const sessionId = dayLogs[0]?.session_id;
                            const sessionName = sessionId ? activeExPlan.sessions.find((s) => s.id === sessionId)?.name : null;
                            return (
                              <div key={date} className="bg-[rgba(0,0,0,0.02)] rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-semibold text-text-primary">
                                      {new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                                    </span>
                                    {sessionName && <span className="text-xs text-accent-bright font-medium">{sessionName}</span>}
                                  </div>
                                  <span className="text-xs text-emerald-500 font-semibold">{completedCount}/{dayLogs.length} logged</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {dayLogs.slice(0, 6).map((log) => {
                                    const exerciseItem = activeExPlan.sessions.flatMap((s) => s.items).find((i) => i.id === log.exercise_item_id);
                                    const topSet = log.sets_data?.[0];
                                    return (
                                      <span key={log.id} className={`text-xs px-2 py-0.5 rounded-lg font-medium ${log.completed ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-[rgba(0,0,0,0.04)] text-text-secondary"}`}>
                                        {exerciseItem?.exercise?.name || "Exercise"}
                                        {topSet?.weight && ` ${topSet.weight}kg`}
                                        {topSet?.reps && ` x${topSet.reps}`}
                                      </span>
                                    );
                                  })}
                                  {dayLogs.length > 6 && (
                                    <span className="text-xs px-2 py-0.5 rounded-lg bg-[rgba(0,0,0,0.04)] text-text-secondary">+{dayLogs.length - 6} more</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Nutrition Tab ── */}
      {activeTab === "nutrition" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text-primary">Nutrition Plan</h2>
            <button
              onClick={() => setShowNutritionPicker(true)}
              disabled={assigningNutrition}
              className="px-3 py-1.5 text-xs font-semibold text-white gradient-accent rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {nutritionPlans.some((p) => p.status === "active") ? "Replace Plan" : "Assign Nutrition Plan"}
            </button>
          </div>
          {(() => {
            const activeNutPlan = nutritionPlans.find((p) => p.status === "active");
            if (!activeNutPlan) return (
              <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-8 text-center">
                <p className="text-text-muted text-sm">No nutrition plan assigned.</p>
              </div>
            );
            return (
              <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-text-primary">{activeNutPlan.name}</h3>
                    <div className="flex gap-3 mt-1 text-[13px]">
                      {activeNutPlan.target_calories && <span className="text-text-primary font-medium">{activeNutPlan.target_calories} kcal</span>}
                      {activeNutPlan.target_protein_g && <span className="text-blue-500">{activeNutPlan.target_protein_g}g P</span>}
                      {activeNutPlan.target_carbs_g && <span className="text-accent-bright">{activeNutPlan.target_carbs_g}g C</span>}
                      {activeNutPlan.target_fat_g && <span className="text-red-500">{activeNutPlan.target_fat_g}g F</span>}
                    </div>
                    <span className="text-[13px] text-accent-bright">{activeNutPlan.meals.length} meals</span>
                  </div>
                  <button onClick={() => handleArchiveNutritionPlan(activeNutPlan.id)} className="text-[13px] text-text-secondary hover:text-red-400 transition-colors">Archive</button>
                </div>
                <div className="space-y-2">
                  {activeNutPlan.meals.map((meal) => (
                    <div key={meal.id} className="bg-[rgba(0,0,0,0.02)] rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-primary text-[13px]">{meal.name}</span>
                        <span className="text-[13px] text-text-secondary/50">{meal.items.length} items</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Gallery Tab ── */}
      {activeTab === "gallery" && (
        <AdminGalleryTab clientId={id as string} groups={galleryGroups} loading={galleryLoading} loaded={galleryLoaded} onLoad={(groups) => { setGalleryGroups(groups); setGalleryLoaded(true); setGalleryLoading(false); }} onLoadStart={() => setGalleryLoading(true)} />
      )}

      {/* ── Tasks Tab ── */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          {/* Add task input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="Add a task for this client..."
              maxLength={500}
              className="flex-1 bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#E040D0]/40 transition-colors"
            />
            <button
              onClick={addTask}
              disabled={!newTaskText.trim()}
              className="px-5 py-3 bg-[#E040D0] hover:bg-[#b830a8] text-white rounded-xl text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Add
            </button>
          </div>

          {/* Task list */}
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-sm">No tasks assigned yet</div>
          ) : (
            <div className="space-y-2">
              {tasks.filter(t => !t.completed).map(task => (
                <div key={task.id} className="flex items-center gap-3 bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-[#E040D0]" />
                  <span className="flex-1 text-sm text-text-primary">{task.task_text}</span>
                  <span className="text-[10px] text-text-muted">{new Date(task.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                  <button onClick={() => deleteTask(task.id)} className="text-text-muted hover:text-red-400 transition-colors cursor-pointer">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              {tasks.filter(t => t.completed).length > 0 && (
                <>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mt-4 mb-2">Completed</div>
                  {tasks.filter(t => t.completed).map(task => (
                    <div key={task.id} className="flex items-center gap-3 bg-bg-card/50 border border-[rgba(0,0,0,0.04)] rounded-xl px-4 py-3 opacity-50">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="flex-1 text-sm text-text-secondary line-through">{task.task_text}</span>
                      <button onClick={() => deleteTask(task.id)} className="text-text-muted hover:text-red-400 transition-colors cursor-pointer">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}

      {/* Goals Modal */}
      {goalsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#E040D0]/10 border border-[#E040D0]/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#E040D0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-text-primary">Client Goal</h3>
                <p className="text-xs text-text-muted">What is {client.name.split(" ")[0]} working towards?</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Primary Goal</label>
                <input
                  type="text"
                  value={goalPrimary}
                  onChange={(e) => setGoalPrimary(e.target.value)}
                  placeholder="e.g. Lose 10kg, Run a 5k, Build muscle"
                  className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[#E040D0]/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Target Date <span className="text-text-muted font-normal">(optional)</span></label>
                <input
                  type="date"
                  value={goalTargetDate}
                  onChange={(e) => setGoalTargetDate(e.target.value)}
                  className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-[#E040D0]/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Additional Notes <span className="text-text-muted font-normal">(optional)</span></label>
                <textarea
                  value={goalNotes}
                  onChange={(e) => setGoalNotes(e.target.value)}
                  placeholder="Context, motivation, milestones..."
                  rows={3}
                  className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[#E040D0]/50 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setGoalsModalOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">Cancel</button>
              <button
                disabled={goalsSaving || !goalPrimary.trim()}
                onClick={handleSaveGoals}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-[#E040D0] hover:bg-[#b830a8] rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {goalsSaving ? "Saving..." : "Save Goal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Access Modal */}
      {revokeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-heading font-bold text-text-primary">Revoke Client Access</h3>
            </div>
            <p className="text-sm text-text-secondary mb-4 leading-relaxed">
              This will permanently remove <span className="text-text-primary font-semibold">{client.name}</span> and all their data. This cannot be undone.
            </p>
            <input
              type="text"
              value={revokeConfirmText}
              onChange={(e) => setRevokeConfirmText(e.target.value)}
              placeholder='Type "confirm" to proceed'
              className="w-full px-4 py-2.5 bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setRevokeModalOpen(false); setRevokeConfirmText(""); }} className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/5 hover:bg-white/10 rounded-xl transition-colors">Cancel</button>
              <button
                disabled={revokeConfirmText !== "confirm" || revoking}
                onClick={async () => {
                  setRevoking(true);
                  try {
                    const res = await fetch(`/api/admin/clients/${id}`, {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ user_id: client.user_id }),
                    });
                    if (res.ok) router.push("/admin/clients");
                    else { const data = await res.json().catch(() => ({})); alert(data.error || "Failed to revoke access"); }
                  } finally { setRevoking(false); }
                }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {revoking ? "Revoking..." : "Revoke Access"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-text-primary">Set Password</h3>
                <p className="text-xs text-text-muted">For {client.name}</p>
              </div>
            </div>
            {passwordResult?.type === "success" ? (
              <>
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-emerald-400 font-medium">Password set - client can log in now</span>
                </div>
                <button onClick={() => setPasswordModalOpen(false)} className="w-full px-4 py-2.5 text-sm font-semibold text-white gradient-accent rounded-xl cursor-pointer">Done</button>
              </>
            ) : (
              <>
                {passwordResult?.type === "error" && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                    <span className="text-sm text-red-400">{passwordResult.text}</span>
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newClientPassword}
                    onChange={(e) => setNewClientPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setPasswordModalOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">Cancel</button>
                  <button
                    disabled={newClientPassword.length < 8 || passwordSaving}
                    onClick={async () => {
                      setPasswordSaving(true);
                      setPasswordResult(null);
                      try {
                        const res = await fetch("/api/admin/set-password", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ user_id: client.user_id, password: newClientPassword }),
                        });
                        const data = await res.json();
                        if (res.ok) setPasswordResult({ type: "success", text: "Password set" });
                        else setPasswordResult({ type: "error", text: data.error || "Failed to set password" });
                      } catch {
                        setPasswordResult({ type: "error", text: "Something went wrong" });
                      } finally {
                        setPasswordSaving(false);
                      }
                    }}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-white gradient-accent rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {passwordSaving ? "Setting..." : "Set Password"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Nudge Modal */}
      {nudgeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-text-primary">Nudge {client.name.split(" ")[0]}</h3>
                <p className="text-xs text-text-muted">Send a push notification to their device</p>
              </div>
            </div>
            {nudgeSent ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-emerald-400 font-medium">Nudge sent</span>
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
              <button onClick={() => setNudgeOpen(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">
                {nudgeSent ? "Done" : "Cancel"}
              </button>
              {!nudgeSent && (
                <button
                  disabled={!nudgeMessage.trim() || nudgeSending}
                  onClick={async () => {
                    setNudgeSending(true);
                    try {
                      const res = await fetch("/api/push/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: client.user_id, title: "Gordy Elliott", body: nudgeMessage, url: "/portal", tag: "nudge" }),
                      });
                      const result = await res.json().catch(() => ({}));
                      if (res.ok && result.sent > 0) setNudgeSent(true);
                      else alert("Push notification could not be delivered. Client may not have notifications enabled.");
                    } finally {
                      setNudgeSending(false);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white gradient-accent rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {nudgeSending ? "Sending..." : "Send Nudge"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Training Plan Builder Modal */}
      {builderMode !== "closed" && (
        <TrainingPlanBuilder
          clientId={client.id}
          existingPlan={builderMode === "edit" ? activePlan : undefined}
          onSave={handleSavePlan}
          onCancel={() => setBuilderMode("closed")}
        />
      )}

      {/* Exercise Template Picker Modal */}
      {showExercisePicker && (
        <ExerciseTemplatePicker
          onSelect={handleAssignExercisePlan}
          onClose={() => setShowExercisePicker(false)}
        />
      )}

      {/* Nutrition Template Picker Modal */}
      {showNutritionPicker && (
        <NutritionTemplatePicker
          onSelect={handleAssignNutritionPlan}
          onClose={() => setShowNutritionPicker(false)}
        />
      )}
    </>
  );
}

function ActivityTimeline({ clientId }: { clientId: string }) {
  interface ActivityEvent {
    type: string;
    description: string;
    timestamp: string;
    color: string;
  }

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/client-activity?clientId=${clientId}`)
      .then((r) => r.json())
      .then((data) => setEvents(data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 text-center">
        <p className="text-xs text-text-muted">Loading activity...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 text-center">
        <p className="text-xs text-text-muted">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-4 max-h-[480px] overflow-y-auto">
      <div className="relative border-l border-[rgba(0,0,0,0.08)] ml-3 space-y-0">
        {events.map((event, i) => {
          const ts = new Date(event.timestamp);
          const timeLabel = ts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
          const dateLabel = ts.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
          return (
            <div key={i} className="relative pl-5 pb-4 last:pb-0">
              <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-bg-card ${event.color}`} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-text-muted font-mono mr-1.5">{timeLabel}</span>
                  <span className="text-xs text-text-primary">{event.description}</span>
                </div>
                <span className="text-[10px] text-text-muted whitespace-nowrap flex-shrink-0">{dateLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
