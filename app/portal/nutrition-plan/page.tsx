"use client";

import { useEffect, useState, useCallback } from "react";
import MacroDonutChart from "@/components/portal/MacroDonutChart";
import type { ClientNutritionPlan, MealTracking, NutritionMeal, NutritionMealItem, QuickMeal, ClientSavedMeal } from "@/lib/types";

function parseGrams(servingSize: string): number {
  const match = servingSize.match(/~?(\d+)\s*g/i);
  if (match) return parseInt(match[1], 10);
  const mlMatch = servingSize.match(/~?(\d+)\s*ml/i);
  if (mlMatch) return parseInt(mlMatch[1], 10);
  return 100;
}

function calcMealMacros(meal: NutritionMeal) {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  for (const item of meal.items) {
    const food = item.food;
    if (!food) continue;
    const qty = Number(item.quantity) || 1;
    calories += Math.round(food.calories * qty);
    protein += food.protein_g * qty;
    carbs += food.carbs_g * qty;
    fat += food.fat_g * qty;
  }
  return { calories, protein, carbs, fat };
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export default function PortalNutritionPlanPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [plan, setPlan] = useState<ClientNutritionPlan | null>(null);
  const [tracking, setTracking] = useState<MealTracking[]>([]);
  const [quickMeals, setQuickMeals] = useState<QuickMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [savedMeals, setSavedMeals] = useState<ClientSavedMeal[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  // Quick add form
  const [qName, setQName] = useState("");
  const [qCalories, setQCalories] = useState("");
  const [qProtein, setQProtein] = useState("");
  const [qCarbs, setQCarbs] = useState("");
  const [qFat, setQFat] = useState("");
  const [qSave, setQSave] = useState(false);
  const [qSubmitting, setQSubmitting] = useState(false);

  const dateStr = formatDate(selectedDate);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/portal/nutrition-plan?date=${dateStr}`).then((r) => r.json()),
      fetch(`/api/portal/quick-meals?date=${dateStr}`).then((r) => r.json()),
    ])
      .then(([planData, quickData]) => {
        setPlan(planData.plan);
        setTracking(planData.tracking || []);
        setQuickMeals(planData.quickMeals || []);
        setSavedMeals(quickData.savedMeals || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dateStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigateDate = (delta: number) => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

  const toggleMeal = async (mealId: string) => {
    setToggling(mealId);
    const current = tracking.find((t) => t.meal_id === mealId);
    const newCompleted = !current?.completed;

    try {
      const res = await fetch("/api/portal/meal-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal_id: mealId, completed: newCompleted, date: dateStr }),
      });
      const data = await res.json();
      if (data.tracking) {
        setTracking((prev) => {
          const filtered = prev.filter((t) => t.meal_id !== mealId);
          return [...filtered, data.tracking];
        });
      }
    } catch (err) {
      console.error("Failed to toggle meal:", err);
    } finally {
      setToggling(null);
    }
  };

  const toggleQuickMeal = async (qm: QuickMeal) => {
    setToggling(qm.id);
    try {
      const res = await fetch("/api/portal/quick-meals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: qm.id, completed: !qm.completed }),
      });
      const data = await res.json();
      if (data.quickMeal) {
        setQuickMeals((prev) => prev.map((m) => (m.id === qm.id ? data.quickMeal : m)));
      }
    } catch (err) {
      console.error("Failed to toggle quick meal:", err);
    } finally {
      setToggling(null);
    }
  };

  const deleteQuickMeal = async (id: string) => {
    try {
      await fetch("/api/portal/quick-meals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: "quick" }),
      });
      setQuickMeals((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Failed to delete quick meal:", err);
    }
  };

  const addQuickMeal = async () => {
    if (!qName.trim()) return;
    setQSubmitting(true);
    try {
      const res = await fetch("/api/portal/quick-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: qName.trim(),
          calories: Number(qCalories) || 0,
          protein_g: Number(qProtein) || 0,
          carbs_g: Number(qCarbs) || 0,
          fat_g: Number(qFat) || 0,
          date: dateStr,
          saveAsPreset: qSave,
        }),
      });
      const data = await res.json();
      if (data.quickMeal) {
        setQuickMeals((prev) => [...prev, data.quickMeal]);
        setQName("");
        setQCalories("");
        setQProtein("");
        setQCarbs("");
        setQFat("");
        setQSave(false);
        setShowQuickAdd(false);
        // Refresh saved meals if we saved a preset
        if (qSave) {
          fetch(`/api/portal/quick-meals?date=${dateStr}`)
            .then((r) => r.json())
            .then((d) => setSavedMeals(d.savedMeals || []));
        }
      }
    } catch (err) {
      console.error("Failed to add quick meal:", err);
    } finally {
      setQSubmitting(false);
    }
  };

  const addFromSaved = async (saved: ClientSavedMeal) => {
    try {
      const res = await fetch("/api/portal/quick-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saved.name,
          calories: saved.calories,
          protein_g: saved.protein_g,
          carbs_g: saved.carbs_g,
          fat_g: saved.fat_g,
          date: dateStr,
          saveAsPreset: false,
        }),
      });
      const data = await res.json();
      if (data.quickMeal) {
        setQuickMeals((prev) => [...prev, data.quickMeal]);
        setShowSaved(false);
      }
    } catch (err) {
      console.error("Failed to add from saved:", err);
    }
  };

  const deleteSavedMeal = async (id: string) => {
    try {
      await fetch("/api/portal/quick-meals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: "saved" }),
      });
      setSavedMeals((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Failed to delete saved meal:", err);
    }
  };

  const resetDay = async () => {
    if (!plan) return;
    for (const meal of plan.meals) {
      const isCompleted = tracking.find((t) => t.meal_id === meal.id)?.completed;
      if (isCompleted) {
        await fetch("/api/portal/meal-tracking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meal_id: meal.id, completed: false, date: dateStr }),
        });
      }
    }
    for (const qm of quickMeals) {
      if (qm.completed) {
        await fetch("/api/portal/quick-meals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: qm.id, completed: false }),
        });
      }
    }
    fetchData();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.06)] rounded-xl w-48" />
          <div className="h-64 bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.06)] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary mb-4">My Nutrition Plan</h1>
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl p-8 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-text-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 9.75l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-text-secondary text-lg">No nutrition plan assigned yet.</p>
          <p className="text-text-secondary/60 mt-2">Your coach will set one up for you soon.</p>
        </div>
      </div>
    );
  }

  // Calculate consumed macros from completed assigned meals
  let consumedCalories = 0, consumedProtein = 0, consumedCarbs = 0, consumedFat = 0;
  for (const meal of plan.meals) {
    const isCompleted = tracking.find((t) => t.meal_id === meal.id)?.completed;
    if (isCompleted) {
      const macros = calcMealMacros(meal);
      consumedCalories += macros.calories;
      consumedProtein += macros.protein;
      consumedCarbs += macros.carbs;
      consumedFat += macros.fat;
    }
  }

  // Add completed quick meals to consumed totals
  for (const qm of quickMeals) {
    if (qm.completed) {
      consumedCalories += Number(qm.calories);
      consumedProtein += Number(qm.protein_g);
      consumedCarbs += Number(qm.carbs_g);
      consumedFat += Number(qm.fat_g);
    }
  }

  const assignedCompleted = tracking.filter((t) => t.completed).length;
  const quickCompleted = quickMeals.filter((q) => q.completed).length;
  const totalMeals = plan.meals.length + quickMeals.length;
  const totalCompleted = assignedCompleted + quickCompleted;

  return (
    <div className="p-6 max-w-lg mx-auto">
      {/* Date Navigator */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateDate(-1)}
          className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)] transition-colors"
        >
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold text-text-primary">
            {isToday(selectedDate) ? "Today" : formatDateDisplay(selectedDate)}
          </h1>
          {!isToday(selectedDate) && (
            <button
              onClick={() => setSelectedDate(new Date())}
              className="text-[12px] text-accent-bright hover:underline mt-0.5"
            >
              Back to today
            </button>
          )}
          {isToday(selectedDate) && (
            <p className="text-[12px] text-text-secondary mt-0.5">{formatDateDisplay(selectedDate)}</p>
          )}
        </div>
        <button
          onClick={() => navigateDate(1)}
          className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)] transition-colors"
        >
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Macro Chart */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl p-6 mb-6">
        <MacroDonutChart
          targetCalories={plan.target_calories || 0}
          consumedCalories={consumedCalories}
          protein={{ target: plan.target_protein_g || 0, consumed: consumedProtein }}
          carbs={{ target: plan.target_carbs_g || 0, consumed: consumedCarbs }}
          fat={{ target: plan.target_fat_g || 0, consumed: consumedFat }}
        />
        <div className="text-center mt-4">
          <span className="text-[13px] text-text-secondary">
            {totalCompleted} of {totalMeals} meals completed
          </span>
        </div>
      </div>

      {/* Assigned Meal Cards */}
      <div className="space-y-3">
        {plan.meals.map((meal) => {
          const isCompleted = tracking.find((t) => t.meal_id === meal.id)?.completed || false;
          const isLoading = toggling === meal.id;
          const macros = calcMealMacros(meal);

          return (
            <div
              key={meal.id}
              className={`bg-bg-card/80 backdrop-blur-sm border rounded-2xl overflow-hidden transition-all ${
                isCompleted
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)]"
              }`}
            >
              {/* Meal header with toggle */}
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => toggleMeal(meal.id)}
                  disabled={isLoading}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isCompleted
                      ? "bg-green-500 border-green-500"
                      : "border-[rgba(0,0,0,0.15)] dark:border-[rgba(255,255,255,0.15)] hover:border-accent-bright"
                  } ${isLoading ? "opacity-50" : ""}`}
                >
                  {isCompleted && (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold ${isCompleted ? "text-green-600 dark:text-green-400" : "text-text-primary"}`}>
                    {meal.name}
                  </h3>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-[13px] text-text-secondary font-medium">{macros.calories} kcal</span>
                    <span className="text-[13px] text-blue-500">{Math.round(macros.protein)}g P</span>
                    <span className="text-[13px] text-accent-bright">{Math.round(macros.carbs)}g C</span>
                    <span className="text-[13px] text-red-500">{Math.round(macros.fat)}g F</span>
                  </div>
                </div>
              </div>

              {/* Food items */}
              <div className="border-t border-[rgba(0,0,0,0.04)] dark:border-[rgba(255,255,255,0.04)]">
                {meal.items.map((item: NutritionMealItem) => {
                  const food = item.food;
                  if (!food) return null;
                  const qty = Number(item.quantity) || 1;
                  return (
                    <div
                      key={item.id}
                      className="px-4 py-2 flex items-center justify-between border-b border-[rgba(0,0,0,0.02)] dark:border-[rgba(255,255,255,0.02)] last:border-0"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {food.photo_url && (
                          <img
                            src={food.photo_url}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <span className={`text-[13px] ${isCompleted ? "text-text-secondary line-through" : "text-text-primary"}`}>
                            {food.name}
                          </span>
                          <span className="text-[13px] text-text-secondary/60 ml-2">
                            {Math.round(parseGrams(food.serving_size) * qty)}g
                          </span>
                        </div>
                      </div>
                      <span className="text-[13px] text-text-secondary ml-2 flex-shrink-0">
                        {Math.round(food.calories * qty)} kcal
                      </span>
                    </div>
                  );
                })}
                {meal.items.length === 0 && (
                  <div className="px-4 py-3 text-[13px] text-text-secondary/60 text-center">
                    No foods added to this meal.
                  </div>
                )}
              </div>

              {meal.notes && (
                <div className="px-4 py-2 bg-accent-bright/5 text-[13px] text-accent-bright/80 italic">
                  {meal.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Meals Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-text-primary">My Added Meals</h2>
          <div className="flex gap-2">
            {savedMeals.length > 0 && (
              <button
                onClick={() => setShowSaved(!showSaved)}
                className="text-[12px] px-3 py-1.5 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-accent-bright transition-colors"
              >
                Saved Meals
              </button>
            )}
            <button
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="text-[12px] px-3 py-1.5 rounded-xl bg-accent-bright text-black font-semibold"
            >
              + Quick Add
            </button>
          </div>
        </div>

        {/* Saved Meals Picker */}
        {showSaved && savedMeals.length > 0 && (
          <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl p-3 mb-3 space-y-2">
            <p className="text-[12px] text-text-secondary font-medium">Tap to add a saved meal:</p>
            {savedMeals.map((saved) => (
              <div
                key={saved.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)] transition-colors"
              >
                <button
                  onClick={() => addFromSaved(saved)}
                  className="flex-1 text-left"
                >
                  <span className="text-[13px] font-medium text-text-primary">{saved.name}</span>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[12px] text-text-secondary">{Number(saved.calories)} kcal</span>
                    <span className="text-[12px] text-blue-500">{Number(saved.protein_g)}g P</span>
                    <span className="text-[12px] text-accent-bright">{Number(saved.carbs_g)}g C</span>
                    <span className="text-[12px] text-red-500">{Number(saved.fat_g)}g F</span>
                  </div>
                </button>
                <button
                  onClick={() => deleteSavedMeal(saved.id)}
                  className="p-1.5 text-text-secondary/30 hover:text-red-400 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quick Add Form */}
        {showQuickAdd && (
          <div className="bg-bg-card/80 backdrop-blur-sm border border-accent-bright/20 rounded-2xl p-4 mb-3">
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Meal name (e.g. Protein Shake)"
                value={qName}
                onChange={(e) => setQName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-bright/40"
              />
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] text-text-secondary mb-1">Calories</label>
                  <input
                    type="number"
                    value={qCalories}
                    onChange={(e) => setQCalories(e.target.value)}
                    placeholder="0"
                    className="w-full px-2 py-2 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center focus:outline-none focus:border-accent-bright/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-blue-500 mb-1">Protein</label>
                  <input
                    type="number"
                    value={qProtein}
                    onChange={(e) => setQProtein(e.target.value)}
                    placeholder="0g"
                    className="w-full px-2 py-2 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center focus:outline-none focus:border-blue-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-accent-bright mb-1">Carbs</label>
                  <input
                    type="number"
                    value={qCarbs}
                    onChange={(e) => setQCarbs(e.target.value)}
                    placeholder="0g"
                    className="w-full px-2 py-2 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center focus:outline-none focus:border-accent-bright/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-red-500 mb-1">Fat</label>
                  <input
                    type="number"
                    value={qFat}
                    onChange={(e) => setQFat(e.target.value)}
                    placeholder="0g"
                    className="w-full px-2 py-2 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center focus:outline-none focus:border-red-500/40"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={qSave}
                    onChange={(e) => setQSave(e.target.checked)}
                    className="w-4 h-4 rounded accent-accent-bright"
                  />
                  <span className="text-[12px] text-text-secondary">Save for later</span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowQuickAdd(false)}
                    className="text-[12px] px-3 py-1.5 text-text-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addQuickMeal}
                    disabled={!qName.trim() || qSubmitting}
                    className="text-[12px] px-4 py-1.5 rounded-xl bg-accent-bright text-black font-semibold disabled:opacity-40"
                  >
                    {qSubmitting ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Meal Cards */}
        {quickMeals.length > 0 ? (
          <div className="space-y-2">
            {quickMeals.map((qm) => {
              const isCompleted = qm.completed;
              const isLoading = toggling === qm.id;

              return (
                <div
                  key={qm.id}
                  className={`bg-bg-card/80 backdrop-blur-sm border rounded-2xl p-4 transition-all ${
                    isCompleted
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleQuickMeal(qm)}
                      disabled={isLoading}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isCompleted
                          ? "bg-green-500 border-green-500"
                          : "border-[rgba(0,0,0,0.15)] dark:border-[rgba(255,255,255,0.15)] hover:border-accent-bright"
                      } ${isLoading ? "opacity-50" : ""}`}
                    >
                      {isCompleted && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold text-[14px] ${isCompleted ? "text-green-600 dark:text-green-400" : "text-text-primary"}`}>
                        {qm.name}
                      </h3>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-[13px] text-text-secondary font-medium">{Number(qm.calories)} kcal</span>
                        <span className="text-[13px] text-blue-500">{Number(qm.protein_g)}g P</span>
                        <span className="text-[13px] text-accent-bright">{Number(qm.carbs_g)}g C</span>
                        <span className="text-[13px] text-red-500">{Number(qm.fat_g)}g F</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteQuickMeal(qm.id)}
                      className="p-1.5 text-text-secondary/30 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          !showQuickAdd && (
            <div className="text-center py-6 text-[13px] text-text-secondary/60">
              No extra meals tracked. Tap Quick Add to log something.
            </div>
          )
        )}
      </div>

      {/* Reset Day */}
      <div className="mt-6 text-center">
        <button
          onClick={resetDay}
          className="text-[13px] px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-red-400 hover:border-red-400/30 transition-colors"
        >
          Reset Day
        </button>
      </div>
    </div>
  );
}
