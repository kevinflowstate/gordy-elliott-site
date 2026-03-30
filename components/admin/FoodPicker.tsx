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

const FOOD_CATEGORIES = [
  "protein", "dairy", "grains", "fruit", "vegetables",
  "fats", "carbs", "snacks", "drinks", "supplements", "other",
];

const emptyForm = () => ({
  name: "",
  category: "other",
  serving_size: "100g",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
});

export default function FoodPicker({ onPick, onClose }: FoodPickerProps) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  // Custom food form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "All") params.set("category", category);
    if (search) params.set("search", search);

    fetch(`/api/admin/foods?${params}`)
      .then((r) => r.json())
      .then((data) => setFoods(data.foods || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [category, search]);

  function openAddFormWithName(name: string) {
    setAddForm({ ...emptyForm(), name });
    setShowAddForm(true);
  }

  async function handleSaveCustomFood() {
    if (!addForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          category: addForm.category,
          serving_size: addForm.serving_size || "100g",
          calories: Number(addForm.calories) || 0,
          protein_g: Number(addForm.protein_g) || 0,
          carbs_g: Number(addForm.carbs_g) || 0,
          fat_g: Number(addForm.fat_g) || 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onPick(data.food);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const noResults = !loading && foods.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-bg-card border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-text-primary">Select Food</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAddForm({ ...emptyForm(), name: search });
                  setShowAddForm((v) => !v);
                }}
                title="Add custom food"
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  showAddForm
                    ? "bg-accent-bright text-black"
                    : "bg-accent-bright/10 text-accent-bright hover:bg-accent-bright/20"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Add custom food form */}
          {showAddForm && (
            <div className="mb-3 p-3 rounded-xl bg-accent-bright/5 border border-accent-bright/20">
              <p className="text-[12px] font-semibold text-accent-bright mb-2 uppercase tracking-wide">Add Custom Food</p>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Name (required)"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px]"
                    autoFocus
                  />
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                    className="px-2 py-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-bg-card text-text-primary text-[13px]"
                  >
                    {FOOD_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Serving size (e.g. 100g)"
                  value={addForm.serving_size}
                  onChange={(e) => setAddForm((f) => ({ ...f, serving_size: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px]"
                />
                <div className="grid grid-cols-4 gap-2">
                  {(["calories", "protein_g", "carbs_g", "fat_g"] as const).map((field) => (
                    <div key={field}>
                      <label className="text-[11px] text-text-secondary block mb-0.5">
                        {field === "calories" ? "kcal" : field === "protein_g" ? "Protein g" : field === "carbs_g" ? "Carbs g" : "Fat g"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={addForm[field]}
                        onChange={(e) => setAddForm((f) => ({ ...f, [field]: e.target.value }))}
                        placeholder="0"
                        className="w-full px-2 py-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSaveCustomFood}
                    disabled={!addForm.name.trim() || saving}
                    className="px-4 py-1.5 rounded-lg bg-accent-bright text-black text-[13px] font-semibold disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save & Select"}
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary text-[13px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

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
          ) : noResults ? (
            <div className="p-4 text-center">
              <p className="text-text-secondary text-[13px] mb-3">No foods found.</p>
              {search && (
                <button
                  onClick={() => openAddFormWithName(search)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-bright/10 text-accent-bright text-[13px] font-medium hover:bg-accent-bright/20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add &quot;{search}&quot; as custom food
                </button>
              )}
            </div>
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
