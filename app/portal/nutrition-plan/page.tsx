"use client";

import { useEffect, useRef, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import MacroDonutChart from "@/components/portal/MacroDonutChart";
import { useToast } from "@/components/ui/Toast";
import type { ClientNutritionPlan, MealTracking, NutritionMeal, NutritionMealItem, QuickMeal, ClientSavedMeal, Food } from "@/lib/types";

function parseGrams(servingSize: string): number {
  const match = servingSize.match(/~?(\d+)\s*g/i);
  if (match) return parseInt(match[1], 10);
  const mlMatch = servingSize.match(/~?(\d+)\s*ml/i);
  if (mlMatch) return parseInt(mlMatch[1], 10);
  return 100;
}

function calcMealMacros(meal: NutritionMeal) {
  let calories = 0, protein = 0, carbs = 0, fat = 0, fibre = 0, sugar = 0;
  for (const item of meal.items) {
    const food = item.food;
    if (!food) continue;
    const qty = Number(item.quantity) || 1;
    calories += Math.round(food.calories * qty);
    protein += food.protein_g * qty;
    carbs += food.carbs_g * qty;
    fat += food.fat_g * qty;
    fibre += (food.fibre_g || 0) * qty;
    sugar += (food.sugar_g || 0) * qty;
  }
  return { calories, protein, carbs, fat, fibre, sugar };
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

function isWholeDayTotals(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === "myfitnesspal totals" || normalized === "daily totals (manual)";
}

interface AssignedMealsProps {
  plan: ClientNutritionPlan;
  tracking: MealTracking[];
  toggling: string | null;
  onToggle: (mealId: string) => void;
}

function AssignedMeals({ plan, tracking, toggling, onToggle }: AssignedMealsProps) {
  if (plan.meals.length === 0) return null;

  return (
    <details open className="app-card-quiet mb-6 rounded-[28px]">
      <summary className="cursor-pointer px-5 py-4">
        <span className="block text-[14px] font-semibold uppercase tracking-wider text-text-secondary">{plan.name}</span>
        <span className="mt-1 block text-[11px] text-text-muted">Your assigned meals from Gordy. Tick each one as you complete it.</span>
      </summary>
      <div className="space-y-3 border-t border-[rgba(0,0,0,0.06)] px-4 pb-4 pt-3">
        {plan.meals.map((meal) => {
          const isCompleted = tracking.find((item) => item.meal_id === meal.id)?.completed || false;
          const isLoading = toggling === meal.id;
          const macros = calcMealMacros(meal);

          return (
            <div
              key={meal.id}
              className={`overflow-hidden rounded-2xl border bg-bg-primary transition-all ${
                isCompleted
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)]"
              }`}
            >
              <div className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <h3 className={`font-semibold ${isCompleted ? "text-green-600 dark:text-green-400" : "text-text-primary"}`}>
                    {meal.name}
                  </h3>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="text-[13px] font-medium text-text-secondary">{macros.calories} kcal</span>
                    <span className="text-[13px] text-blue-500">{Math.round(macros.protein)}g P</span>
                    <span className="text-[13px] text-[#B830A8]">{Math.round(macros.carbs)}g C</span>
                    <span className="text-[13px] text-red-500">{Math.round(macros.fat)}g F</span>
                    <span className="text-[13px] text-emerald-500">{Math.round(macros.fibre)}g fibre</span>
                    <span className="text-[13px] text-amber-500">{Math.round(macros.sugar)}g sugar</span>
                  </div>
                </div>
                <button
                  onClick={() => !isLoading && onToggle(meal.id)}
                  disabled={isLoading}
                  aria-label={isCompleted ? `Mark ${meal.name} incomplete` : `Mark ${meal.name} complete`}
                  className={`flex flex-shrink-0 items-center gap-2 rounded-xl border px-3 py-2 transition-all ${
                    isCompleted
                      ? "border-green-500/30 bg-green-500/15 text-green-600 dark:text-green-400"
                      : "border-[rgba(0,0,0,0.12)] text-text-secondary hover:border-green-500/40 hover:text-green-600"
                  } ${isLoading ? "opacity-50" : ""}`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                    isCompleted ? "border-green-500 bg-green-500" : "border-current"
                  }`}>
                    {isCompleted && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="whitespace-nowrap text-xs font-semibold">{isCompleted ? "Eaten" : "I ate this"}</span>
                </button>
              </div>

              {meal.items.length > 0 && (
                <div className="border-t border-[rgba(0,0,0,0.04)]">
                  {meal.items.map((item: NutritionMealItem) => {
                    const food = item.food;
                    if (!food) return null;
                    const quantity = Number(item.quantity) || 1;
                    return (
                      <div key={item.id} className="flex items-center justify-between border-b border-[rgba(0,0,0,0.02)] px-4 py-2 last:border-0">
                        <div className="min-w-0 flex-1">
                          <span className={`text-[13px] ${isCompleted ? "text-text-secondary line-through" : "text-text-primary"}`}>
                            {food.name}
                          </span>
                          <span className="ml-2 text-[13px] text-text-secondary/60">
                            {Math.round(parseGrams(food.serving_size) * quantity)}g
                          </span>
                        </div>
                        <span className="ml-2 flex-shrink-0 text-[13px] text-text-secondary">
                          {Math.round(food.calories * quantity)} kcal
                        </span>
                        <span className="ml-2 hidden flex-shrink-0 text-[12px] text-text-secondary sm:inline">
                          {Math.round((food.fibre_g || 0) * quantity)}g fibre / {Math.round((food.sugar_g || 0) * quantity)}g sugar
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {meal.notes && (
                <div className="border-t border-[#E040D0]/10 bg-[#E040D0]/6 px-4 py-2 text-[13px] italic text-[#E040D0]">
                  {meal.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

const FOOD_CATEGORIES = ["protein", "dairy", "grains", "fruit", "vegetables", "fats", "carbs", "snacks", "drinks", "supplements"];
const ADDED_FEEDBACK_MS = 1800;

function vibrateOnAdd() {
  if (typeof navigator !== "undefined") {
    navigator.vibrate?.(10);
  }
}

function scheduleAddedStateClear(
  setState: Dispatch<SetStateAction<Record<string, number>>>,
  id: string,
  token: number,
) {
  setTimeout(() => {
    setState((prev) => {
      if (prev[id] !== token) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, ADDED_FEEDBACK_MS);
}

export default function PortalNutritionPlanPage() {
  const { toast } = useToast();
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

  const [addingFoodId, setAddingFoodId] = useState<string | null>(null);
  const [addedFoodIds, setAddedFoodIds] = useState<Record<string, number>>({});
  const [addingSavedMealId, setAddingSavedMealId] = useState<string | null>(null);
  const [addedSavedMealIds, setAddedSavedMealIds] = useState<Record<string, number>>({});
  const addingFoodIdRef = useRef<string | null>(null);
  const addingSavedMealIdRef = useRef<string | null>(null);

  // Quick add form (manual entry)
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [qName, setQName] = useState("");
  const [qCalories, setQCalories] = useState("");
  const [qProtein, setQProtein] = useState("");
  const [qCarbs, setQCarbs] = useState("");
  const [qFat, setQFat] = useState("");
  const [qFibre, setQFibre] = useState("");
  const [qSugar, setQSugar] = useState("");
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
        setQuickMeals(quickData.quickMeals || planData.quickMeals || []);
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

  const toggleQuickMeal = async (qm: QuickMeal) => {
    setToggling(qm.id);
    try {
      const res = await fetch("/api/portal/quick-meals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: qm.id, completed: !qm.completed }),
      });
      if (!res.ok) {
        toast("Couldn't update that meal. Try again in a moment.", "error");
        return;
      }
      const data = await res.json();
      if (data.quickMeal) {
        setQuickMeals((prev) => prev.map((m) => (m.id === qm.id ? data.quickMeal : m)));
      }
    } catch (err) {
      console.error("Failed to toggle quick meal:", err);
      toast("Couldn't update that meal. Check your connection.", "error");
    } finally {
      setToggling(null);
    }
  };

  const deleteQuickMeal = async (id: string) => {
    try {
      const res = await fetch("/api/portal/quick-meals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: "quick" }),
      });
      if (!res.ok) {
        toast("Couldn't remove that meal. Try again in a moment.", "error");
        return;
      }
      setQuickMeals((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Failed to delete quick meal:", err);
      toast("Couldn't remove that meal. Check your connection.", "error");
    }
  };

  // Add a food from the library as a quick meal (one tap)
  const addFoodAsMeal = async (food: Food) => {
    if (addingFoodIdRef.current === food.id) {
      toast(`Adding ${food.name}...`, "info");
      return;
    }
    addingFoodIdRef.current = food.id;
    setAddingFoodId(food.id);
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
          fibre_g: food.fibre_g || 0,
          sugar_g: food.sugar_g || 0,
          date: dateStr,
          saveAsPreset: false,
        }),
      });
      if (!res.ok) {
        toast("Couldn't add that food. Try again.", "error");
        return;
      }
      const data = await res.json();
      if (data.quickMeal) {
        setQuickMeals((prev) => [...prev, data.quickMeal]);
        const token = Date.now();
        setAddedFoodIds((prev) => ({ ...prev, [food.id]: token }));
        scheduleAddedStateClear(setAddedFoodIds, food.id, token);
        vibrateOnAdd();
        toast(`Added ${food.name}`, "success");
      }
    } catch (err) {
      console.error("Failed to add food:", err);
      toast("Couldn't add that food. Check your connection.", "error");
    } finally {
      if (addingFoodIdRef.current === food.id) {
        addingFoodIdRef.current = null;
      }
      setAddingFoodId((current) => (current === food.id ? null : current));
    }
  };

  // Add from saved meal preset
  const addFromSaved = async (saved: ClientSavedMeal) => {
    if (addingSavedMealIdRef.current === saved.id) {
      toast(`Adding ${saved.name}...`, "info");
      return;
    }
    addingSavedMealIdRef.current = saved.id;
    setAddingSavedMealId(saved.id);
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
          fibre_g: saved.fibre_g || 0,
          sugar_g: saved.sugar_g || 0,
          date: dateStr,
          saveAsPreset: false,
        }),
      });
      if (!res.ok) {
        toast("Couldn't add that saved meal. Try again.", "error");
        return;
      }
      const data = await res.json();
      if (data.quickMeal) {
        setQuickMeals((prev) => [...prev, data.quickMeal]);
        const token = Date.now();
        setAddedSavedMealIds((prev) => ({ ...prev, [saved.id]: token }));
        scheduleAddedStateClear(setAddedSavedMealIds, saved.id, token);
        vibrateOnAdd();
        toast(`Added ${saved.name}`, "success");
      }
    } catch (err) {
      console.error("Failed to add from saved:", err);
      toast("Couldn't add that saved meal. Check your connection.", "error");
    } finally {
      if (addingSavedMealIdRef.current === saved.id) {
        addingSavedMealIdRef.current = null;
      }
      setAddingSavedMealId((current) => (current === saved.id ? null : current));
    }
  };

  const deleteSavedMeal = async (id: string) => {
    try {
      const res = await fetch("/api/portal/quick-meals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: "saved" }),
      });
      if (!res.ok) {
        toast("Couldn't remove that preset. Try again in a moment.", "error");
        return;
      }
      setSavedMeals((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Failed to delete saved meal:", err);
      toast("Couldn't remove that preset. Check your connection.", "error");
    }
  };

  const addManualMeal = async () => {
    if (!qName.trim()) return;
    setQSubmitting(true);
    try {
      const isDailyTotals = isWholeDayTotals(qName);
      const existingDailyTotals = isDailyTotals
        ? quickMeals.filter((meal) => isWholeDayTotals(meal.name))
        : [];
      const res = await fetch("/api/portal/quick-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: qName.trim(),
          calories: Number(qCalories) || 0,
          protein_g: Number(qProtein) || 0,
          carbs_g: Number(qCarbs) || 0,
          fat_g: Number(qFat) || 0,
          fibre_g: Number(qFibre) || 0,
          sugar_g: Number(qSugar) || 0,
          date: dateStr,
          saveAsPreset: qSave,
        }),
      });
      if (!res.ok) {
        toast("Couldn't add that meal. Try again.", "error");
        return;
      }
      const data = await res.json();
      if (data.quickMeal) {
        const deletedIds: string[] = [];
        for (const meal of existingDailyTotals) {
          const deleteRes = await fetch("/api/portal/quick-meals", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: meal.id, type: "quick" }),
          });
          if (deleteRes.ok) {
            deletedIds.push(meal.id);
          } else {
            toast("New daily totals saved, but the old total could not be removed. Refresh and remove the duplicate if needed.", "error");
          }
        }
        setQuickMeals((prev) => [...prev.filter((meal) => !deletedIds.includes(meal.id)), data.quickMeal]);
        setQName(""); setQCalories(""); setQProtein(""); setQCarbs(""); setQFat(""); setQFibre(""); setQSugar(""); setQSave(false);
        setShowManualAdd(false);
        vibrateOnAdd();
        toast(`Added ${data.quickMeal.name}`, "success");
        if (qSave) {
          fetch(`/api/portal/quick-meals?date=${dateStr}`)
            .then((r) => r.json())
            .then((d) => setSavedMeals(d.savedMeals || []))
            .catch(() => toast("Meal added, but preset list didn't refresh. Reload to see it.", "error"));
        }
      }
    } catch (err) {
      console.error("Failed to add meal:", err);
      toast("Couldn't add that meal. Check your connection.", "error");
    } finally {
      setQSubmitting(false);
    }
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
      if (!res.ok) {
        toast("Couldn't update that meal. Try again in a moment.", "error");
        return;
      }
      const data = await res.json();
      if (data.tracking) {
        setTracking((prev) => {
          const filtered = prev.filter((t) => t.meal_id !== mealId);
          return [...filtered, data.tracking];
        });
      }
    } catch (err) {
      console.error("Failed to toggle meal:", err);
      toast("Couldn't update that meal. Check your connection.", "error");
    } finally {
      setToggling(null);
    }
  };

  const resetDay = async () => {
    let failed = 0;
    if (plan) {
      for (const meal of plan.meals) {
        const isCompleted = tracking.find((t) => t.meal_id === meal.id)?.completed;
        if (isCompleted) {
          try {
            const res = await fetch("/api/portal/meal-tracking", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ meal_id: meal.id, completed: false, date: dateStr }),
            });
            if (!res.ok) failed += 1;
          } catch { failed += 1; }
        }
      }
    }
    for (const qm of quickMeals) {
      if (qm.completed) {
        try {
          const res = await fetch("/api/portal/quick-meals", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: qm.id, completed: false }),
          });
          if (!res.ok) failed += 1;
        } catch { failed += 1; }
      }
    }
    if (failed > 0) {
      toast(`Some meals didn't reset (${failed}). Try again in a moment.`, "error");
    }
    fetchData();
  };

  const openDailyTotals = () => {
    setQName("Daily totals (manual)");
    setQCalories("");
    setQProtein("");
    setQCarbs("");
    setQFat("");
    setQFibre("");
    setQSugar("");
    setQSave(false);
    setShowManualAdd(true);
    setShowFoodBrowser(false);
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

  // A whole-day manual total replaces assigned-meal completion macros for that
  // date so the same intake is not counted twice. Legacy MFP entries remain valid.
  let consumedCalories = 0, consumedProtein = 0, consumedCarbs = 0, consumedFat = 0, consumedFibre = 0, consumedSugar = 0;
  const hasCompletedDailyTotals = quickMeals.some(
    (meal) => meal.completed && isWholeDayTotals(meal.name),
  );
  for (const qm of quickMeals) {
    if (qm.completed) {
      consumedCalories += Number(qm.calories);
      consumedProtein += Number(qm.protein_g);
      consumedCarbs += Number(qm.carbs_g);
      consumedFat += Number(qm.fat_g);
      consumedFibre += Number(qm.fibre_g || 0);
      consumedSugar += Number(qm.sugar_g || 0);
    }
  }
  if (!hasCompletedDailyTotals && plan?.meals.length) {
    for (const meal of plan.meals) {
      const completed = tracking.some((t) => t.meal_id === meal.id && t.completed);
      if (!completed) continue;
      const macros = calcMealMacros(meal);
      consumedCalories += macros.calories;
      consumedProtein += macros.protein;
      consumedCarbs += macros.carbs;
      consumedFat += macros.fat;
      consumedFibre += macros.fibre;
      consumedSugar += macros.sugar;
    }
  }

  const hasResettableEntries = quickMeals.some((meal) => meal.completed) || tracking.some((t) => t.completed);

  const hasAnyTargets = Boolean(plan?.target_calories || plan?.target_protein_g || plan?.target_carbs_g || plan?.target_fat_g || plan?.target_fibre_g || plan?.target_sugar_g);
  const hasCompleteTargets = Boolean(plan?.target_calories && plan?.target_protein_g && plan?.target_carbs_g && plan?.target_fat_g);
  const targetCalories = plan?.target_calories || 0;
  const targetProtein = plan?.target_protein_g || 0;
  const targetCarbs = plan?.target_carbs_g || 0;
  const targetFat = plan?.target_fat_g || 0;
  const targetFibre = plan?.target_fibre_g || 0;
  const targetSugar = plan?.target_sugar_g || 0;
  const entryHeading = isToday(selectedDate) ? "Today's manual entries" : `${formatDateDisplay(selectedDate)} manual entries`;

  return (
    <div className="px-0 pt-3 pb-20 sm:p-6 max-w-lg mx-auto">
      <div className="app-card-quiet app-rise app-rise-1 mb-6 rounded-3xl p-4">
        <nav className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-[#E040D0]/12 bg-[rgba(224,64,208,0.06)] p-1 text-[11px] font-bold uppercase tracking-[0.14em]" aria-label="Nutrition shortcuts">
          <Link href="/portal" className="rounded-xl bg-bg-card px-3 py-2 text-center text-[#B830A8] no-underline shadow-sm">
            Dashboard
          </Link>
          <Link href="/portal/ai" className="rounded-xl px-3 py-2 text-center text-text-secondary no-underline transition-colors hover:bg-bg-card hover:text-[#B830A8]">
            Ask About A Swap
          </Link>
        </nav>

        {/* Date Navigator */}
        <div className="flex items-center justify-between">
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
      </div>

      {plan && (
        <AssignedMeals plan={plan} tracking={tracking} toggling={toggling} onToggle={toggleMeal} />
      )}

      <section className="app-card app-rise app-rise-2 mb-6 overflow-hidden rounded-[28px]">
        <div className="border-b border-[#E040D0]/15 bg-[linear-gradient(135deg,rgba(224,64,208,0.16),rgba(245,158,11,0.06))] px-5 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#E040D0]">Targets dashboard</div>
          <p className="mt-1 text-sm text-text-secondary">
            Your assigned targets and today&apos;s logged intake. Connected app data syncs automatically when available.
          </p>
        </div>
        <div className="p-5">
          {hasCompleteTargets ? (
            <MacroDonutChart
              targetCalories={targetCalories}
              consumedCalories={consumedCalories}
              protein={{ target: targetProtein, consumed: consumedProtein }}
              carbs={{ target: targetCarbs, consumed: consumedCarbs }}
              fat={{ target: targetFat, consumed: consumedFat }}
            />
          ) : hasAnyTargets ? (
            <div className="rounded-2xl border border-[#E040D0]/15 bg-[#E040D0]/6 px-4 py-5">
              <p className="font-semibold text-text-primary">Targets set where available</p>
              <p className="mt-1 text-sm text-text-secondary">Only showing goals Gordy has actually set. No missing macros are estimated.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {plan?.target_calories && (
                  <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-card px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Calories</div>
                    <div className="text-lg font-heading font-bold text-text-primary">{targetCalories.toLocaleString()}</div>
                  </div>
                )}
                {plan?.target_protein_g && (
                  <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-card px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Protein</div>
                    <div className="text-lg font-heading font-bold text-blue-500">{Math.round(targetProtein)}g</div>
                  </div>
                )}
                {plan?.target_carbs_g && (
                  <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-card px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Carbs</div>
                    <div className="text-lg font-heading font-bold text-[#E040D0]">{Math.round(targetCarbs)}g</div>
                  </div>
                )}
                {plan?.target_fat_g && (
                  <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-card px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Fat</div>
                    <div className="text-lg font-heading font-bold text-red-500">{Math.round(targetFat)}g</div>
                  </div>
                )}
                {plan?.target_fibre_g && (
                  <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-card px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Fibre</div>
                    <div className="text-lg font-heading font-bold text-emerald-500">{Math.round(targetFibre)}g</div>
                  </div>
                )}
                {plan?.target_sugar_g && (
                  <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-bg-card px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">Sugar cap</div>
                    <div className="text-lg font-heading font-bold text-amber-500">{Math.round(targetSugar)}g</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E040D0]/20 bg-[#E040D0]/6 px-4 py-6 text-center">
              <p className="font-semibold text-text-primary">Nutrition targets pending</p>
              <p className="mt-1 text-sm text-text-secondary">You can still follow assigned meals or add an entry manually. Gordy can add targets later.</p>
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="app-inset rounded-2xl px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Calories</div>
              <div className="mt-1 text-xl font-heading font-bold text-text-primary">{Math.round(consumedCalories).toLocaleString()}</div>
              {plan?.target_calories ? <div className="text-xs text-text-secondary">of {targetCalories.toLocaleString()} kcal</div> : <div className="text-xs text-text-secondary">target not set</div>}
            </div>
            <div className="app-inset rounded-2xl px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Protein</div>
              <div className="mt-1 text-xl font-heading font-bold text-blue-500">{Math.round(consumedProtein)}g</div>
              {plan?.target_protein_g ? <div className="text-xs text-text-secondary">of {Math.round(targetProtein)}g</div> : <div className="text-xs text-text-secondary">target not set</div>}
            </div>
            <div className="app-inset rounded-2xl px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Fibre</div>
              <div className="mt-1 text-xl font-heading font-bold text-emerald-500">{Math.round(consumedFibre)}g</div>
              {plan?.target_fibre_g ? <div className="text-xs text-text-secondary">of {Math.round(targetFibre)}g</div> : <div className="text-xs text-text-secondary">target not set</div>}
            </div>
            <div className="app-inset rounded-2xl px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">Sugar</div>
              <div className="mt-1 text-xl font-heading font-bold text-amber-500">{Math.round(consumedSugar)}g</div>
              {plan?.target_sugar_g ? <div className="text-xs text-text-secondary">cap {Math.round(targetSugar)}g</div> : <div className="text-xs text-text-secondary">cap not set</div>}
            </div>
          </div>
          <button
            onClick={openDailyTotals}
            className="mt-5 w-full rounded-2xl gradient-accent px-4 py-3.5 text-sm font-bold text-white shadow-[0_16px_32px_rgba(224,64,208,0.22)]"
          >
            Add daily totals manually
          </button>
        </div>
      </section>


      {/* Manual entries remain available as a fallback or correction. */}
      <div className="mb-6">
        <div className="app-card-quiet mb-3 rounded-2xl px-4 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold text-text-secondary uppercase tracking-wider">{entryHeading}</h2>
            <p className="text-[11px] text-text-muted mt-0.5">Connected app totals sync automatically when available. Use this section for a manual entry or correction.</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={openDailyTotals}
              className="app-tap flex items-center justify-center gap-1.5 text-[13px] px-3 py-2.5 rounded-xl gradient-accent text-white font-semibold cursor-pointer shadow-[0_12px_26px_rgba(224,64,208,0.22)]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Meal
            </button>
            <button
              onClick={() => { setShowFoodBrowser(true); setShowManualAdd(false); }}
              className="app-tap flex items-center justify-center gap-1.5 text-[13px] px-3 py-2.5 rounded-xl border border-[#E040D0]/35 bg-[#E040D0]/12 text-[#F060E0] font-semibold cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Food
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
                  className={`rounded-2xl p-4 transition-all ${
                    isCompleted
                      ? "border border-green-500/35 bg-green-500/8 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
                      : "app-card-quiet"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleQuickMeal(qm)}
                      disabled={isLoading}
                      aria-label={isCompleted ? `Mark ${qm.name} incomplete` : `Mark ${qm.name} complete`}
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
                        <span className="text-[13px] text-emerald-500">{Number(qm.fibre_g || 0)}g fibre</span>
                        <span className="text-[13px] text-amber-500">{Number(qm.sugar_g || 0)}g sugar</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteQuickMeal(qm.id)}
                      aria-label={`Delete ${qm.name}`}
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

        {quickMeals.length === 0 && (
          <div className="app-card-quiet rounded-2xl p-8 text-center mb-3">
            <svg className="w-12 h-12 mx-auto mb-3 text-text-secondary/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 9.75l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-text-primary font-semibold">Nothing logged manually yet.</p>
            <p className="text-text-secondary/70 text-[13px] mt-1">Follow your assigned meals above, or add an entry when you need to correct or supplement synced data.</p>
          </div>
        )}
      </div>

      {/* Food Browser Modal */}
      {showFoodBrowser && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" onClick={() => setShowFoodBrowser(false)}>
          <div
            className="app-card rounded-t-[28px] sm:rounded-[28px] w-full sm:max-w-md max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
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
                    !foodCategory ? "gradient-accent text-white font-semibold" : "bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)] text-text-secondary"
                  }`}
                >
                  All
                </button>
                {FOOD_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFoodCategory(foodCategory === cat ? "" : cat)}
                    className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap capitalize cursor-pointer ${
                      foodCategory === cat ? "gradient-accent text-white font-semibold" : "bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.06)] text-text-secondary"
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
                    {savedMeals.map((saved) => {
                      const isAdding = addingSavedMealId === saved.id;
                      const wasAdded = Boolean(addedSavedMealIds[saved.id]);
                      return (
                      <div
                        key={saved.id}
                        className={`flex flex-shrink-0 items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                          wasAdded
                            ? "app-just-added border-emerald-500/40 bg-emerald-500/10"
                            : "border-accent-bright/20 bg-accent-bright/10"
                        }`}
                      >
                        <button
                          onClick={() => addFromSaved(saved)}
                          disabled={isAdding}
                          className="text-left cursor-pointer transition-colors hover:text-text-primary disabled:cursor-wait disabled:opacity-70"
                        >
                          <span className="text-[12px] font-medium text-text-primary block">{saved.name}</span>
                          <span className={`text-[11px] ${wasAdded ? "text-emerald-400" : "text-text-secondary"}`}>
                            {isAdding ? "Adding..." : wasAdded ? "Added" : `${Number(saved.calories)} kcal`}
                          </span>
                        </button>
                        <button
                          onClick={() => deleteSavedMeal(saved.id)}
                          aria-label={`Delete saved meal ${saved.name}`}
                          className="rounded-full p-1 text-text-secondary/50 transition-colors hover:text-red-400 cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      );
                    })}
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
                  {foods.map((food) => {
                    const isAdding = addingFoodId === food.id;
                    const wasAdded = Boolean(addedFoodIds[food.id]);
                    return (
                    <button
                      key={food.id}
                      onClick={() => addFoodAsMeal(food)}
                      disabled={isAdding}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 ${
                        wasAdded
                          ? "app-just-added border-emerald-500/40 bg-emerald-500/10"
                          : "border-transparent hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.04)]"
                      }`}
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
                          <span className="text-[12px] text-emerald-500">{food.fibre_g || 0}g fibre</span>
                          <span className="text-[12px] text-amber-500">{food.sugar_g || 0}g sugar</span>
                        </div>
                      </div>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${wasAdded ? "bg-emerald-500" : "bg-accent-bright/10"}`}>
                        {isAdding ? (
                          <svg className="w-4 h-4 text-accent-bright" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                          </svg>
                        ) : wasAdded ? (
                          <svg className="app-added-check w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-accent-bright" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </div>
                    </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualAdd && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm" onClick={() => setShowManualAdd(false)}>
          <div className="app-card max-h-[calc(100dvh-2rem-env(safe-area-inset-bottom,0px))] w-full max-w-sm overflow-y-auto rounded-[24px] p-5 sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-1">Add daily totals manually</h3>
            <p className="text-[12px] text-text-muted mb-4">Use this fallback when synced data is unavailable or needs correcting. Include fibre and sugar when available.</p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Entry name"
                value={qName}
                onChange={(e) => setQName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-bright/40"
              />
              <div className="grid grid-cols-3 gap-2">
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
                <div>
                  <label className="block text-[11px] text-emerald-500 mb-1">Fibre</label>
                  <input type="number" value={qFibre} onChange={(e) => setQFibre(e.target.value)} placeholder="0g"
                    className="w-full px-2 py-2 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center focus:outline-none focus:border-emerald-500/40" />
                </div>
                <div>
                  <label className="block text-[11px] text-amber-500 mb-1">Sugar</label>
                  <input type="number" value={qSugar} onChange={(e) => setQSugar(e.target.value)} placeholder="0g"
                    className="w-full px-2 py-2 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center focus:outline-none focus:border-amber-500/40" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={qSave} onChange={(e) => setQSave(e.target.checked)} className="w-4 h-4 rounded accent-accent-bright" />
                <span className="text-[12px] text-text-secondary">Save as a reusable preset</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowManualAdd(false)} className="flex-1 py-2.5 text-[13px] text-text-secondary cursor-pointer">Cancel</button>
                <button
                  onClick={addManualMeal}
                  disabled={!qName.trim() || qSubmitting}
                  className="flex-1 py-2.5 rounded-xl gradient-accent text-white font-semibold text-[13px] disabled:opacity-40 cursor-pointer"
                >
                  {qSubmitting ? "Adding..." : "Add Meal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Day */}
      {hasResettableEntries && (
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
