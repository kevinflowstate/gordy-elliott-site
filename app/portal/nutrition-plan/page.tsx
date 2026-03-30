"use client";

import { useEffect, useState, useCallback } from "react";
import MacroDonutChart from "@/components/portal/MacroDonutChart";
import type { ClientNutritionPlan, MealTracking, NutritionMeal, NutritionMealItem } from "@/lib/types";

// Calculate macros for a meal based on its food items and quantities
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

export default function PortalNutritionPlanPage() {
  const [plan, setPlan] = useState<ClientNutritionPlan | null>(null);
  const [tracking, setTracking] = useState<MealTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch("/api/portal/nutrition-plan")
      .then((r) => r.json())
      .then((data) => {
        setPlan(data.plan);
        setTracking(data.tracking || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleMeal = async (mealId: string) => {
    setToggling(mealId);
    const current = tracking.find((t) => t.meal_id === mealId);
    const newCompleted = !current?.completed;

    try {
      const res = await fetch("/api/portal/meal-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal_id: mealId, completed: newCompleted }),
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

  const resetDay = async () => {
    if (!plan) return;
    // Untick all meals
    for (const meal of plan.meals) {
      const isCompleted = tracking.find((t) => t.meal_id === meal.id)?.completed;
      if (isCompleted) {
        await fetch("/api/portal/meal-tracking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meal_id: meal.id, completed: false }),
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

  // Calculate consumed macros from completed meals
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

  const completedCount = tracking.filter((t) => t.completed).length;

  return (
    <div className="p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nutrition</h1>
          <p className="text-[13px] text-text-secondary mt-0.5">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          onClick={resetDay}
          className="text-[13px] px-3 py-1.5 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary hover:bg-[rgba(0,0,0,0.02)] dark:hover:bg-[rgba(255,255,255,0.02)] transition-colors"
        >
          Reset Day
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
            {completedCount} of {plan.meals.length} meals completed
          </span>
        </div>
      </div>

      {/* Meal Cards */}
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
                      <div className="flex-1 min-w-0">
                        <span className={`text-[13px] ${isCompleted ? "text-text-secondary line-through" : "text-text-primary"}`}>
                          {food.name}
                        </span>
                        <span className="text-[13px] text-text-secondary/60 ml-2">
                          {qty !== 1 ? `${qty}x ` : ""}{food.serving_size}
                        </span>
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

              {/* Coaching notes */}
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
  );
}
