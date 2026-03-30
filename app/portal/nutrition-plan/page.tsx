"use client";

import { useEffect, useState, useCallback } from "react";
import MacroDonutChart from "@/components/portal/MacroDonutChart";
import type { ClientNutritionPlan, MealTracking, NutritionMeal, NutritionMealItem, QuickMeal, ClientSavedMeal, Food } from "@/lib/types";

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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

const FOOD_CATEGORIES = ["protein", "dairy", "grains", "fruit", "vegetables", "fats", "carbs", "snacks", "drinks", "supplements"];

export default function PortalNutritionPlanPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [plan, setPlan] = useState<ClientNutritionPlan | null>(null);
  const [tracking, setTracking] = useState<MealTracking[]>([]);
  const [quickMeals, setQuickMeals] = useState<QuickMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [savedMeals, setSavedMeals] = useState<ClientSavedMeal[]>([]);

  // Food browser state
  const [showFoodBrowser, setShowFoodBrowser] = useState(false);
  const [foods, setFoods] = useState<Food[]>([]);
  const [foodSearch, setFoodSearch] = useState("");
  const [foodCategory, setFoodCategory] = useState("");
  const [foodsLoading, setFoodsLoading] = useState(false);

  // Quick add form (manual entry)
  const [showManualAdd, setShowManualAdd] = useState(false);
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

  // Fetch foods when browser opens or search/category changes
  useEffect(() => {
    if (!showFoodBrowser) return;
    setFoodsLoading(true);
    const params = new URLSearchParams();
    if (foodSearch.trim()) params.set("search", foodSearch.trim());
    if (foodCategory) params.set("category", foodCategory);
    const timeout = setTimeout(() => {
      fetch(`/api/portal/foods?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => setFoods(d.foods || []))
        .catch(console.error)
        .finally(() => setFoodsLoading(false));
    }, foodSearch ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [showFoodBrowser, foodSearch, foodCategory]);

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

  // Add a food from the library as a quick meal (one tap)
  const addFoodAsMeal = async (food: Food) => {
    try {
      const res = await fetch("/api/portal/quick-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: food.name,
          calories: food.calories,
          protein_g: food.protein_g,
          carbs_g: food.carbs_g,
          fat_g: food.fat_g,
          date: dateStr,
          saveAsPreset: false,
        }),
      });
      const data = await res.json();
      if (data.quickMeal) {
        setQuickMeals((prev) => [...prev, data.quickMeal]);
      }
    } catch (err) {
      console.error("Failed to add food:", err);
    }
  };

  // Add from saved meal preset
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

  const addManualMeal = async () => {
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
        setQName(""); setQCalories(""); setQProtein(""); setQCarbs(""); setQFat(""); setQSave(false);
        setShowManualAdd(false);
        if (qSave) {
          fetch(`/api/portal/quick-meals?date=${dateStr}`)
            .then((r) => r.json())
            .then((d) => setSavedMeals(d.savedMeals || []));
        }
      }
    } catch (err) {
      console.error("Failed to add meal:", err);
    } finally {
      setQSubmitting(false);
    }
  };

  const resetDay = async () => {
    if (plan) {
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

  // Calculate consumed macros from completed assigned meals
  let consumedCalories = 0, consumedProtein = 0, consumedCarbs = 0, consumedFat = 0;
  if (plan) {
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
  const totalMeals = (plan?.meals.length || 0) + quickMeals.length;
  const totalCompleted = assignedCompleted + quickCompleted;

  const targetCalories = plan?.target_calories || 2000;
  const targetProtein = plan?.target_protein_g || 150;
  const targetCarbs = plan?.target_carbs_g || 200;
  const targetFat = plan?.target_fat_g || 65;

  return (
    <div className="p-6 max-w-lg mx-auto">
      {/* Date Navigator */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateDate(-1)}
          className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer"
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
            <button onClick={() => setSelectedDate(new Date())} className="text-[12px] text-accent-bright hover:underline mt-0.5 cursor-pointer">
              Back to today
            </button>
          )}
          {isToday(selectedDate) && (
            <p className="text-[12px] text-text-secondary mt-0.5">{formatDateDisplay(selectedDate)}</p>
          )}
        </div>
        <button
          onClick={() => navigateDate(1)}
          className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Macro Chart - always visible */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl p-6 mb-6">
        <MacroDonutChart
          targetCalories={targetCalories}
          consumedCalories={consumedCalories}
          protein={{ target: targetProtein, consumed: consumedProtein }}
          carbs={{ target: targetCarbs, consumed: consumedCarbs }}
          fat={{ target: targetFat, consumed: consumedFat }}
        />
        {totalMeals > 0 && (
          <div className="text-center mt-4">
            <span className="text-[13px] text-text-secondary">
              {totalCompleted} of {totalMeals} meals completed
            </span>
          </div>
        )}
      </div>

      {/* Coach's Assigned Meals */}
      {plan && plan.meals.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[14px] font-semibold text-text-secondary uppercase tracking-wider mb-3">Your Plan</h2>
          <div className="space-y-3">
            {plan.meals.map((meal) => {
              const isCompleted = tracking.find((t) => t.meal_id === meal.id)?.completed || false;
              const isLoading = toggling === meal.id;
              const macros = calcMealMacros(meal);

              return (
                <div
                  key={meal.id}
                  onClick={() => !isLoading && toggleMeal(meal.id)}
                  className={`bg-bg-card/80 backdrop-blur-sm border rounded-2xl overflow-hidden transition-all cursor-pointer active:scale-[0.98] ${
                    isCompleted
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)]"
                  }`}
                >
                  <div className="flex items-center gap-3 p-4">
                    <div
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isCompleted
                          ? "bg-green-500 border-green-500"
                          : "border-[rgba(0,0,0,0.15)] dark:border-[rgba(255,255,255,0.15)]"
                      } ${isLoading ? "opacity-50" : ""}`}
                    >
                      {isCompleted && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
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

                  {/* Food items preview */}
                  <div className="border-t border-[rgba(0,0,0,0.04)] dark:border-[rgba(255,255,255,0.04)]">
                    {meal.items.map((item: NutritionMealItem) => {
                      const food = item.food;
                      if (!food) return null;
                      const qty = Number(item.quantity) || 1;
                      return (
                        <div key={item.id} className="px-4 py-2 flex items-center justify-between border-b border-[rgba(0,0,0,0.02)] dark:border-[rgba(255,255,255,0.02)] last:border-0">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {food.photo_url && (
                              <img src={food.photo_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
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
        </div>
      )}

      {/* My Tracked Meals (quick meals) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-text-secondary uppercase tracking-wider">Tracked Meals</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowFoodBrowser(true); setShowManualAdd(false); }}
              className="text-[12px] px-3 py-1.5 rounded-xl bg-accent-bright text-black font-semibold cursor-pointer"
            >
              + Add Food
            </button>
          </div>
        </div>

        {/* Quick Meal Cards */}
        {quickMeals.length > 0 && (
          <div className="space-y-2 mb-3">
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
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
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
                      className="p-1.5 text-text-secondary/30 hover:text-red-400 transition-colors cursor-pointer"
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
        )}

        {quickMeals.length === 0 && !plan && (
          <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl p-8 text-center mb-3">
            <svg className="w-12 h-12 mx-auto mb-3 text-text-secondary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 9.75l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-text-secondary">Start tracking your meals</p>
            <p className="text-text-secondary/60 text-[13px] mt-1">Tap &quot;+ Add Food&quot; to log what you eat</p>
          </div>
        )}
      </div>

      {/* Food Browser Modal */}
      {showFoodBrowser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={() => setShowFoodBrowser(false)}>
          <div
            className="bg-bg-card border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-text-primary">Add Food</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowFoodBrowser(false); setShowManualAdd(true); }}
                    className="text-[12px] px-3 py-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-text-primary cursor-pointer"
                  >
                    Manual Entry
                  </button>
                  <button onClick={() => setShowFoodBrowser(false)} className="p-1.5 text-text-secondary hover:text-text-primary cursor-pointer">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Search + Category */}
              <input
                type="text"
                placeholder="Search foods..."
                value={foodSearch}
                onChange={(e) => setFoodSearch(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-bright/40 mb-2"
              />
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setFoodCategory("")}
                  className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap cursor-pointer ${
                    !foodCategory ? "bg-accent-bright text-black font-semibold" : "bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)] text-text-secondary"
                  }`}
                >
                  All
                </button>
                {FOOD_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFoodCategory(foodCategory === cat ? "" : cat)}
                    className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap capitalize cursor-pointer ${
                      foodCategory === cat ? "bg-accent-bright text-black font-semibold" : "bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)] text-text-secondary"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Saved Meals Section */}
              {savedMeals.length > 0 && !foodSearch && !foodCategory && (
                <div className="mt-3 pt-3 border-t border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)]">
                  <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Saved Meals</p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {savedMeals.map((saved) => (
                      <button
                        key={saved.id}
                        onClick={() => addFromSaved(saved)}
                        className="flex-shrink-0 px-3 py-2 rounded-xl bg-accent-bright/10 border border-accent-bright/20 text-left cursor-pointer hover:bg-accent-bright/20 transition-colors"
                      >
                        <span className="text-[12px] font-medium text-text-primary block">{saved.name}</span>
                        <span className="text-[11px] text-text-secondary">{Number(saved.calories)} kcal</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Food List */}
            <div className="flex-1 overflow-y-auto p-2">
              {foodsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-accent-bright border-t-transparent rounded-full animate-spin" />
                </div>
              ) : foods.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-text-secondary text-[13px]">No foods found</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {foods.map((food) => (
                    <button
                      key={food.id}
                      onClick={() => addFoodAsMeal(food)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.03)] transition-colors text-left cursor-pointer active:scale-[0.98]"
                    >
                      {food.photo_url ? (
                        <img src={food.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)] flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-text-secondary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-medium text-text-primary block truncate">{food.name}</span>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-[12px] text-text-secondary font-medium">{food.calories} kcal</span>
                          <span className="text-[12px] text-blue-500">{food.protein_g}g P</span>
                          <span className="text-[12px] text-accent-bright">{food.carbs_g}g C</span>
                          <span className="text-[12px] text-red-500">{food.fat_g}g F</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-bright/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-accent-bright" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowManualAdd(false)}>
          <div className="bg-bg-card border border-[rgba(0,0,0,0.08)] rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">Log a Meal</h3>
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
                  <input type="number" value={qCalories} onChange={(e) => setQCalories(e.target.value)} placeholder="0"
                    className="w-full px-2 py-2 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center focus:outline-none focus:border-accent-bright/40" />
                </div>
                <div>
                  <label className="block text-[11px] text-blue-500 mb-1">Protein</label>
                  <input type="number" value={qProtein} onChange={(e) => setQProtein(e.target.value)} placeholder="0g"
                    className="w-full px-2 py-2 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center focus:outline-none focus:border-blue-500/40" />
                </div>
                <div>
                  <label className="block text-[11px] text-accent-bright mb-1">Carbs</label>
                  <input type="number" value={qCarbs} onChange={(e) => setQCarbs(e.target.value)} placeholder="0g"
                    className="w-full px-2 py-2 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center focus:outline-none focus:border-accent-bright/40" />
                </div>
                <div>
                  <label className="block text-[11px] text-red-500 mb-1">Fat</label>
                  <input type="number" value={qFat} onChange={(e) => setQFat(e.target.value)} placeholder="0g"
                    className="w-full px-2 py-2 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center focus:outline-none focus:border-red-500/40" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={qSave} onChange={(e) => setQSave(e.target.checked)} className="w-4 h-4 rounded accent-accent-bright" />
                <span className="text-[12px] text-text-secondary">Save for later</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowManualAdd(false)} className="flex-1 py-2.5 text-[13px] text-text-secondary cursor-pointer">Cancel</button>
                <button
                  onClick={addManualMeal}
                  disabled={!qName.trim() || qSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-accent-bright text-black font-semibold text-[13px] disabled:opacity-40 cursor-pointer"
                >
                  {qSubmitting ? "Adding..." : "Add Meal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Day */}
      {(totalMeals > 0) && (
        <div className="text-center">
          <button
            onClick={resetDay}
            className="text-[13px] px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-red-400 hover:border-red-400/30 transition-colors cursor-pointer"
          >
            Reset Day
          </button>
        </div>
      )}
    </div>
  );
}
