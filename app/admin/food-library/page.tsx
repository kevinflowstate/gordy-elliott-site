"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Food } from "@/lib/types";

const CATEGORIES = [
  "protein",
  "dairy",
  "grains",
  "fruit",
  "vegetables",
  "fats",
  "carbs",
  "snacks",
  "drinks",
  "supplements",
  "other",
] as const;

type Category = typeof CATEGORIES[number];

// Category badges use 500/10 tinted backgrounds + 500-weight text so they read
// correctly against both the light (white) and dark (#1A1A1A) admin surfaces.
// Tailwind utilities with opacity preserve background tints in dark mode via the
// globals.css `revert-layer` rules, and the 500-weight text keeps contrast high.
const CATEGORY_BADGE: Record<Category, string> = {
  protein:     "bg-blue-500/10 text-blue-500 border border-blue-500/20",
  dairy:       "bg-purple-500/10 text-purple-500 border border-purple-500/20",
  grains:      "bg-amber-500/10 text-amber-500 border border-amber-500/20",
  fruit:       "bg-pink-500/10 text-pink-500 border border-pink-500/20",
  vegetables:  "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
  fats:        "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20",
  carbs:       "bg-orange-500/10 text-orange-500 border border-orange-500/20",
  snacks:      "bg-red-500/10 text-red-500 border border-red-500/20",
  drinks:      "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20",
  supplements: "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20",
  other:       "bg-[rgba(0,0,0,0.04)] text-text-muted border border-[rgba(0,0,0,0.08)]",
};

function categoryBadgeClass(category: string): string {
  return CATEGORY_BADGE[category as Category] ?? CATEGORY_BADGE.other;
}

interface FoodFormState {
  name: string;
  category: Category;
  serving_size: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fibre_g: string;
  photo_url: string;
}

const EMPTY_FORM: FoodFormState = {
  name: "",
  category: "protein",
  serving_size: "",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  fibre_g: "",
  photo_url: "",
};

function macroToString(value: number | undefined | null): string {
  if (value == null) return "-";
  return `${value}g`;
}

