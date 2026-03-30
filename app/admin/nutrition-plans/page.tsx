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

  const fetchTemplates = useCallback(() => {
    setLoading(true);
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
        setShowBuilder(false);
        setEditingTemplate(undefined);
        fetchTemplates();
      }
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
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

  const rangeLabel: Record<string, string> = {
    low: "Low Calorie",
    moderate: "Moderate",
    high: "High Calorie",
    custom: "Custom",
  };

  const rangeColor: Record<string, string> = {
    low: "bg-blue-500/10 text-blue-500",
    moderate: "bg-green-500/10 text-green-500",
    high: "bg-orange-500/10 text-orange-500",
    custom: "bg-purple-500/10 text-purple-500",
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nutrition Plans</h1>
          <p className="text-text-secondary text-[13px] mt-1">Create and manage nutrition templates</p>
        </div>
        <div className="flex gap-2">
          <a
            href="/admin/food-library"
            className="px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary text-[13px] hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors"
          >
            Manage Food Library
          </a>
          <button
            onClick={() => { setEditingTemplate(undefined); setShowBuilder(true); }}
            className="px-4 py-2 rounded-xl bg-accent-bright text-black font-semibold text-[13px]"
          >
            + Create Template
          </button>
        </div>
      </div>

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

      {/* Templates grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-48 bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.06)] rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl p-12 text-center">
          <p className="text-text-secondary">No nutrition templates yet.</p>
          <p className="text-text-secondary/60 text-[13px] mt-1">Create your first template to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const macros = calcTemplateMacros(t);
            return (
              <div
                key={t.id}
                className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl p-4 hover:border-accent-bright/20 transition-colors cursor-pointer group"
                onClick={() => { setEditingTemplate(t); setShowBuilder(true); }}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-text-primary group-hover:text-accent-bright transition-colors">
                    {t.name}
                  </h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                    className="text-text-secondary/30 hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {t.description && (
                  <p className="text-[13px] text-text-secondary mb-3 line-clamp-2">{t.description}</p>
                )}

                <div className="flex gap-2 mb-3">
                  <span className={`text-[13px] px-2 py-0.5 rounded-full font-medium ${rangeColor[t.calorie_range] || rangeColor.custom}`}>
                    {rangeLabel[t.calorie_range] || t.calorie_range}
                  </span>
                  <span className="text-[13px] px-2 py-0.5 rounded-full bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)] text-text-secondary">
                    {t.meals.length} meals
                  </span>
                </div>

                <div className="flex gap-3 text-[13px]">
                  <span className="text-text-primary font-medium">{macros.calories} kcal</span>
                  <span className="text-blue-500">{macros.protein}g P</span>
                  <span className="text-accent-bright">{macros.carbs}g C</span>
                  <span className="text-red-500">{macros.fat}g F</span>
                </div>

                {t.target_calories && (
                  <div className="mt-2 text-[13px] text-text-secondary/50">
                    Target: {t.target_calories} kcal
                  </div>
                )}
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
