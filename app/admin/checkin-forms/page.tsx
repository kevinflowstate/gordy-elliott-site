"use client";

import { useState, useEffect } from "react";
import type { CheckinFormConfig, FormQuestion, ProgressMetric } from "@/lib/types";

function generateId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_QUESTIONS: FormQuestion[] = [
  { id: "diet_detail", label: "Detail your diet from the last week", placeholder: "Describe what you've been eating...", type: "textarea", enabled: true },
  { id: "diet_adherence", label: "Did you stick to your diet?", placeholder: "", type: "select", options: ["Yes", "Mostly", "No"], enabled: true },
  { id: "wellbeing", label: "How do you feel / overall wellbeing?", placeholder: "How are you feeling overall?", type: "textarea", enabled: true },
  { id: "photos", label: "Current photos (front, back, side)", placeholder: "Upload your progress photos", type: "file", enabled: true },
  { id: "anything_else", label: "Anything else?", placeholder: "Anything else you'd like to share?", type: "textarea", enabled: true },
];

const DEFAULT_PROGRESS_METRICS: ProgressMetric[] = [
  { id: "weight", label: "Weight", type: "number", unit: "kg", enabled: true },
  { id: "sleep", label: "Quality of sleep", type: "scale", min: 1, max: 10, enabled: true },
  { id: "stress", label: "Stress", type: "scale", min: 1, max: 10, enabled: true },
  { id: "hrv", label: "HRV", type: "number", enabled: false },
  { id: "fatigue", label: "Fatigue", type: "scale", min: 1, max: 10, enabled: true },
  { id: "hunger", label: "Hunger", type: "scale", min: 1, max: 10, enabled: false },
  { id: "recovery", label: "Recovery", type: "scale", min: 1, max: 10, enabled: true },
  { id: "energy", label: "Energy", type: "scale", min: 1, max: 10, enabled: true },
  { id: "digestion", label: "Digestion", type: "scale", min: 1, max: 10, enabled: false },
  { id: "steps", label: "Steps", type: "number", enabled: false },
  { id: "glucose", label: "Glucose level", type: "number", enabled: false },
  { id: "waist", label: "Waist", type: "number", unit: "cm", enabled: false },
  { id: "exercise_minutes", label: "Exercise Minutes", type: "number", enabled: false },
];

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${enabled ? "bg-[#E2B830]" : "bg-[rgba(0,0,0,0.1)]"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

function SectionHeader({
  title,
  description,
  open,
  onToggle,
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between text-left cursor-pointer"
    >
      <div>
        <div className="text-base font-heading font-bold text-text-primary">{title}</div>
        <div className="text-xs text-text-muted mt-0.5">{description}</div>
      </div>
      <svg
        className={`w-5 h-5 text-text-muted transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export default function CheckinFormsPage() {
  const [title, setTitle] = useState("Weekly Check-in");
  const [questions, setQuestions] = useState<FormQuestion[]>(DEFAULT_QUESTIONS);
  const [progressMetrics, setProgressMetrics] = useState<ProgressMetric[]>(DEFAULT_PROGRESS_METRICS);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [progressOpen, setProgressOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/admin/form-config?type=checkin");
        if (res.ok) {
          const data = await res.json();
          const cfg: CheckinFormConfig = data.config;
          if (cfg.title) setTitle(cfg.title);
          if (cfg.questions?.length) {
            // Merge loaded questions with defaults (preserve order of defaults, add any extras)
            const loaded = cfg.questions;
            const merged = DEFAULT_QUESTIONS.map((dq) => {
              const found = loaded.find((lq) => lq.id === dq.id);
              return found ? { ...dq, ...found } : dq;
            });
            // Add any custom questions not in defaults
            const custom = loaded.filter((lq) => !DEFAULT_QUESTIONS.find((dq) => dq.id === lq.id));
            setQuestions([...merged, ...custom]);
          }
          if (cfg.progress_tracking?.length) {
            const loaded = cfg.progress_tracking;
            const merged = DEFAULT_PROGRESS_METRICS.map((dm) => {
              const found = loaded.find((lm) => lm.id === dm.id);
              return found ? { ...dm, ...found } : dm;
            });
            const custom = loaded.filter((lm) => !DEFAULT_PROGRESS_METRICS.find((dm) => dm.id === lm.id));
            setProgressMetrics([...merged, ...custom]);
          }
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  function toggleQuestion(idx: number) {
    setQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, enabled: !q.enabled } : q));
  }

  function updateQuestionLabel(idx: number, label: string) {
    setQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, label } : q));
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function addCustomQuestion() {
    const newQ: FormQuestion = {
      id: generateId(),
      label: "",
      placeholder: "",
      type: "textarea",
      enabled: true,
    };
    setQuestions((prev) => [...prev, newQ]);
  }

  function toggleMetric(idx: number) {
    setProgressMetrics((prev) => prev.map((m, i) => i === idx ? { ...m, enabled: !m.enabled } : m));
  }

  function removeMetric(idx: number) {
    setProgressMetrics((prev) => prev.filter((_, i) => i !== idx));
  }

  function addCustomMetric() {
    const newM: ProgressMetric = {
      id: generateId(),
      label: "",
      type: "number",
      enabled: true,
    };
    setProgressMetrics((prev) => [...prev, newM]);
  }

  function updateMetricLabel(idx: number, label: string) {
    setProgressMetrics((prev) => prev.map((m, i) => i === idx ? { ...m, label } : m));
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage("");

    const config: CheckinFormConfig = {
      title,
      checkin_day: "monday",
      mood_enabled: true,
      mood_options: [
        { value: "great", label: "Great", color: "emerald" },
        { value: "good", label: "Good", color: "blue" },
        { value: "okay", label: "Okay", color: "amber" },
        { value: "struggling", label: "Struggling", color: "red" },
      ],
      questions,
      progress_tracking: progressMetrics,
    };

    try {
      const res = await fetch("/api/admin/form-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "checkin", config }),
      });

      if (res.ok) {
        setSaveMessage("Saved");
        setTimeout(() => setSaveMessage(""), 2500);
      } else {
        const data = await res.json();
        setSaveMessage(`Error: ${data.error || "Failed to save"}`);
      }
    } catch {
      setSaveMessage("Error: Failed to save");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-8 w-48 mb-2" />
          <div className="animate-pulse bg-[rgba(0,0,0,0.08)] rounded-lg h-4 w-72" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded-2xl h-20 border border-[rgba(0,0,0,0.06)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Check-in Forms</h1>
        <p className="text-text-secondary mt-1">Configure the weekly check-in form your clients complete.</p>
      </div>

      {/* Form Title */}
      <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-5 mb-4">
        <label className="block text-sm font-medium text-text-primary mb-2">Form Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Weekly Check-in"
          className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-[#E2B830]/40 transition-colors"
        />
      </div>

      {/* Check-in Questions */}
      <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-5 mb-4">
        <SectionHeader
          title="Check-in Questions"
          description="Questions clients answer during their weekly check-in"
          open={questionsOpen}
          onToggle={() => setQuestionsOpen((o) => !o)}
        />

        {questionsOpen && (
          <div className="mt-4 space-y-2">
            {questions.map((q, idx) => {
              return (
                <div
                  key={q.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    q.enabled
                      ? "border-[rgba(0,0,0,0.06)] bg-bg-primary"
                      : "border-[rgba(0,0,0,0.04)] bg-[rgba(0,0,0,0.01)] opacity-60"
                  }`}
                >
                  <Toggle enabled={!!q.enabled} onToggle={() => toggleQuestion(idx)} />
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={q.label}
                      onChange={(e) => updateQuestionLabel(idx, e.target.value)}
                      placeholder="Question label"
                      className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                    />
                    <div className="text-[10px] text-text-muted mt-0.5">{q.type === "select" ? q.options?.join(" / ") : q.type === "file" ? "Photo upload" : "Free text"}</div>
                  </div>
                  {/* Only allow removing custom questions (not the defaults) */}
                  {!DEFAULT_QUESTIONS.find((dq) => dq.id === q.id) && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(idx)}
                      className="text-text-muted hover:text-red-400 transition-colors p-1 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addCustomQuestion}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[rgba(0,0,0,0.08)] hover:border-[#E2B830]/30 rounded-xl text-xs text-text-muted hover:text-[#E2B830] transition-colors cursor-pointer mt-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add custom question
            </button>
          </div>
        )}
      </div>

      {/* Progress Tracking */}
      <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-2xl p-5 mb-4">
        <SectionHeader
          title="Progress Tracking"
          description="Numeric metrics tracked over time and shown as trends"
          open={progressOpen}
          onToggle={() => setProgressOpen((o) => !o)}
        />

        {progressOpen && (
          <div className="mt-4 space-y-2">
            {progressMetrics.map((m, idx) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  m.enabled
                    ? "border-[rgba(0,0,0,0.06)] bg-bg-primary"
                    : "border-[rgba(0,0,0,0.04)] bg-[rgba(0,0,0,0.01)] opacity-60"
                }`}
              >
                <Toggle enabled={m.enabled} onToggle={() => toggleMetric(idx)} />
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={m.label}
                    onChange={(e) => updateMetricLabel(idx, e.target.value)}
                    placeholder="Metric label"
                    className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                  />
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {m.type === "scale" ? `Scale ${m.min ?? 1}–${m.max ?? 10}` : `Number${m.unit ? ` (${m.unit})` : ""}`}
                  </div>
                </div>
                {!DEFAULT_PROGRESS_METRICS.find((dm) => dm.id === m.id) && (
                  <button
                    type="button"
                    onClick={() => removeMetric(idx)}
                    className="text-text-muted hover:text-red-400 transition-colors p-1 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addCustomMetric}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[rgba(0,0,0,0.08)] hover:border-[#E2B830]/30 rounded-xl text-xs text-text-muted hover:text-[#E2B830] transition-colors cursor-pointer mt-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add custom metric
            </button>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 gradient-accent text-[#1a1a1a] rounded-xl text-sm font-semibold disabled:opacity-40 cursor-pointer transition-opacity"
        >
          {saving ? "Saving..." : "Save Form Config"}
        </button>
        {saveMessage && (
          <span className={`text-sm ${saveMessage.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>
            {saveMessage}
          </span>
        )}
      </div>
    </div>
  );
}
