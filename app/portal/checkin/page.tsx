"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import CyclingStatusText from "@/components/ui/CyclingStatusText";
import type { CheckinFormConfig, ClientTask, ProgressMetric } from "@/lib/types";
import { buildFallbackCheckinConfig, normalizeCheckinConfig } from "@/lib/checkin-form";
import PhotoUpload from "@/components/portal/PhotoUpload";

const moodColorMap: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  red: "border-red-500/30 bg-red-500/10 text-red-400",
};

function getCheckinDueDate(checkinDay: string | null) {
  const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const targetDay = dayMap[(checkinDay || "monday").toLowerCase()] ?? 1;
  const now = new Date();
  const weekStart = new Date(now);
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  const due = new Date(weekStart);
  due.setDate(weekStart.getDate() + (targetDay === 0 ? 6 : targetDay - 1));
  return due;
}

function isToday(date: Date) {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function ScaleInput({ metric, value, onChange }: { metric: ProgressMetric; value: string; onChange: (v: string) => void }) {
  const min = metric.min ?? 1;
  const max = metric.max ?? 10;
  const selected = value ? parseInt(value) : null;
  const sliderValue = selected ?? min;
  const percent = max > min ? ((sliderValue - min) / (max - min)) * 100 : 0;
  const scaleLabel = selected === null ? "Slide to set" : selected <= 3 ? "Low" : selected <= 6 ? "Moderate" : "High";
  const valueLabel = selected === null ? "Not set" : `${selected} / ${max}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-text-secondary">{scaleLabel}</div>
        <div className="rounded-full border border-[#E040D0]/20 bg-[#E040D0]/8 px-2.5 py-0.5 text-xs font-bold text-[#E040D0]">
          {valueLabel}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={sliderValue}
        onChange={(e) => onChange(e.target.value)}
        aria-label={metric.label}
        aria-valuetext={selected === null ? "Not set" : `${selected} out of ${max}`}
        className="h-8 w-full cursor-pointer appearance-none bg-transparent accent-[#E040D0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E040D0]/45 focus-visible:ring-offset-2 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#E040D0] [&::-moz-range-thumb]:shadow-md [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[rgba(0,0,0,0.08)] [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#E040D0] [&::-webkit-slider-thumb]:shadow-md"
        style={{
          background: `linear-gradient(90deg, #E040D0 0%, #E040D0 ${percent}%, rgba(0,0,0,0.08) ${percent}%, rgba(0,0,0,0.08) 100%)`,
          borderRadius: "999px",
        }}
      />
      <div className="flex justify-between text-[11px] font-semibold text-text-muted">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function ChoiceButton({
  name,
  value,
  label,
  selected,
  onChange,
  selectedClass = "border-[#E040D0]/45 bg-[#E040D0]/12 text-[#B830A8] shadow-[0_12px_26px_rgba(224,64,208,0.10)]",
}: {
  name: string;
  value: string;
  label: string;
  selected: boolean;
  onChange: () => void;
  selectedClass?: string;
}) {
  return (
    <label
      className={`flex min-h-[58px] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-[#E040D0]/45 has-[input:focus-visible]:ring-offset-2 active:scale-[0.99] ${
        selected
          ? selectedClass
          : "border-[rgba(0,0,0,0.08)] bg-bg-card text-text-secondary hover:border-[#E040D0]/30 hover:bg-[#E040D0]/5 hover:text-text-primary"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onChange}
        className="sr-only"
      />
      <span>{label}</span>
      <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
        selected ? "border-current bg-current" : "border-[rgba(0,0,0,0.16)]"
      }`}>
        {selected && (
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
    </label>
  );
}

export default function CheckInPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<CheckinFormConfig | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [progressData, setProgressData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const [photos, setPhotos] = useState<Record<string, File>>({});
  const [tier, setTier] = useState<string>("coached");
  const [tierLoaded, setTierLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [currentWeekSubmitted, setCurrentWeekSubmitted] = useState(false);
  const [currentWeekSavedAt, setCurrentWeekSavedAt] = useState<string | null>(null);
  const [currentWeekNumber, setCurrentWeekNumber] = useState<number | null>(null);
  const [checkinDay, setCheckinDay] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [openCoachTasks, setOpenCoachTasks] = useState<ClientTask[]>([]);
  const [latestReply, setLatestReply] = useState<{ text: string; date: string | null } | null>(null);
  const [priorityMessage, setPriorityMessage] = useState("");
  const [supportAsk, setSupportAsk] = useState("");
  const tierCopy = {
    coached: {
      line: "Let Gordy know how you're getting on this week.",
      lane: "Standard coaching lane",
      rhythm: "This is the weekly reflection Gordy reviews to guide your next steps.",
    },
    premium: {
      line: "Use this check-in to surface friction, progress, and where you need extra support this week.",
      lane: "Support lane",
      rhythm: "This check-in should make your progress and support needs obvious before the week gets away from you.",
    },
    vip: {
      line: "Use this check-in to flag the things Gordy should see first this week.",
      lane: "Priority lane",
      rhythm: "This is your highest-priority reflection point, designed to keep support tight and visible.",
    },
    ai_only: {
      line: "Use this to reflect on your week and keep your momentum moving.",
      lane: "AI coaching lane",
      rhythm: "This helps you stay honest with your progress even without live coaching support.",
    },
  } as const;

  function formatDay(day: string | null) {
    if (!day) return "your check-in day";
    return `${day.charAt(0).toUpperCase()}${day.slice(1)}`;
  }

  function formatSavedAt(dateStr: string | null) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  useEffect(() => {
    fetch("/api/portal/me")
      .then((r) => r.json())
      .then((d) => { setTier(d.tier || "coached"); setTierLoaded(true); })
      .catch(() => setTierLoaded(true));
  }, []);

  useEffect(() => {
    if (tier !== "premium" && tier !== "vip") return;
    fetch("/api/portal/tasks")
      .then((r) => (r.ok ? r.json() : { tasks: [] }))
      .then((d) => {
        const open = (d.tasks || []).filter((t: ClientTask) => !t.completed && t.source !== "client");
        setOpenCoachTasks(open);
      })
      .catch(() => setOpenCoachTasks([]));

    fetch("/api/portal/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const withReply = (d.checkins || []).find((c: { admin_reply?: string; replied_at?: string; created_at: string }) => c.admin_reply);
        if (withReply?.admin_reply) {
          setLatestReply({ text: withReply.admin_reply, date: withReply.replied_at || withReply.created_at });
        }
      })
      .catch(() => {});
  }, [tier]);

  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      try {
        const stateRes = await fetch("/api/portal/checkin");

        if (stateRes.ok) {
          const stateData = await stateRes.json();
          if (cancelled) return;
          setConfig(normalizeCheckinConfig(stateData.config));
          setCheckinDay(stateData.checkinDay || null);
          setTemplateName(stateData.templateName || null);
          setLoadError("");
          if (stateData.currentWeekCheckin) {
            const existing = stateData.currentWeekCheckin;
            setMood(existing.mood || null);
            const existingResponses = existing.responses || {};
            setResponses(existingResponses);
            setProgressData(existingResponses);
            if (typeof existingResponses.priority_message === "string") {
              setPriorityMessage(existingResponses.priority_message);
            }
            if (typeof existingResponses.support_ask === "string") {
              setSupportAsk(existingResponses.support_ask);
            }
            setCurrentWeekSubmitted(true);
            setCurrentWeekSavedAt(existing.created_at || null);
            setCurrentWeekNumber(existing.week_number || null);
          }
        } else {
          if (cancelled) return;
          setConfig(buildFallbackCheckinConfig());
          setLoadError("We couldn't load your assigned check-in form, so a safe default is shown. You can still submit.");
        }
      } catch {
        if (cancelled) return;
        setConfig(buildFallbackCheckinConfig());
        setLoadError("We couldn't load your full check-in setup, so a safe default is shown. You can still submit.");
      }
    }
    loadConfig();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (config?.mood_enabled && !mood) return;
    setError(false);
    setSubmitting(true);

    // Merge progress data and tier-specific priority fields into responses JSONB
    const fullResponses: Record<string, string> = { ...responses, ...progressData };
    const isHighTouch = tier === "premium" || tier === "vip";
    if (isHighTouch) {
      if (priorityMessage.trim()) fullResponses.priority_message = priorityMessage.trim();
      else delete fullResponses.priority_message;
      if (supportAsk.trim()) fullResponses.support_ask = supportAsk.trim();
      else delete fullResponses.support_ask;
    }

    try {
      const res = await fetch("/api/portal/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: mood || "good", responses: fullResponses }),
      });

      if (res.ok) {
        const data = await res.json();
        // Upload any progress photos — surface any partial failures so the client
        // isn't told "saved" when some photos didn't actually land.
        const failedPhotoAngles: string[] = [];
        if (Object.keys(photos).length > 0) {
          const today = new Date().toISOString().split("T")[0];
          const photoResults = await Promise.all(
            Object.entries(photos).map(async ([angle, file]) => {
              try {
                const fd = new FormData();
                fd.append("file", file);
                fd.append("angle", angle);
                fd.append("date", today);
                const photoRes = await fetch("/api/portal/upload-photo", { method: "POST", body: fd });
                return { angle, ok: photoRes.ok };
              } catch {
                return { angle, ok: false };
              }
            })
          );
          failedPhotoAngles.push(
            ...photoResults
              .filter((result) => !result.ok)
              .map((result) => `${result.angle.charAt(0).toUpperCase()}${result.angle.slice(1)}`)
          );
        }
        setCurrentWeekSubmitted(true);
        setCurrentWeekSavedAt(new Date().toISOString());
        setCurrentWeekNumber(data.week_number || currentWeekNumber);
        setSaveMessage(data.updated ? "Your check-in for this week was updated." : "Your check-in for this week was saved.");
        setSubmitted(true);
        if (failedPhotoAngles.length > 0) {
          toast(
            `Check-in saved, but these photo${failedPhotoAngles.length === 1 ? "" : "s"} didn't upload: ${failedPhotoAngles.join(", ")}. Try re-adding from Progress.`,
            "error"
          );
        } else {
          toast(data.updated ? "Check-in updated for this week" : "Check-in submitted - Gordy will review it this week");
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(true);
        toast(data.error || "Something went wrong. Please try again.", "error");
        setTimeout(() => setError(false), 5000);
      }
    } catch {
      setError(true);
      toast("Something went wrong. Please try again.", "error");
      setTimeout(() => setError(false), 5000);
    }

    setSubmitting(false);
  }

  function resetForm() {
    setSubmitted(false);
    setSaveMessage("");
  }

  if (tierLoaded && tier === "ai_only") {
    return (
      <div className="max-w-2xl">
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-[#E040D0]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#E040D0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-lg font-heading font-bold text-text-primary mb-2">Not Available on Your Plan</h2>
          <p className="text-sm text-text-secondary mb-6">Weekly coach check-ins are not enabled in your current setup. Your AI coach is available to help you track progress instead.</p>
          <a href="/portal" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl" style={{ background: "linear-gradient(135deg, #E040D0 0%, #b830a8 100%)" }}>
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-[calc(100dvh-11rem)] max-w-2xl items-center">
        <div className="w-full bg-bg-card border border-emerald-500/20 rounded-3xl p-8 text-center shadow-lg">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">Check-in Saved</h2>
          <p className="text-text-secondary">{saveMessage || "Gordy will review your check-in and respond shortly."}</p>
          {currentWeekNumber !== null && (
            <p className="mt-2 text-sm text-text-muted">Week {currentWeekNumber} · saved {formatSavedAt(currentWeekSavedAt)}</p>
          )}
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={resetForm}
              className="px-6 py-3 gradient-accent text-white rounded-xl text-sm font-semibold cursor-pointer"
            >
              Keep Editing
            </button>
            <Link
              href="/portal/progress"
              className="px-6 py-3 rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary text-sm font-semibold text-text-primary no-underline"
            >
              Log your progress
            </Link>
            <Link
              href="/portal"
              className="text-xs font-semibold text-text-muted no-underline hover:text-text-secondary"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-8 w-48 mb-2" />
          <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-4 w-72" />
        </div>
        <div className="space-y-6">
          <div>
            <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-4 w-52 mb-3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded-xl h-12 border border-[rgba(0,0,0,0.08)]" />
              ))}
            </div>
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-4 w-32 mb-2" />
              <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded-xl h-24 border border-[rgba(0,0,0,0.08)]" />
            </div>
          ))}
          <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-xl h-14" />
        </div>
      </div>
    );
  }

  const enabledQuestions = config.questions.filter((q) => q.enabled !== false);
  const enabledMetrics = (config.progress_tracking || []).filter((m) => m.enabled);
  const tierInfo = tierCopy[(tier as keyof typeof tierCopy) || "coached"] || tierCopy.coached;
  const effectiveCheckinDay = checkinDay || config.checkin_day || null;
  const nextCheckinDate = getCheckinDueDate(effectiveCheckinDay);
  const checkinOverdue = !currentWeekSubmitted && nextCheckinDate.getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const dueLabel = currentWeekSubmitted
    ? "Submitted this week"
    : isToday(nextCheckinDate)
      ? "Due today"
      : checkinOverdue
        ? `Overdue since ${nextCheckinDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}`
      : `Next due ${nextCheckinDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}`;

  return (
    <div className="max-w-2xl pb-28 sm:pb-0">
      <div className="mb-6">
        <h1 className="text-3xl font-heading font-bold text-text-primary">{config.title || "Weekly Check-in"}</h1>
        <p className="text-text-secondary mt-1">{tierInfo.line}</p>
        {(tier === "premium" || tier === "vip") && (
          <div className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
            tier === "vip"
              ? "border-amber-500/20 bg-amber-500/10 text-amber-500"
              : "border-sky-500/20 bg-sky-500/10 text-sky-500"
          }`}>
            {tierInfo.lane}
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">Check-in Rhythm</div>
          <div className="mt-2 text-lg font-heading font-bold text-text-primary">{formatDay(effectiveCheckinDay)}</div>
          <div className="mt-1 text-sm font-semibold text-[#E040D0]">{dueLabel}</div>
          <div className="mt-1 text-sm text-text-secondary">{tierInfo.rhythm}</div>
        </div>
        <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted">This Week</div>
          <div className="mt-2 text-lg font-heading font-bold text-text-primary">
            {currentWeekSubmitted ? "Already saved" : "Still to submit"}
          </div>
          <div className="mt-1 text-sm text-text-secondary">
            {currentWeekSubmitted
              ? `Saved ${formatSavedAt(currentWeekSavedAt)}. You can still update it this week.`
              : "Once submitted, you can still come back and update it before the next week begins."}
          </div>
          {templateName && (
            <div className="mt-2 text-xs text-text-muted">Using form: {templateName}</div>
          )}
        </div>
      </div>

      {loadError && (
        <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {loadError}
        </div>
      )}

      {/* Coach priorities context (Premium / VIP only) */}
      {(tier === "premium" || tier === "vip") && openCoachTasks.length > 0 && (
        <div className={`mb-6 rounded-2xl border px-4 py-4 ${
          tier === "vip" ? "border-amber-500/25 bg-amber-500/5" : "border-sky-500/25 bg-sky-500/5"
        }`}>
          <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
            tier === "vip" ? "text-amber-500" : "text-sky-500"
          }`}>
            Gordy&apos;s open priorities
          </div>
          <div className="mt-1 text-xs text-text-secondary">
            Reflect on these as you fill in this week&apos;s check-in — it keeps your reply focused on what matters.
          </div>
          <ul className="mt-3 space-y-2">
            {openCoachTasks.slice(0, 4).map((task) => (
              <li key={task.id} className="flex items-start gap-2 text-sm text-text-primary">
                <span className={`mt-1.5 inline-block h-1.5 w-1.5 rounded-full ${tier === "vip" ? "bg-amber-500" : "bg-sky-500"}`} />
                <span>{task.task_text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Link href="/portal" className="text-xs font-semibold text-accent-bright no-underline hover:text-accent-light">
              Back to your dashboard
            </Link>
          </div>
        </div>
      )}

      {/* VIP: latest coach reply visible during check-in so the thread feels connected */}
      {tier === "vip" && latestReply && (
        <div className="mb-6 rounded-2xl border border-[#E040D0]/20 bg-[#E040D0]/5 px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E040D0]">Last reply from Gordy</div>
          <p className="mt-2 text-sm leading-relaxed text-text-primary">{latestReply.text}</p>
          {latestReply.date && (
            <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-text-muted">
              Sent {new Date(latestReply.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mood */}
        {config.mood_enabled && config.mood_options.length > 0 && (
          <fieldset className="rounded-[28px] border border-[#E040D0]/15 bg-bg-card p-5 shadow-[0_14px_34px_rgba(10,10,10,0.06)]">
            <legend className="mb-3 block text-[13px] font-bold uppercase tracking-[0.16em] text-[#E040D0]">How are you feeling this week?</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {config.mood_options.map((m) => (
                <ChoiceButton
                  key={m.value}
                  name="weekly_mood"
                  value={m.value}
                  onChange={() => setMood(m.value)}
                  selected={mood === m.value}
                  selectedClass={moodColorMap[m.color] || "border-accent/30 bg-accent/10 text-accent-bright"}
                  label={m.label}
                />
              ))}
            </div>
          </fieldset>
        )}

        {/* Progress Photos */}
        <PhotoUpload
          date={new Date().toISOString().split("T")[0]}
          onPhotosChange={setPhotos}
        />

        {/* Dynamic questions */}
        {enabledQuestions.map((q) => {
          if (q.id === "photos") return null; // handled by PhotoUpload above
          if (q.type === "select" && q.options?.length) {
            return (
              <fieldset key={q.id} className="rounded-[28px] border border-[#E040D0]/12 bg-bg-card p-5 shadow-[0_14px_34px_rgba(10,10,10,0.05)]">
                <legend className="mb-3 block text-sm font-bold text-text-primary">{q.label}</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {q.options.map((opt) => (
                    <ChoiceButton
                      key={opt}
                      name={`question_${q.id}`}
                      value={opt}
                      onChange={() => setResponses((prev) => ({ ...prev, [q.id]: opt }))}
                      selected={responses[q.id] === opt}
                      label={opt}
                    />
                  ))}
                </div>
              </fieldset>
            );
          }
          return (
            <div key={q.id}>
              <label className="block text-sm font-medium text-text-primary mb-2">{q.label}</label>
              <textarea
                value={responses[q.id] || ""}
                onChange={(e) => setResponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
                rows={3}
                placeholder={q.placeholder}
                className="w-full bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
              />
            </div>
          );
        })}

        {/* Progress Tracking */}
        {enabledMetrics.length > 0 && (
          <section className="rounded-[28px] border border-[#E040D0]/12 bg-bg-card p-5 shadow-[0_14px_34px_rgba(10,10,10,0.05)]">
            <div className="mb-4 text-[13px] font-bold uppercase tracking-[0.16em] text-[#E040D0]">Progress Tracking</div>
            <div className="space-y-3">
              {enabledMetrics.map((m) => (
                <fieldset key={m.id} className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-[linear-gradient(135deg,rgba(224,64,208,0.055),rgba(245,158,11,0.025))] px-3 py-3">
                  <legend className="px-1 text-sm font-bold text-text-primary">
                    {m.label}
                    {m.unit && <span className="text-text-muted font-normal ml-1">({m.unit})</span>}
                  </legend>
                  {m.type === "scale" ? (
                    <ScaleInput
                      metric={m}
                      value={progressData[m.id] || ""}
                      onChange={(v) => setProgressData((prev) => ({ ...prev, [m.id]: v }))}
                    />
                  ) : m.type === "select" && m.options?.length ? (
                    <select
                      value={progressData[m.id] || ""}
                      onChange={(e) => setProgressData((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      className="w-full bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-[#E040D0]/40 transition-colors"
                    >
                      <option value="" disabled>Select an option</option>
                      {m.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      step="0.1"
                      value={progressData[m.id] || ""}
                      onChange={(e) => setProgressData((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      placeholder={m.unit ? `e.g. 75${m.unit}` : "Enter value"}
                      className="w-full bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-[#E040D0]/40 transition-colors"
                    />
                  )}
                </fieldset>
              ))}
            </div>
          </section>
        )}

        {/* Extra support fields are enabled by the client's assigned setup. */}
        {(tier === "premium" || tier === "vip") && (
          <div className="space-y-5 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-5">
            <div>
              <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                tier === "vip" ? "text-amber-500" : "text-sky-500"
              }`}>
                {tier === "vip" ? "Priority message for Gordy" : "Message for Gordy"}
              </div>
              <label className="mt-2 block text-sm font-medium text-text-primary">
                {tier === "vip"
                  ? "What's the one thing Gordy should see first this week?"
                  : "What do you most want Gordy to weigh in on?"}
              </label>
              <textarea
                value={priorityMessage}
                onChange={(e) => setPriorityMessage(e.target.value)}
                rows={3}
                placeholder={tier === "vip"
                  ? "Top-priority win, friction, or decision you need Gordy's eyes on."
                  : "A specific moment or situation you want his input on."}
                className="mt-2 w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
              />
            </div>
            <div>
              <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                tier === "vip" ? "text-amber-500" : "text-sky-500"
              }`}>
                Support ask
              </div>
              <label className="mt-2 block text-sm font-medium text-text-primary">
                Where do you need closer support this coming week?
              </label>
              <textarea
                value={supportAsk}
                onChange={(e) => setSupportAsk(e.target.value)}
                rows={3}
                placeholder="Training, nutrition, habits, mindset, accountability..."
                className="mt-2 w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={(config.mood_enabled && !mood) || submitting}
          className="w-full py-4 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity"
        >
          <CyclingStatusText
            active={submitting}
            idle={
              currentWeekSubmitted
                ? tier === "vip" || tier === "premium" ? "Update Check-in" : "Update This Week's Check-in"
                : "Submit Check-in"
            }
            messages={["Saving...", "Uploading photos...", "Syncing progress...", "Nearly there..."]}
          />
        </button>
        <div className="text-center">
          <Link href="/portal" className="text-xs font-semibold text-text-muted no-underline hover:text-text-secondary">
            Back to dashboard
          </Link>
        </div>
        {error && (
          <p className="text-red-400 text-sm text-center">Something went wrong. Please try again.</p>
        )}
      </form>
    </div>
  );
}
