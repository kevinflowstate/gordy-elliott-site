"use client";

import { useState, useEffect } from "react";
import type { Food } from "@/lib/types";

interface FoodPickerProps {
  onPick: (food: Food) => void;
  onClose: () => void;
}

const CATEGORIES = [
  "All", "protein", "dairy", "grains", "fruit", "vegetables",
  "fats", "carbs", "snacks", "drinks", "supplements", "other",
];

export default function FoodPicker({ onPick, onClose }: FoodPickerProps) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "All") params.set("category", category);
    if (search) params.set("search", search);

    fetch(`/api/admin/foods?${params}`)
      .then((r) => r.json())
      .then((data) => setFoods(data.foods || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [category, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-bg-card border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-text-primary">Select Food</h3>
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            placeholder="Search foods..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] mb-2"
          />
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`text-[13px] px-2 py-1 rounded-lg transition-colors capitalize ${
                  category === cat
                    ? "bg-accent-bright text-black font-medium"
                    : "text-text-secondary hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Food list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="p-4 text-center text-text-secondary text-[13px]">Loading...</div>
          ) : foods.length === 0 ? (
            <div className="p-4 text-center text-text-secondary text-[13px]">No foods found.</div>
          ) : (
            foods.map((food) => (
              <button
                key={food.id}
                onClick={() => onPick(food)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.03)] transition-colors text-left"
              >
                <div>
                  <span className="text-text-primary font-medium">{food.name}</span>
                  <span className="text-[13px] text-text-secondary/60 ml-2">{food.serving_size}</span>
                </div>
                <div className="flex gap-3 text-[13px] text-text-secondary flex-shrink-0">
                  <span>{food.calories} kcal</span>
                  <span className="text-blue-500">{food.protein_g}g P</span>
                  <span className="text-accent-bright">{food.carbs_g}g C</span>
                  <span className="text-red-500">{food.fat_g}g F</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
