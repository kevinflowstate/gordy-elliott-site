"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import type { CheckinFormConfig, ProgressMetric } from "@/lib/types";

const moodColorMap: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  red: "border-red-500/30 bg-red-500/10 text-red-400",
};

function ScaleInput({ metric, value, onChange }: { metric: ProgressMetric; value: string; onChange: (v: string) => void }) {
  const min = metric.min ?? 1;
  const max = metric.max ?? 10;
  const selected = value ? parseInt(value) : null;
  const points = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap">
        {points.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(String(p))}
            className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all cursor-pointer border ${
              selected === p
                ? "bg-[#E2B830] text-[#1a1a1a] border-[#E2B830]"
                : "bg-bg-card border-[rgba(0,0,0,0.08)] text-text-muted hover:border-[#E2B830]/40 hover:text-text-primary"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="text-xs text-text-muted mt-1.5">
          {selected <= 3 ? "Low" : selected <= 6 ? "Moderate" : "High"} ({selected}/{max})
        </div>
      )}
    </div>
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

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/admin/form-config?type=checkin");
        if (res.ok) {
          const data = await res.json();
          setConfig(data.config);
        }
      } catch {
        // Fallback config if fetch fails
        setConfig({
          checkin_day: "monday",
          mood_enabled: true,
          mood_options: [
            { value: "great", label: "Great", color: "emerald" },
            { value: "good", label: "Good", color: "blue" },
            { value: "okay", label: "Okay", color: "amber" },
            { value: "struggling", label: "Struggling", color: "red" },
          ],
          questions: [
            { id: "wins", label: "Wins this week", placeholder: "What went well? Any progress or breakthroughs?", type: "textarea", required: false },
            { id: "challenges", label: "Challenges", placeholder: "What are you finding difficult or stuck on?", type: "textarea", required: false },
            { id: "questions", label: "Questions for Gordy", placeholder: "Anything you need help with or want to discuss?", type: "textarea", required: false },
          ],
        });
      }
    }
    loadConfig();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (config?.mood_enabled && !mood) return;
    setError(false);
    setSubmitting(true);

    // Merge progress data into responses so it's stored in the responses JSONB
    const fullResponses = { ...responses, ...progressData };

    try {
      const res = await fetch("/api/portal/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: mood || "good", responses: fullResponses }),
      });

      if (res.ok) {
        setSubmitted(true);
        toast("Check-in submitted - Gordy will review it this week");
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
    setMood(null);
    setResponses({});
    setProgressData({});
  }

  if (submitted) {
    return (
      <div className="max-w-2xl">
        <div className="bg-bg-card border border-emerald-500/20 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">Check-In Submitted</h2>
          <p className="text-text-secondary">Gordy will review your check-in and respond shortly.</p>
          <button
            onClick={resetForm}
            className="mt-6 px-6 py-3 gradient-accent text-[#1a1a1a] rounded-xl text-sm font-medium cursor-pointer"
          >
            Submit Another
          </button>
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

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">{config.title || "Weekly Check-In"}</h1>
        <p className="text-text-secondary mt-1">Let Gordy know how you&apos;re getting on this week.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mood */}
        {config.mood_enabled && config.mood_options.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-text-primary mb-3">How are you feeling this week?</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {config.mood_options.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(m.value)}
                  className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                    mood === m.value
                      ? (moodColorMap[m.color] || "border-accent/30 bg-accent/10 text-accent-bright")
                      : "border-[rgba(0,0,0,0.08)] text-text-muted hover:border-[rgba(0,0,0,0.1)]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic questions */}
        {enabledQuestions.map((q) => {
          if (q.id === "photos") return null; // Photos field is a TODO placeholder
          if (q.type === "select" && q.options?.length) {
            return (
              <div key={q.id}>
                <label className="block text-sm font-medium text-text-primary mb-2">{q.label}</label>
                <div className="flex gap-2 flex-wrap">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setResponses((prev) => ({ ...prev, [q.id]: opt }))}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                        responses[q.id] === opt
                          ? "bg-[#E2B830]/10 border-[#E2B830]/40 text-[#E2B830]"
                          : "border-[rgba(0,0,0,0.08)] text-text-muted hover:border-[rgba(0,0,0,0.12)]"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
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
          <div>
            <div className="text-sm font-medium text-text-primary mb-4">Progress Tracking</div>
            <div className="space-y-5">
              {enabledMetrics.map((m) => (
                <div key={m.id}>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    {m.label}
                    {m.unit && <span className="text-text-muted font-normal ml-1">({m.unit})</span>}
                  </label>
                  {m.type === "scale" ? (
                    <ScaleInput
                      metric={m}
                      value={progressData[m.id] || ""}
                      onChange={(v) => setProgressData((prev) => ({ ...prev, [m.id]: v }))}
                    />
                  ) : (
                    <input
                      type="number"
                      step="0.1"
                      value={progressData[m.id] || ""}
                      onChange={(e) => setProgressData((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      placeholder={m.unit ? `e.g. 75${m.unit}` : "Enter value"}
                      className="w-full bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-[#E2B830]/40 transition-colors"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={(config.mood_enabled && !mood) || submitting}
          className="w-full py-4 gradient-accent text-[#1a1a1a] rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity"
        >
          {submitting ? "Submitting..." : "Submit Check-In"}
        </button>
        {error && (
          <p className="text-red-400 text-sm text-center">Something went wrong. Please try again.</p>
        )}
      </form>
    </div>
  );
}
