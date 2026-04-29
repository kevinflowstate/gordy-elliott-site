"use client";

import { useEffect, useState, useCallback } from "react";
import NutritionTemplateBuilder from "@/components/admin/NutritionTemplateBuilder";
import type { NutritionTemplate } from "@/lib/types";

export default function NutritionPlansPage() {
  const [templates, setTemplates] = useState<NutritionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NutritionTemplate | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [calorieFilter, setCalorieFilter] = useState("All");
  const [showAiForm, setShowAiForm] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const fetchTemplates = useCallback(() => {
    fetch("/api/admin/nutrition-templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSave = async (template: NutritionTemplate) => {
    try {
      const res = await fetch("/api/admin/nutrition-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      if (res.ok) {
        setLoading(true);
        setShowBuilder(false);
        setEditingTemplate(undefined);
        fetchTemplates();
      }
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Archive "${name}"?\n\nThis removes it from the template library. Clients who already have it assigned keep their copy — it won't be deleted from them.`)) return;
    try {
      setLoading(true);
      await fetch("/api/admin/nutrition-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchTemplates();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleDuplicate = async (t: NutritionTemplate) => {
    const duplicate: NutritionTemplate = {
      ...t,
      id: "",
      name: `${t.name} (copy)`,
      meals: t.meals.map((m) => ({
        ...m,
        id: `temp-${Math.random().toString(36).slice(2)}`,
        template_id: undefined,
        items: m.items.map((item) => ({ ...item, id: `temp-${Math.random().toString(36).slice(2)}` })),
      })),
      created_at: "",
      updated_at: "",
    };
    try {
      setLoading(true);
      const res = await fetch("/api/admin/nutrition-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: duplicate }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to duplicate template");
      }
      fetchTemplates();
    } catch (err) {
      console.error("Failed to duplicate:", err);
      setLoading(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      alert("Tell SHIFT what kind of nutrition template to generate first.");
      return;
    }

    setAiGenerating(true);
    try {
      const res = await fetch("/api/admin/ai-generate-nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Failed to generate nutrition template");
        return;
      }

      setAiPrompt("");
      setShowAiForm(false);
      setLoading(true);
      fetchTemplates();
    } catch (err) {
      console.error("Failed to generate nutrition template:", err);
      alert("Failed to generate nutrition template");
    } finally {
      setAiGenerating(false);
    }
  };

  const filtered = templates.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (calorieFilter !== "All" && t.calorie_range !== calorieFilter) return false;
    return true;
  });

  // Calculate total macros for a template
  const calcTemplateMacros = (t: NutritionTemplate) => {
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    for (const meal of t.meals) {
      for (const item of meal.items) {
        const food = item.food;
        if (!food) continue;
        const qty = Number(item.quantity) || 1;
        calories += food.calories * qty;
        protein += food.protein_g * qty;
        carbs += food.carbs_g * qty;
        fat += food.fat_g * qty;
      }
    }
    return { calories: Math.round(calories), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nutrition Plans</h1>
          <p className="text-text-secondary text-[13px] mt-1">
            Templates. Editing a template doesn&apos;t push changes to clients who already have it — their copy is snapshot-assigned on the client&apos;s profile.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/admin/food-library"
            className="px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary text-[13px] hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors"
          >
            Manage Food Library
          </a>
          <button
            onClick={() => setShowAiForm((show) => !show)}
            className="px-4 py-2 rounded-xl border border-[#E040D0]/25 bg-[#E040D0]/10 text-[#E040D0] font-semibold text-[13px] hover:bg-[#E040D0]/15 transition-colors"
          >
            AI Generate
          </button>
          <button
            onClick={() => { setEditingTemplate(undefined); setShowBuilder(true); }}
            className="px-4 py-2 rounded-xl gradient-accent text-white font-semibold text-[13px]"
          >
            + Create Template
          </button>
        </div>
      </div>

      {showAiForm && (
        <div className="mb-6 rounded-2xl border border-[#E040D0]/20 bg-[#E040D0]/5 p-5">
          <div className="mb-3">
            <h2 className="text-base font-heading font-bold text-text-primary">Generate a Gordy-style sample plan</h2>
            <p className="mt-1 text-[13px] text-text-secondary">
              Uses Gordy&apos;s rules: high-protein meals, moderate fats, carbs scaled to the calorie tier, low added sugar, and template-safe swap notes.
            </p>
          </div>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={4}
            placeholder="e.g. 1700 calorie working-day fat-loss template, 160g protein, four meals, easy prep, chicken and salmon okay, low added sugar."
            className="w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-bg-primary px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-[#E040D0]/40 focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiGenerating}
              className="rounded-xl gradient-accent px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiGenerating ? "Generating..." : "Generate Template"}
            </button>
            <button
              type="button"
              onClick={() => setShowAiForm(false)}
              className="rounded-xl px-4 py-2 text-[13px] font-semibold text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] w-64"
        />
        <select
          value={calorieFilter}
          onChange={(e) => setCalorieFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px]"
        >
          <option value="All">All Ranges</option>
          <option value="low">Low Calorie</option>
          <option value="moderate">Moderate</option>
          <option value="high">High Calorie</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* Templates table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-16 bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.06)] rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />
          <div className="p-12 text-center">
            <p className="text-text-secondary">No nutrition templates yet.</p>
            <p className="text-text-muted text-[13px] mt-1">Create your first template to get started.</p>
          </div>
        </div>
      ) : (
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden hover:border-accent/40 hover:shadow-[0_8px_32px_rgba(224,64,208,0.12)] transition-all">
          {/* Gold top accent line */}
          <div className="h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_80px_120px_120px_120px_80px] gap-2 px-5 py-3 border-b border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.02)]">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Plan Name</span>
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider text-center">Calories</span>
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider text-center">Meals</span>
            <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider text-center">Protein</span>
            <span className="text-[11px] font-semibold text-accent-bright uppercase tracking-wider text-center">Carbs</span>
            <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider text-center">Fat</span>
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider text-center">Actions</span>
          </div>

          {/* Table rows */}
          {filtered.map((t, idx) => {
            const macros = calcTemplateMacros(t);
            const rowColors = [
              "bg-blue-500/5 hover:bg-blue-500/10",
              "bg-accent-bright/5 hover:bg-accent-bright/10",
              "bg-purple-500/5 hover:bg-purple-500/10",
              "bg-emerald-500/5 hover:bg-emerald-500/10",
              "bg-orange-500/5 hover:bg-orange-500/10",
            ];
            const rowColor = rowColors[idx % rowColors.length];

            return (
              <div
                key={t.id}
                onClick={() => { setEditingTemplate(t); setShowBuilder(true); }}
                className={`grid grid-cols-[1fr_100px_80px_120px_120px_120px_80px] gap-2 px-5 py-4 items-center cursor-pointer transition-colors border-b border-[rgba(0,0,0,0.04)] last:border-0 ${rowColor}`}
              >
                {/* Name + description */}
                <div className="min-w-0">
                  <h3 className="font-semibold text-text-primary text-[14px] truncate">{t.name}</h3>
                  {t.description && (
                    <p className="text-[12px] text-text-muted truncate mt-0.5">{t.description}</p>
                  )}
                </div>

                {/* Calories */}
                <div className="text-center">
                  <span className="text-[14px] font-bold text-text-primary">{macros.calories}</span>
                  <span className="text-[11px] text-text-muted ml-0.5">kcal</span>
                </div>

                {/* Meals */}
                <div className="text-center">
                  <span className="text-[14px] font-semibold text-text-primary">{t.meals.length}</span>
                </div>

                {/* Protein */}
                <div className="text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 font-bold text-[13px]">
                    {macros.protein}g
                  </span>
                </div>

                {/* Carbs */}
                <div className="text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent-bright/10 text-accent-bright font-bold text-[13px]">
                    {macros.carbs}g
                  </span>
                </div>

                {/* Fat */}
                <div className="text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 font-bold text-[13px]">
                    {macros.fat}g
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(t); }}
                    title="Duplicate this template (safe copy to edit without affecting the original)"
                    className="p-1.5 text-text-muted hover:text-accent-bright transition-colors rounded-lg hover:bg-accent-bright/10"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(t.id, t.name); }}
                    title="Archive from library. Clients already assigned this template keep their copy."
                    className="p-1.5 text-text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Builder slide-over */}
      {showBuilder && (
        <NutritionTemplateBuilder
          template={editingTemplate}
          onSave={handleSave}
          onCancel={() => { setShowBuilder(false); setEditingTemplate(undefined); }}
        />
      )}
    </div>
  );
}
