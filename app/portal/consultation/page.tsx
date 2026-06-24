"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ConsultationFormConfig } from "@/lib/consultation-form";
import type { FormQuestion } from "@/lib/types";

type ConsultationValue = string | boolean;
type ConsultationData = Record<string, ConsultationValue>;

const DEFAULT_CONFIG: ConsultationFormConfig = {
  title: "Initial Consultation",
  description: "Help us personalise your coaching experience by filling in your details below.",
  questions: [],
};

function getValue(form: ConsultationData, id: string) {
  const value = form[id];
  return typeof value === "string" ? value : "";
}

function optionLabel(question: FormQuestion, option: string, idx: number) {
  if (question.id === "training_days" && /^\d+$/.test(option)) return `${option} days`;
  if (question.id === "sex") return question.options?.[idx] || option;
  return option;
}

export default function ConsultationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState<ConsultationFormConfig>(DEFAULT_CONFIG);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [form, setForm] = useState<ConsultationData>({
    date_of_birth: "",
    sex: "",
    cycle_tracking_enabled: false,
  });

  useEffect(() => {
    async function loadConsultation() {
      try {
        const res = await fetch("/api/portal/consultation");
        if (res.ok) {
          const data = await res.json();
          if (data.config) setConfig(data.config);
          setForm((prev) => ({
            ...prev,
            ...(data.consultation_data || {}),
            date_of_birth: data.date_of_birth || prev.date_of_birth || "",
            sex: data.sex || prev.sex || "",
            cycle_tracking_enabled: Boolean(data.sex === "female" && data.cycle_tracking_enabled),
          }));
          setPrivacyConsent(Boolean(data.consultation_data?.privacy_consent));
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    loadConsultation();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/portal/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, privacy_consent: privacyConsent }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => router.push("/portal"), 2000);
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field: string, value: ConsultationValue) {
    setForm((prev) => {
      if (field === "sex") {
        return {
          ...prev,
          sex: value,
          cycle_tracking_enabled: value === "female" ? prev.cycle_tracking_enabled : false,
        };
      }
      return { ...prev, [field]: value };
    });
  }

  function renderQuestion(question: FormQuestion) {
    if (question.enabled === false) return null;
    if (question.id === "cycle_tracking_enabled" && form.sex !== "female") return null;

    const commonClass = "w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[#E040D0]/50";
    const value = getValue(form, question.id);

    if (question.type === "textarea") {
      return (
        <textarea
          value={value}
          onChange={(e) => handleChange(question.id, e.target.value)}
          placeholder={question.placeholder}
          required={question.required}
          rows={question.id === "additional_info" ? 4 : 3}
          className={`${commonClass} resize-none`}
        />
      );
    }

    if (question.type === "select") {
      const options = question.id === "sex"
        ? [
            { value: "female", label: optionLabel(question, "Female", 0) },
            { value: "male", label: optionLabel(question, "Male", 1) },
            { value: "prefer_not_to_say", label: optionLabel(question, "Prefer not to say", 2) },
          ]
        : (question.options || []).map((option, idx) => ({ value: option, label: optionLabel(question, option, idx) }));

      return (
        <select
          value={value}
          onChange={(e) => handleChange(question.id, e.target.value)}
          required={question.required}
          className={commonClass}
        >
          <option value="">Select...</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    }

    if (question.type === "boolean") {
      const enabled = Boolean(form[question.id]);
      return (
        <button
          type="button"
          onClick={() => handleChange(question.id, !enabled)}
          className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
            enabled
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-[rgba(0,0,0,0.08)] bg-bg-primary"
          }`}
        >
          <span className="block text-sm font-semibold text-text-primary">{enabled ? "On" : "Off"}</span>
          {question.placeholder && (
            <span className="mt-1 block text-xs text-text-secondary">
              {enabled ? question.placeholder : "This will stay hidden in your portal."}
            </span>
          )}
        </button>
      );
    }

    return (
      <input
        type={question.type === "date" ? "date" : "text"}
        value={value}
        onChange={(e) => handleChange(question.id, e.target.value)}
        placeholder={question.placeholder}
        required={question.required}
        className={commonClass}
      />
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-bg-card rounded-xl h-16" />
          ))}
        </div>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-[#E040D0]/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#E040D0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-heading font-bold text-text-primary mb-2">Consultation Saved</h2>
        <p className="text-text-secondary text-sm">Your information has been saved. Redirecting to your dashboard...</p>
      </div>
    );
  }

  const questions = config.questions.filter((question) => question.enabled !== false);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-text-primary mb-1">{config.title || DEFAULT_CONFIG.title}</h1>
        <p className="text-text-secondary text-sm">{config.description || DEFAULT_CONFIG.description}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map((question) => {
          const control = renderQuestion(question);
          if (!control) return null;

          return (
            <div key={question.id} className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-5">
              <label className="block text-sm font-semibold text-text-primary mb-3">
                {question.label}
                {question.required && <span className="ml-1 text-[#E040D0]">*</span>}
              </label>
              {control}
            </div>
          );
        })}

        <label className="flex gap-3 rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-card p-5 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={privacyConsent}
            onChange={(event) => setPrivacyConsent(event.target.checked)}
            required
            className="mt-0.5 h-4 w-4 rounded border-[rgba(0,0,0,0.2)] text-[#E040D0] focus:ring-[#E040D0]/40"
          />
          <span>
            I understand this form may include health, training, nutrition, injury, and cycle-related information. Gordy will use it to personalise coaching support, not to provide medical diagnosis or emergency care.
          </span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full px-6 py-3 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #E040D0 0%, #b830a8 100%)" }}
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : "Save Consultation"}
        </button>
      </form>
    </div>
  );
}