export default function FoodLibraryPage() {
  const { toast } = useToast();
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | Category>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [form, setForm] = useState<FoodFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchFoods = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/foods?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setFoods(data.foods || []);
      }
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, search]);

  useEffect(() => {
    const id = setTimeout(() => { fetchFoods(); }, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [fetchFoods, search]);

  function openAdd() {
    setEditingFood(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(food: Food) {
    setEditingFood(food);
    setForm({
      name: food.name,
      category: food.category as Category,
      serving_size: food.serving_size,
      calories: String(food.calories),
      protein_g: String(food.protein_g),
      carbs_g: String(food.carbs_g),
      fat_g: String(food.fat_g),
      fibre_g: food.fibre_g != null ? String(food.fibre_g) : "",
      photo_url: food.photo_url || "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingFood(null);
    setForm(EMPTY_FORM);
  }

  function setField(key: keyof FoodFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.serving_size.trim() || !form.calories) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        serving_size: form.serving_size.trim(),
        calories: parseFloat(form.calories),
        protein_g: parseFloat(form.protein_g) || 0,
        carbs_g: parseFloat(form.carbs_g) || 0,
        fat_g: parseFloat(form.fat_g) || 0,
        fibre_g: form.fibre_g ? parseFloat(form.fibre_g) : null,
        photo_url: form.photo_url.trim() || null,
      };

      const res = editingFood
        ? await fetch("/api/admin/foods", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingFood.id, ...payload }),
          })
        : await fetch("/api/admin/foods", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        toast(editingFood ? "Food updated" : "Food added");
        closeModal();
        fetchFoods();
      } else {
        const err = await res.json();
        toast(err.error || "Failed to save food", "error");
      }
    } catch {
      toast("Failed to save food", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(food: Food) {
    if (!confirm(`Delete "${food.name}"?`)) return;
    setDeletingId(food.id);
    try {
      const res = await fetch("/api/admin/foods", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: food.id }),
      });
      if (res.ok) {
        toast("Food removed");
        fetchFoods();
      } else {
        toast("Failed to delete food", "error");
      }
    } catch {
      toast("Failed to delete food", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Food Library</h1>
          <p className="text-text-secondary mt-1">
            {loading ? "Loading..." : `${foods.length} item${foods.length !== 1 ? "s" : ""}${categoryFilter !== "all" ? ` in ${categoryFilter}` : ""}`}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-5 py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Food
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search foods..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-bg-card/80 border border-[rgba(0,0,0,0.08)] rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as "all" | Category)}
          className="px-4 py-2.5 bg-bg-card/80 border border-[rgba(0,0,0,0.08)] rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer min-w-[160px]"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded h-4 flex-1" />
                  <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded h-4 w-20" />
                  <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded h-4 w-24" />
                  <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded h-4 w-16" />
                  <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded h-4 w-16" />
                  <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded h-4 w-16" />
                  <div className="animate-pulse bg-[rgba(0,0,0,0.06)] rounded h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        ) : foods.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[rgba(0,0,0,0.04)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-text-secondary text-sm">No foods found</p>
            <p className="text-text-muted text-xs mt-1">
              {search || categoryFilter !== "all" ? "Try adjusting your filters" : "Add your first food to get started"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(0,0,0,0.06)]">
                  <th className="px-3 py-3.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider w-10"></th>
                  <th className="px-3 py-3.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-text-muted uppercase tracking-wider">Serving</th>
                  <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-text-muted uppercase tracking-wider">Calories</th>
                  <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-text-muted uppercase tracking-wider">Protein</th>
                  <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-text-muted uppercase tracking-wider">Carbs</th>
                  <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-text-muted uppercase tracking-wider">Fat</th>
                  <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-text-muted uppercase tracking-wider">Fibre</th>
                  <th className="px-4 py-3.5 text-right text-[11px] font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {foods.map((food) => (
                  <tr key={food.id} className="hover:bg-[rgba(0,0,0,0.015)] transition-colors group">
                    <td className="px-3 py-3">
                      {food.photo_url ? (
                        <img src={food.photo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[rgba(0,0,0,0.04)] flex items-center justify-center">
                          <svg className="w-4 h-4 text-text-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 font-medium text-text-primary whitespace-nowrap">{food.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${categoryBadgeClass(food.category)}`}>
                        {food.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{food.serving_size}</td>
                    <td className="px-4 py-3 text-right text-text-primary font-medium tabular-nums">{food.calories}</td>
                    <td className="px-4 py-3 text-right text-text-secondary tabular-nums">{macroToString(food.protein_g)}</td>
                    <td className="px-4 py-3 text-right text-text-secondary tabular-nums">{macroToString(food.carbs_g)}</td>
                    <td className="px-4 py-3 text-right text-text-secondary tabular-nums">{macroToString(food.fat_g)}</td>
                    <td className="px-4 py-3 text-right text-text-secondary tabular-nums">{macroToString(food.fibre_g)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(food)}
                          className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.06)] text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(food)}
                          disabled={deletingId === food.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-500 transition-colors cursor-pointer disabled:opacity-40"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-2xl p-6 w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-heading font-bold text-text-primary mb-5">
              {editingFood ? "Edit Food" : "Add Food"}
            </h3>

            <div className="space-y-4">
              {/* Name + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder="e.g. Chicken Breast"
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value)}
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-2.5 text-text-primary text-sm focus:outline-none focus:border-accent/40 cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Serving Size</label>
                  <input
                    type="text"
                    value={form.serving_size}
                    onChange={(e) => setField("serving_size", e.target.value)}
                    placeholder="e.g. 100g"
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-4 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                  />
                </div>
              </div>

              {/* Macros */}
              <div>
                <p className="text-xs font-medium text-text-secondary mb-2">Macros per serving</p>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1">Calories</label>
                    <input
                      type="number"
                      min="0"
                      value={form.calories}
                      onChange={(e) => setField("calories", e.target.value)}
                      placeholder="0"
                      className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1">Protein (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.protein_g}
                      onChange={(e) => setField("protein_g", e.target.value)}
                      placeholder="0"
                      className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1">Carbs (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.carbs_g}
                      onChange={(e) => setField("carbs_g", e.target.value)}
                      placeholder="0"
                      className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1">Fat (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.fat_g}
                      onChange={(e) => setField("fat_g", e.target.value)}
                      placeholder="0"
                      className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                    />
                  </div>
                </div>
              </div>

              {/* Fibre + Photo URL (optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-text-muted mb-1">Fibre (g) <span className="text-text-muted/60">optional</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.fibre_g}
                    onChange={(e) => setField("fibre_g", e.target.value)}
                    placeholder="0"
                    className="w-full bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                  />
                </div>
              </div>

              {/* Photo URL */}
              <div>
                <label className="block text-[11px] text-text-muted mb-1">Photo URL <span className="text-text-muted/60">optional</span></label>
                <div className="flex gap-2 items-start">
                  <input
                    type="url"
                    value={form.photo_url}
                    onChange={(e) => setField("photo_url", e.target.value)}
                    placeholder="https://..."
                    className="flex-1 bg-bg-primary border border-[rgba(0,0,0,0.08)] rounded-xl px-3 py-2.5 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                  />
                  {form.photo_url && (
                    <img src={form.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-[rgba(0,0,0,0.08)] flex-shrink-0" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.serving_size.trim() || !form.calories}
                className="flex-1 py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity"
              >
                {saving ? "Saving..." : editingFood ? "Save Changes" : "Add Food"}
              </button>
              <button
                onClick={closeModal}
                className="px-5 py-2.5 text-text-muted text-sm hover:text-text-secondary cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
