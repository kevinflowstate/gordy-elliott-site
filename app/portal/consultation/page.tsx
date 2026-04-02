"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ConsultationData {
  fitness_level?: string;
  primary_goal?: string;
  training_days?: string;
  equipment_access?: string;
  dietary_preferences?: string;
  injuries?: string;
  supplements?: string;
  additional_info?: string;
}

export default function ConsultationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<ConsultationData>({
    fitness_level: "",
    primary_goal: "",
    training_days: "",
    equipment_access: "",
    dietary_preferences: "",
    injuries: "",
    supplements: "",
    additional_info: "",
  });

  useEffect(() => {
    async function loadConsultation() {
      try {
        const res = await fetch("/api/portal/consultation");
        if (res.ok) {
          const data = await res.json();
          if (data.consultation_data) {
            setForm((prev) => ({ ...prev, ...data.consultation_data }));
          }
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
        body: JSON.stringify(form),
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

  function handleChange(field: keyof ConsultationData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-text-primary mb-1">Initial Consultation</h1>
        <p className="text-text-secondary text-sm">Help us personalise your AI coaching experience by filling in your details below.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Fitness Level */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-5">
          <label className="block text-sm font-semibold text-text-primary mb-3">
            Current Fitness Level
          </label>
          <select
            value={form.fitness_level}
            onChange={(e) => handleChange("fitness_level", e.target.value)}
            required
            className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-[#E040D0]/50"
          >
            <option value="">Select...</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>

        {/* Primary Goal */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-5">
          <label className="block text-sm font-semibold text-text-primary mb-3">
            Primary Goal
          </label>
          <select
            value={form.primary_goal}
            onChange={(e) => handleChange("primary_goal", e.target.value)}
            required
            className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-[#E040D0]/50"
          >
            <option value="">Select...</option>
            <option value="Weight Loss">Weight Loss</option>
            <option value="Muscle Gain">Muscle Gain</option>
            <option value="General Fitness">General Fitness</option>
            <option value="Sport Specific">Sport Specific</option>
            <option value="Flexibility & Mobility">Flexibility &amp; Mobility</option>
          </select>
        </div>

        {/* Training Days */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-5">
          <label className="block text-sm font-semibold text-text-primary mb-3">
            Training Days Per Week
          </label>
          <select
            value={form.training_days}
            onChange={(e) => handleChange("training_days", e.target.value)}
            required
            className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-[#E040D0]/50"
          >
            <option value="">Select...</option>
            {["2", "3", "4", "5", "6"].map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
        </div>

        {/* Equipment Access */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-5">
          <label className="block text-sm font-semibold text-text-primary mb-3">
            Equipment Access
          </label>
          <select
            value={form.equipment_access}
            onChange={(e) => handleChange("equipment_access", e.target.value)}
            required
            className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-[#E040D0]/50"
          >
            <option value="">Select...</option>
            <option value="Full Gym">Full Gym</option>
            <option value="Home Gym">Home Gym</option>
            <option value="Limited">Limited</option>
            <option value="Bodyweight Only">Bodyweight Only</option>
          </select>
        </div>

        {/* Dietary Preferences */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-5">
          <label className="block text-sm font-semibold text-text-primary mb-3">
            Dietary Preferences or Restrictions
          </label>
          <textarea
            value={form.dietary_preferences}
            onChange={(e) => handleChange("dietary_preferences", e.target.value)}
            placeholder="e.g. vegetarian, lactose intolerant, no preferences..."
            rows={3}
            className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[#E040D0]/50 resize-none"
          />
        </div>

        {/* Injuries */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-5">
          <label className="block text-sm font-semibold text-text-primary mb-3">
            Any Injuries or Limitations
          </label>
          <textarea
            value={form.injuries}
            onChange={(e) => handleChange("injuries", e.target.value)}
            placeholder="e.g. lower back issues, bad knee, none..."
            rows={3}
            className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[#E040D0]/50 resize-none"
          />
        </div>

        {/* Supplements */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-5">
          <label className="block text-sm font-semibold text-text-primary mb-3">
            Current Supplements
          </label>
          <textarea
            value={form.supplements}
            onChange={(e) => handleChange("supplements", e.target.value)}
            placeholder="e.g. protein powder, creatine, none..."
            rows={3}
            className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[#E040D0]/50 resize-none"
          />
        </div>

        {/* Additional Info */}
        <div className="bg-bg-card border border-[rgba(0,0,0,0.06)] rounded-xl p-5">
          <label className="block text-sm font-semibold text-text-primary mb-3">
            Anything Else We Should Know
          </label>
          <textarea
            value={form.additional_info}
            onChange={(e) => handleChange("additional_info", e.target.value)}
            placeholder="Any other context that would help us personalise your coaching..."
            rows={4}
            className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[#E040D0]/50 resize-none"
          />
        </div>

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
