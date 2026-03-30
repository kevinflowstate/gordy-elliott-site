"use client";

import { useState, useEffect } from "react";
import type { NutritionTemplate } from "@/lib/types";

interface NutritionTemplatePickerProps {
  onSelect: (templateId: string) => void;
  onClose: () => void;
}

export default function NutritionTemplatePicker({ onSelect, onClose }: NutritionTemplatePickerProps) {
  const [templates, setTemplates] = useState<NutritionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/nutrition-templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = templates.filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  const rangeLabel: Record<string, string> = { low: "Low Cal", moderate: "Moderate", high: "High Cal", custom: "Custom" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-bg-card border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-text-primary">Select Nutrition Template</h3>
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px]"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-4 text-center text-text-secondary text-[13px]">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-text-secondary text-[13px]">No templates found.</div>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.03)] transition-colors text-left"
              >
                <div>
                  <span className="text-text-primary font-medium">{t.name}</span>
                  {t.description && (
                    <p className="text-[13px] text-text-secondary/60 mt-0.5 line-clamp-1">{t.description}</p>
                  )}
                </div>
                <div className="flex gap-2 text-[13px] flex-shrink-0 ml-2">
                  <span className="px-2 py-0.5 rounded-full bg-accent-bright/10 text-accent-bright">
                    {rangeLabel[t.calorie_range] || t.calorie_range}
                  </span>
                  <span className="text-text-secondary">
                    {t.meals.length} meals
                  </span>
                  {t.target_calories && (
                    <span className="text-text-secondary/60">{t.target_calories} kcal</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
