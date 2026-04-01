"use client";

import { useState } from "react";
import FoodPicker from "./FoodPicker";
import MacroSummaryBar from "./MacroSummaryBar";
import type { NutritionTemplate, NutritionMeal, NutritionMealItem, Food, MealAlternative } from "@/lib/types";

interface SavedMeal {
  id: string;
  name: string;
  items: { food_id: string; food_name: string; quantity: number }[];
  created_at: string;
}

function parseGrams(servingSize: string): number {
  // Extract the number before 'g' from serving size strings
  // Handles: "150g", "30g scoop", "1 medium ~120g", "100g", "250ml", "1 tbsp ~15ml"
  const match = servingSize.match(/~?(\d+)\s*g/i);
  if (match) return parseInt(match[1], 10);
  // For ml-based items, treat as grams (close enough for tracking)
  const mlMatch = servingSize.match(/~?(\d+)\s*ml/i);
  if (mlMatch) return parseInt(mlMatch[1], 10);
  // For items like "2 large", "1 tablet" etc, use 100 as default
  return 100;
}

interface NutritionTemplateBuilderProps {
  template?: NutritionTemplate;
  onSave: (template: NutritionTemplate) => void;
  onCancel: () => void;
}

const CALORIE_RANGES = [
  { value: "low", label: "Low (<1500)" },
  { value: "moderate", label: "Moderate (1500-2200)" },
  { value: "high", label: "High (2200+)" },
  { value: "custom", label: "Custom" },
];

const QUICK_MEAL_NAMES = ["Pre-Workout", "Post-Workout", "Snack", "Supper", "Morning Snack", "Evening Snack"];

const DAY_PRESETS = [
  { label: "Standard (1 day)", days: [""] },
  { label: "Training / Rest (2 days)", days: ["Training Day", "Rest Day"] },
  { label: "High Carb / Low Carb (2 days)", days: ["High Carb", "Low Carb"] },
  { label: "High Carb / Moderate / Low Carb (3 days)", days: ["High Carb", "Moderate Carb", "Low Carb"] },
];

function detectDayVariations(meals: NutritionMeal[]): string[] {
  if (meals.length === 0) return [];
  // Check if any meal name contains " - " which indicates a day prefix
  const hasDayPrefix = meals.some((m) => m.name.includes(" - "));
  if (!hasDayPrefix) return [];
  // Extract unique day prefixes
  const prefixes = new Set<string>();
  for (const meal of meals) {
    const idx = meal.name.indexOf(" - ");
    if (idx > 0) {
      prefixes.add(meal.name.substring(0, idx));
    }
  }
  return Array.from(prefixes);
}

function calcMealMacros(meal: NutritionMeal) {
  let calories = 0, protein_g = 0, carbs_g = 0, fat_g = 0;
  for (const item of meal.items) {
    const food = item.food;
    if (!food) continue;
    const qty = Number(item.quantity) || 1;
    calories += food.calories * qty;
    protein_g += food.protein_g * qty;
    carbs_g += food.carbs_g * qty;
    fat_g += food.fat_g * qty;
  }
  return { calories, protein_g, carbs_g, fat_g };
}

function calcTotalMacros(meals: NutritionMeal[]) {
  let calories = 0, protein_g = 0, carbs_g = 0, fat_g = 0;
  for (const meal of meals) {
    const m = calcMealMacros(meal);
    calories += m.calories;
    protein_g += m.protein_g;
    carbs_g += m.carbs_g;
    fat_g += m.fat_g;
  }
  return { calories, protein_g, carbs_g, fat_g };
}

function getNextMealName(existingMeals: NutritionMeal[], dayPrefix: string): string {
  const baseMeals = ["Breakfast", "Lunch", "Dinner"];
  const extraMeals = ["Snack 1", "Snack 2", "Pre-Workout", "Post-Workout", "Morning Snack", "Evening Snack"];

  // Build list of existing names (strip prefix for comparison)
  const existingNames = new Set(
    existingMeals.map((m) => {
      const idx = m.name.indexOf(" - ");
      return idx > 0 ? m.name.substring(idx + 3) : m.name;
    })
  );

  // Try base meals first
  for (const base of baseMeals) {
    if (!existingNames.has(base)) {
      return dayPrefix ? `${dayPrefix} - ${base}` : base;
    }
  }

  // Then extra meals
  for (const extra of extraMeals) {
    if (!existingNames.has(extra)) {
      return dayPrefix ? `${dayPrefix} - ${extra}` : extra;
    }
  }

  // Fallback
  const n = existingMeals.length + 1;
  return dayPrefix ? `${dayPrefix} - Meal ${n}` : `Meal ${n}`;
}

export default function NutritionTemplateBuilder({ template, onSave, onCancel }: NutritionTemplateBuilderProps) {
  // Detect existing day variations if editing
  const existingDayVariations = template ? detectDayVariations(template.meals || []) : [];
  const isExistingMultiDay = existingDayVariations.length > 1;

  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [planType, setPlanType] = useState<'full' | 'macro_only'>(template?.plan_type || "full");
  const [calorieRange, setCalorieRange] = useState(template?.calorie_range || "moderate");
  const [targetCalories, setTargetCalories] = useState(template?.target_calories || 0);
  const [targetProtein, setTargetProtein] = useState(template?.target_protein_g || 0);
  const [targetCarbs, setTargetCarbs] = useState(template?.target_carbs_g || 0);
  const [targetFat, setTargetFat] = useState(template?.target_fat_g || 0);
  const [meals, setMeals] = useState<NutritionMeal[]>(
    template?.meals || [
      { id: crypto.randomUUID(), name: "Breakfast", order_index: 0, items: [] },
      { id: crypto.randomUUID(), name: "Lunch", order_index: 1, items: [] },
      { id: crypto.randomUUID(), name: "Dinner", order_index: 2, items: [] },
    ]
  );
  const [pickerMealId, setPickerMealId] = useState<string | null>(null);
  // pickerAltId: "mealId:altId" when adding food to an alternative
  const [pickerAltId, setPickerAltId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // alternatives: { [mealId]: MealAlternative[] }
  // We store alternatives in state separately, and store them into meal.notes as JSON on save
  // so they are persisted without DB schema changes
  const [mealAlternatives, setMealAlternatives] = useState<Record<string, MealAlternative[]>>(() => {
    const init: Record<string, MealAlternative[]> = {};
    for (const meal of template?.meals || []) {
      try {
        const parsed = meal.notes ? JSON.parse(meal.notes) : null;
        if (parsed?.__alternatives) {
          init[meal.id] = parsed.__alternatives;
        }
      } catch {
        // not JSON, plain notes
      }
    }
    return init;
  });
  const [activeMealAltIndex, setActiveMealAltIndex] = useState<Record<string, number>>({});

  function getMealAlts(mealId: string): MealAlternative[] {
    return mealAlternatives[mealId] || [];
  }

  function getActiveMealAltIdx(mealId: string): number {
    return activeMealAltIndex[mealId] ?? -1; // -1 = primary
  }

  function addAlternative(mealId: string) {
    const alts = getMealAlts(mealId);
    const newAlt: MealAlternative = {
      id: crypto.randomUUID(),
      name: `Option ${alts.length + 2}`,
      items: [],
    };
    setMealAlternatives((prev) => ({ ...prev, [mealId]: [...alts, newAlt] }));
    setActiveMealAltIndex((prev) => ({ ...prev, [mealId]: alts.length }));
  }

  function removeAlternative(mealId: string, altId: string) {
    const alts = getMealAlts(mealId).filter((a) => a.id !== altId);
    setMealAlternatives((prev) => ({ ...prev, [mealId]: alts }));
    setActiveMealAltIndex((prev) => ({ ...prev, [mealId]: -1 }));
  }

  function updateAlternativeName(mealId: string, altId: string, name: string) {
    setMealAlternatives((prev) => ({
      ...prev,
      [mealId]: (prev[mealId] || []).map((a) => a.id === altId ? { ...a, name } : a),
    }));
  }

  function addFoodToAlternative(mealId: string, altId: string, food: Food) {
    const newItem: NutritionMealItem = {
      id: crypto.randomUUID(),
      meal_id: mealId,
      food_id: food.id,
      food,
      quantity: 1,
      order_index: 0,
    };
    setMealAlternatives((prev) => ({
      ...prev,
      [mealId]: (prev[mealId] || []).map((a) =>
        a.id === altId
          ? { ...a, items: [...a.items, { ...newItem, order_index: a.items.length }] }
          : a
      ),
    }));
    setPickerAltId(null);
  }

  function removeFoodFromAlternative(mealId: string, altId: string, itemId: string) {
    setMealAlternatives((prev) => ({
      ...prev,
      [mealId]: (prev[mealId] || []).map((a) =>
        a.id === altId
          ? { ...a, items: a.items.filter((i) => i.id !== itemId).map((i, idx) => ({ ...i, order_index: idx })) }
          : a
      ),
    }));
  }

  function updateAltFoodQuantity(mealId: string, altId: string, itemId: string, quantity: number) {
    setMealAlternatives((prev) => ({
      ...prev,
      [mealId]: (prev[mealId] || []).map((a) =>
        a.id === altId
          ? { ...a, items: a.items.map((i) => i.id === itemId ? { ...i, quantity } : i) }
          : a
      ),
    }));
  }

  // Day variations state
  const [setupComplete, setSetupComplete] = useState(!!template); // true when editing existing
  const [dayVariations, setDayVariations] = useState<string[]>(
    isExistingMultiDay ? existingDayVariations : []
  );
  const [activeDay, setActiveDay] = useState(0);

  // Setup screen state
  const [setupDayCount, setSetupDayCount] = useState<number>(1);
  const [setupDayNames, setSetupDayNames] = useState<string[]>(["Day 1"]);

  // Meal name focus state for quick-name buttons
  const [focusedMealId, setFocusedMealId] = useState<string | null>(null);

  // Saved meals state
  const [savingMealId, setSavingMealId] = useState<string | null>(null);
  const [saveMealName, setSaveMealName] = useState("");
  const [saveMealConfirm, setSaveMealConfirm] = useState<string | null>(null); // mealId that just saved
  const [showLoadSaved, setShowLoadSaved] = useState(false);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // TDEE helper state
  const [showTdee, setShowTdee] = useState(false);
  const [weight, setWeight] = useState(70);
  const [goal, setGoal] = useState<"cut" | "maintain" | "bulk">("maintain");
  const [activityLevel, setActivityLevel] = useState<"sedentary" | "light" | "moderate" | "active" | "very_active">("moderate");

  const calcTdee = () => {
    // Simple BMR (Mifflin-St Jeor, male approximation - good enough for template default)
    const bmr = 10 * weight + 6.25 * 175 - 5 * 30 + 5;
    const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
    const tdee = Math.round(bmr * multipliers[activityLevel]);
    const goalAdjust = { cut: -500, maintain: 0, bulk: 300 };
    const cals = Math.round(tdee + goalAdjust[goal]);

    // Macro split: 30/40/30 for cut, 25/50/25 for maintain, 25/45/30 for bulk
    const splits = {
      cut: { p: 0.35, c: 0.35, f: 0.30 },
      maintain: { p: 0.30, c: 0.40, f: 0.30 },
      bulk: { p: 0.25, c: 0.45, f: 0.30 },
    };
    const split = splits[goal];

    setTargetCalories(cals);
    setTargetProtein(Math.round((cals * split.p) / 4));
    setTargetCarbs(Math.round((cals * split.c) / 4));
    setTargetFat(Math.round((cals * split.f) / 9));
    setShowTdee(false);
  };

  // Setup screen handlers
  const applyPreset = (preset: { label: string; days: string[] }) => {
    const count = preset.days.filter((d) => d !== "").length || 1;
    if (preset.days[0] === "") {
      // Single day / standard
      setSetupDayCount(1);
      setSetupDayNames([""]);
    } else {
      setSetupDayCount(count);
      setSetupDayNames([...preset.days]);
    }
  };

  const handleSetupDayCount = (count: number) => {
    setSetupDayCount(count);
    // Build default names
    const defaultNames = Array.from({ length: count }, (_, i) => `Day ${i + 1}`);
    setSetupDayNames(defaultNames);
  };

  const handleSetupComplete = () => {
    const isSingleDay = setupDayCount === 1 || setupDayNames.every((n) => n === "");
    if (isSingleDay) {
      // Single day - no prefixes
      setDayVariations([]);
      setMeals([
        { id: crypto.randomUUID(), name: "Breakfast", order_index: 0, items: [] },
        { id: crypto.randomUUID(), name: "Lunch", order_index: 1, items: [] },
        { id: crypto.randomUUID(), name: "Dinner", order_index: 2, items: [] },
      ]);
    } else {
      // Multi-day - create meals for each day
      setDayVariations(setupDayNames);
      const newMeals: NutritionMeal[] = [];
      let orderIdx = 0;
      for (const dayName of setupDayNames) {
        newMeals.push({ id: crypto.randomUUID(), name: `${dayName} - Breakfast`, order_index: orderIdx++, items: [] });
        newMeals.push({ id: crypto.randomUUID(), name: `${dayName} - Lunch`, order_index: orderIdx++, items: [] });
        newMeals.push({ id: crypto.randomUUID(), name: `${dayName} - Dinner`, order_index: orderIdx++, items: [] });
      }
      setMeals(newMeals);
    }
    setActiveDay(0);
    setSetupComplete(true);
  };

  // Determine the active day prefix for filtering
  const activeDayPrefix = dayVariations.length > 1 ? dayVariations[activeDay] : null;

  // Filter meals for the active day (or all if single day)
  const visibleMeals = activeDayPrefix
    ? meals.filter((m) => m.name.startsWith(activeDayPrefix + " - "))
    : meals;

  const addMeal = () => {
    const dayMeals = activeDayPrefix
      ? meals.filter((m) => m.name.startsWith(activeDayPrefix + " - "))
      : meals;
    const newName = getNextMealName(dayMeals, activeDayPrefix || "");
    setMeals([
      ...meals,
      {
        id: crypto.randomUUID(),
        name: newName,
        order_index: meals.length,
        items: [],
      },
    ]);
  };

  const removeMeal = (mealId: string) => {
    setMeals(meals.filter((m) => m.id !== mealId).map((m, i) => ({ ...m, order_index: i })));
  };

  const updateMealName = (mealId: string, newName: string) => {
    setMeals(meals.map((m) => (m.id === mealId ? { ...m, name: newName } : m)));
  };

  const addFoodToMeal = (mealId: string, food: Food) => {
    setMeals(
      meals.map((m) => {
        if (m.id !== mealId) return m;
        const newItem: NutritionMealItem = {
          id: crypto.randomUUID(),
          meal_id: mealId,
          food_id: food.id,
          food,
          quantity: 1,
          order_index: m.items.length,
        };
        return { ...m, items: [...m.items, newItem] };
      })
    );
    setPickerMealId(null);
  };

  const removeFoodFromMeal = (mealId: string, itemId: string) => {
    setMeals(
      meals.map((m) => {
        if (m.id !== mealId) return m;
        return { ...m, items: m.items.filter((i) => i.id !== itemId).map((i, idx) => ({ ...i, order_index: idx })) };
      })
    );
  };

  const updateFoodQuantity = (mealId: string, itemId: string, quantity: number) => {
    setMeals(
      meals.map((m) => {
        if (m.id !== mealId) return m;
        return { ...m, items: m.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)) };
      })
    );
  };

  const updateFoodNotes = (mealId: string, itemId: string, notes: string) => {
    setMeals(
      meals.map((m) => {
        if (m.id !== mealId) return m;
        return { ...m, items: m.items.map((i) => (i.id === itemId ? { ...i, notes } : i)) };
      })
    );
  };

  const handleSaveMeal = async (meal: NutritionMeal) => {
    const nameToSave = saveMealName.trim() || meal.name;
    const items = meal.items.map((item) => ({
      food_id: item.food_id,
      food_name: item.food?.name || "",
      quantity: item.quantity,
    }));
    try {
      await fetch("/api/admin/saved-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameToSave, items }),
      });
      setSavingMealId(null);
      setSaveMealName("");
      setSaveMealConfirm(meal.id);
      setTimeout(() => setSaveMealConfirm(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenLoadSaved = async () => {
    setShowLoadSaved(true);
    setLoadingSaved(true);
    try {
      const res = await fetch("/api/admin/saved-meals");
      const data = await res.json();
      setSavedMeals(data.saved_meals || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleLoadSavedMeal = async (saved: SavedMeal) => {
    setShowLoadSaved(false);
    // Fetch all foods to build a lookup map
    const res = await fetch("/api/admin/foods");
    const data = await res.json();
    const foodMap = new Map<string, Food>();
    for (const f of (data.foods || []) as Food[]) {
      foodMap.set(f.id, f);
    }

    const newItems: NutritionMealItem[] = [];
    for (const si of saved.items) {
      const food = foodMap.get(si.food_id);
      if (!food) continue; // skip deleted foods
      newItems.push({
        id: crypto.randomUUID(),
        meal_id: "",
        food_id: si.food_id,
        food,
        quantity: si.quantity,
        order_index: newItems.length,
      });
    }

    const newMealId = crypto.randomUUID();
    const mealName = activeDayPrefix ? `${activeDayPrefix} - ${saved.name}` : saved.name;
    const newMeal: NutritionMeal = {
      id: newMealId,
      name: mealName,
      order_index: meals.length,
      items: newItems.map((i) => ({ ...i, meal_id: newMealId })),
    };
    setMeals([...meals, newMeal]);
  };

  const handleDeleteSavedMeal = async (id: string) => {
    try {
      await fetch("/api/admin/saved-meals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setSavedMeals((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    // Serialize alternatives into meal notes as JSON metadata
    const mealsWithAlts = meals.map((meal) => {
      const alts = getMealAlts(meal.id);
      if (alts.length === 0) return meal;
      // Store alternatives in notes as JSON (preserving existing plain notes separately)
      const notesData = { __alternatives: alts, __plain_notes: meal.notes };
      return { ...meal, notes: JSON.stringify(notesData) };
    });
    const tpl: NutritionTemplate = {
      id: template?.id || crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      calorie_range: calorieRange,
      plan_type: planType,
      target_calories: targetCalories || undefined,
      target_protein_g: targetProtein || undefined,
      target_carbs_g: targetCarbs || undefined,
      target_fat_g: targetFat || undefined,
      is_active: true,
      meals: mealsWithAlts,
      created_at: template?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    onSave(tpl);
    setSaving(false);
  };

  const totals = calcTotalMacros(visibleMeals);
  const targets = targetCalories ? { calories: targetCalories, protein_g: targetProtein, carbs_g: targetCarbs, fat_g: targetFat } : null;

  // Setup screen
  if (!setupComplete) {
    return (
      <div className="fixed inset-0 z-40 flex">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
        <div className="relative ml-auto w-full max-w-3xl bg-bg-primary border-l border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] overflow-y-auto flex flex-col">
          <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary">New Nutrition Template</h2>
              <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary text-[13px]">
                Cancel
              </button>
            </div>
          </div>

          <div className="p-6 space-y-8 flex-1">
            <div>
              <h3 className="text-lg font-bold text-text-primary mb-1">Day Variations</h3>
              <p className="text-[13px] text-text-secondary mb-6">How many day types does this plan need?</p>

              {/* Day count selector */}
              <div className="flex gap-2 mb-6">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => handleSetupDayCount(n)}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-[13px] transition-colors ${
                      setupDayCount === n && setupDayNames[0] !== "" || (n === 1 && setupDayCount === 1 && setupDayNames[0] === "")
                        ? "bg-accent-bright text-black"
                        : "bg-bg-card border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {n} {n === 1 ? "Day" : "Days"}
                  </button>
                ))}
                <button
                  onClick={() => handleSetupDayCount(4)}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-[13px] transition-colors ${
                    setupDayCount >= 4
                      ? "bg-accent-bright text-black"
                      : "bg-bg-card border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Presets */}
              <div className="mb-6">
                <p className="text-[12px] text-text-secondary font-medium uppercase tracking-wide mb-3">Quick presets</p>
                <div className="space-y-2">
                  {DAY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => applyPreset(preset)}
                      className="w-full text-left px-4 py-3 rounded-xl bg-bg-card border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] hover:border-accent-bright/40 transition-colors group"
                    >
                      <span className="text-[13px] font-medium text-text-primary group-hover:text-accent-bright transition-colors">
                        {preset.label}
                      </span>
                      {preset.days[0] !== "" && (
                        <span className="text-[12px] text-text-secondary ml-2">
                          ({preset.days.join(", ")})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day name inputs */}
              {setupDayCount > 1 && (
                <div className="mb-6">
                  <p className="text-[12px] text-text-secondary font-medium uppercase tracking-wide mb-3">Day names</p>
                  <div className="space-y-2">
                    {setupDayNames.map((dayName, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-[13px] text-text-secondary w-14 flex-shrink-0">Day {idx + 1}</span>
                        <input
                          type="text"
                          value={dayName}
                          onChange={(e) => {
                            const updated = [...setupDayNames];
                            updated[idx] = e.target.value;
                            setSetupDayNames(updated);
                          }}
                          placeholder={`Day ${idx + 1} name...`}
                          className="flex-1 px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] focus:border-accent-bright focus:outline-none"
                        />
                      </div>
                    ))}
                    {/* Add/remove day buttons for custom count */}
                    {setupDayCount >= 4 && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            const newCount = setupDayCount + 1;
                            setSetupDayCount(newCount);
                            setSetupDayNames([...setupDayNames, `Day ${newCount}`]);
                          }}
                          className="text-[12px] text-accent-bright hover:underline"
                        >
                          + Add day
                        </button>
                        {setupDayCount > 4 && (
                          <button
                            onClick={() => {
                              setSetupDayCount(setupDayCount - 1);
                              setSetupDayNames(setupDayNames.slice(0, -1));
                            }}
                            className="text-[12px] text-red-400 hover:underline"
                          >
                            Remove last
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)]">
            <button
              onClick={handleSetupComplete}
              className="w-full py-3 rounded-xl bg-accent-bright text-black font-semibold text-[14px] hover:opacity-90 transition-opacity"
            >
              Continue to Builder
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main builder
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative ml-auto w-full max-w-3xl bg-bg-primary border-l border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-text-primary">
              {template ? "Edit Nutrition Template" : "New Nutrition Template"}
            </h2>
            <div className="flex gap-2">
              <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary text-[13px]">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || saving}
                className="px-4 py-2 rounded-xl bg-accent-bright text-black font-semibold text-[13px] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Template"}
              </button>
            </div>
          </div>

          {/* Live macro totals */}
          <MacroSummaryBar actual={totals} target={targets} />
        </div>

        <div className="p-4 space-y-6">
          {/* Template info */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Template name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary font-semibold text-lg"
            />
            <textarea
              placeholder="Description (optional)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] resize-none"
            />

            {/* Plan Type selector */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPlanType("full")}
                className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all cursor-pointer text-left ${
                  planType === "full"
                    ? "border-accent-bright/40 bg-accent/10 text-text-primary"
                    : "border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary hover:border-accent-bright/20"
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${planType === "full" ? "border-accent-bright bg-accent-bright" : "border-text-muted"}`} />
                <div>
                  <div className="text-[13px] font-semibold">Full Meal Plan</div>
                  <div className="text-[11px] text-text-secondary">Detailed foods with quantities and macros</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPlanType("macro_only")}
                className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all cursor-pointer text-left ${
                  planType === "macro_only"
                    ? "border-accent-bright/40 bg-accent/10 text-text-primary"
                    : "border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary hover:border-accent-bright/20"
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${planType === "macro_only" ? "border-accent-bright bg-accent-bright" : "border-text-muted"}`} />
                <div>
                  <div className="text-[13px] font-semibold">Macro Only</div>
                  <div className="text-[11px] text-text-secondary">Calorie and macro targets per meal</div>
                </div>
              </button>
            </div>

            <div className="flex gap-3">
              <select
                value={calorieRange}
                onChange={(e) => setCalorieRange(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px]"
              >
                {CALORIE_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Macro targets */}
          <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-text-primary">Macro Targets</h3>
              <button
                onClick={() => setShowTdee(!showTdee)}
                className="text-[13px] text-accent-bright hover:underline"
              >
                {showTdee ? "Manual Entry" : "TDEE Calculator"}
              </button>
            </div>

            {showTdee ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[13px] text-text-secondary mb-1 block">Weight (kg)</label>
                    <input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px]"
                    />
                  </div>
                  <div>
                    <label className="text-[13px] text-text-secondary mb-1 block">Goal</label>
                    <select
                      value={goal}
                      onChange={(e) => setGoal(e.target.value as "cut" | "maintain" | "bulk")}
                      className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px]"
                    >
                      <option value="cut">Cut (-500 kcal)</option>
                      <option value="maintain">Maintain</option>
                      <option value="bulk">Bulk (+300 kcal)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[13px] text-text-secondary mb-1 block">Activity</label>
                    <select
                      value={activityLevel}
                      onChange={(e) => setActivityLevel(e.target.value as typeof activityLevel)}
                      className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px]"
                    >
                      <option value="sedentary">Sedentary</option>
                      <option value="light">Light</option>
                      <option value="moderate">Moderate</option>
                      <option value="active">Active</option>
                      <option value="very_active">Very Active</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={calcTdee}
                  className="w-full py-2 rounded-xl bg-accent-bright text-black font-semibold text-[13px]"
                >
                  Calculate & Apply
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-[13px] text-text-secondary mb-1 block">Calories</label>
                  <input
                    type="number"
                    value={targetCalories || ""}
                    onChange={(e) => setTargetCalories(Number(e.target.value))}
                    placeholder="2000"
                    className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[13px] text-blue-500 mb-1 block">Protein (g)</label>
                  <input
                    type="number"
                    value={targetProtein || ""}
                    onChange={(e) => setTargetProtein(Number(e.target.value))}
                    placeholder="150"
                    className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[13px] text-accent-bright mb-1 block">Carbs (g)</label>
                  <input
                    type="number"
                    value={targetCarbs || ""}
                    onChange={(e) => setTargetCarbs(Number(e.target.value))}
                    placeholder="200"
                    className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[13px] text-red-500 mb-1 block">Fat (g)</label>
                  <input
                    type="number"
                    value={targetFat || ""}
                    onChange={(e) => setTargetFat(Number(e.target.value))}
                    placeholder="65"
                    className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px]"
                  />
                </div>
              </div>
            )}
            {targetCalories > 0 && (targetProtein > 0 || targetCarbs > 0 || targetFat > 0) && (() => {
              const macrosCalories = (targetProtein * 4) + (targetCarbs * 4) + (targetFat * 9);
              const diff = targetCalories - macrosCalories;
              const absDiff = Math.abs(diff);

              if (absDiff <= 10) {
                return (
                  <div className="mt-3 flex items-center gap-2 text-[13px] text-green-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Macros aligned ({macrosCalories} kcal from macros)
                  </div>
                );
              }
              if (diff > 10) {
                return (
                  <div className="mt-3 flex items-center gap-2 text-[13px] text-amber-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    {diff} kcal unallocated (macros = {macrosCalories} kcal)
                  </div>
                );
              }
              return (
                <div className="mt-3 flex items-center gap-2 text-[13px] text-red-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  Over by {absDiff} kcal (macros = {macrosCalories} kcal)
                </div>
              );
            })()}
          </div>

          {/* Meals */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text-primary">Meals</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenLoadSaved}
                  className="text-[13px] px-3 py-1.5 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary font-medium hover:text-text-primary transition-colors"
                >
                  + Load Saved Meal
                </button>
                <button
                  onClick={addMeal}
                  className="text-[13px] px-3 py-1.5 rounded-xl bg-accent-bright/10 text-accent-bright font-medium hover:bg-accent-bright/20 transition-colors"
                >
                  + Add Meal
                </button>
              </div>
            </div>

            {/* Load Saved Meal popup */}
            {showLoadSaved && (
              <div className="bg-bg-card border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-text-primary text-[14px]">Saved Meals</h4>
                  <button onClick={() => setShowLoadSaved(false)} className="text-text-secondary hover:text-text-primary">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {loadingSaved ? (
                  <p className="text-[13px] text-text-secondary">Loading...</p>
                ) : savedMeals.length === 0 ? (
                  <p className="text-[13px] text-text-secondary">No saved meals yet.</p>
                ) : (
                  <div className="space-y-2">
                    {savedMeals.map((sm) => (
                      <div key={sm.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.03)]">
                        <button
                          onClick={() => handleLoadSavedMeal(sm)}
                          className="flex-1 text-left"
                        >
                          <span className="text-[13px] font-medium text-text-primary">{sm.name}</span>
                          <span className="text-[12px] text-text-secondary ml-2">{sm.items.length} items</span>
                        </button>
                        <button
                          onClick={() => handleDeleteSavedMeal(sm.id)}
                          className="text-text-secondary/40 hover:text-red-400 flex-shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Day variation tabs */}
            {dayVariations.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {dayVariations.map((dayName, idx) => (
                  <button
                    key={dayName}
                    onClick={() => setActiveDay(idx)}
                    className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                      activeDay === idx
                        ? "bg-accent-bright text-black"
                        : "bg-bg-card border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {dayName}
                  </button>
                ))}
              </div>
            )}

            {visibleMeals.map((meal) => {
              const mealMacros = calcMealMacros(meal);
              const isFocused = focusedMealId === meal.id;
              // Get display name (strip day prefix for placeholder)
              const baseName = activeDayPrefix && meal.name.startsWith(activeDayPrefix + " - ")
                ? meal.name.substring(activeDayPrefix.length + 3)
                : meal.name;
              const isEmpty = baseName.trim() === "" || baseName.startsWith("Meal ");

              const alts = getMealAlts(meal.id);
              const activeAltIdx = getActiveMealAltIdx(meal.id); // -1 = primary
              const activeAlt = activeAltIdx >= 0 ? alts[activeAltIdx] : null;

              // Items to display: primary or active alternative
              const displayItems = activeAlt ? activeAlt.items : meal.items;

              // Macro totals for displayed items
              const displayMacros = activeAlt
                ? activeAlt.items.reduce(
                    (acc, item) => {
                      const f = item.food;
                      if (!f) return acc;
                      const qty = Number(item.quantity) || 1;
                      return {
                        calories: acc.calories + f.calories * qty,
                        protein_g: acc.protein_g + f.protein_g * qty,
                        carbs_g: acc.carbs_g + f.carbs_g * qty,
                        fat_g: acc.fat_g + f.fat_g * qty,
                      };
                    },
                    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
                  )
                : mealMacros;

              return (
                <div
                  key={meal.id}
                  className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden"
                >
                  {/* Meal header */}
                  <div className="flex flex-col gap-1 p-3 border-b border-[rgba(0,0,0,0.04)] dark:border-[rgba(255,255,255,0.04)]">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={meal.name}
                        onChange={(e) => updateMealName(meal.id, e.target.value)}
                        onFocus={() => setFocusedMealId(meal.id)}
                        onBlur={() => setTimeout(() => setFocusedMealId(null), 150)}
                        placeholder="Meal name (e.g. Pre-Workout, Snack 1)..."
                        className="flex-1 px-2 py-1 rounded-lg border border-transparent hover:border-[rgba(0,0,0,0.08)] dark:hover:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary font-semibold text-[14px] focus:border-accent-bright focus:outline-none placeholder:text-text-secondary/40 placeholder:font-normal"
                      />
                      <span className="text-[13px] text-text-secondary flex-shrink-0">
                        {Math.round(displayMacros.calories)} kcal
                      </span>
                      {saveMealConfirm === meal.id ? (
                        <span className="text-[12px] text-green-500 flex-shrink-0">Saved!</span>
                      ) : (
                        <button
                          onClick={() => {
                            setSavingMealId(meal.id);
                            setSaveMealName(meal.name);
                          }}
                          title="Save meal as preset"
                          className="text-text-secondary/50 hover:text-accent-bright flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => removeMeal(meal.id)}
                        className="text-red-400 hover:text-red-500 flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Save meal name input */}
                    {savingMealId === meal.id && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={saveMealName}
                          onChange={(e) => setSaveMealName(e.target.value)}
                          placeholder="Preset name..."
                          autoFocus
                          className="flex-1 px-2.5 py-1 rounded-lg border border-accent-bright/30 bg-transparent text-text-primary text-[13px] focus:border-accent-bright focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveMeal(meal)}
                          className="px-3 py-1 rounded-lg bg-accent-bright text-black text-[12px] font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setSavingMealId(null); setSaveMealName(""); }}
                          className="text-text-secondary hover:text-text-primary text-[12px]"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Quick name buttons - show when focused or name is a placeholder */}
                    {(isFocused || isEmpty) && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[11px] text-text-secondary/60">Quick:</span>
                        {QUICK_MEAL_NAMES.map((qn) => (
                          <button
                            key={qn}
                            onMouseDown={(e) => {
                              e.preventDefault(); // prevent blur firing before click
                              const fullName = activeDayPrefix ? `${activeDayPrefix} - ${qn}` : qn;
                              updateMealName(meal.id, fullName);
                            }}
                            className="px-2 py-0.5 rounded-md bg-accent-bright/10 text-accent-bright text-[11px] font-medium hover:bg-accent-bright/20 transition-colors"
                          >
                            {qn}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Alternative meal tabs */}
                    {(alts.length > 0 || planType === "full") && (
                      <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                        {/* Primary tab */}
                        <button
                          onClick={() => setActiveMealAltIndex((prev) => ({ ...prev, [meal.id]: -1 }))}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                            activeAltIdx === -1
                              ? "bg-accent-bright text-black"
                              : "bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.04)] text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {meal.name.includes(" - ") ? meal.name.split(" - ").slice(1).join(" - ") : meal.name}
                        </button>

                        {/* Alternative tabs */}
                        {alts.map((alt, idx) => (
                          <div key={alt.id} className="flex items-center">
                            {activeAltIdx === idx ? (
                              <div className="flex items-center gap-1 bg-accent-bright/15 border border-accent-bright/30 rounded-lg px-1.5 py-0.5">
                                <input
                                  type="text"
                                  value={alt.name}
                                  onChange={(e) => updateAlternativeName(meal.id, alt.id, e.target.value)}
                                  className="bg-transparent text-[11px] font-semibold text-accent-bright focus:outline-none w-24"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <button
                                  onClick={() => removeAlternative(meal.id, alt.id)}
                                  className="text-text-muted hover:text-red-400 cursor-pointer"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setActiveMealAltIndex((prev) => ({ ...prev, [meal.id]: idx }))}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.04)] text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                              >
                                {alt.name}
                              </button>
                            )}
                          </div>
                        ))}

                        {/* Add alternative button */}
                        <button
                          onClick={() => addAlternative(meal.id)}
                          className="px-2 py-1 rounded-lg text-[11px] font-medium text-accent-bright/70 hover:text-accent-bright border border-dashed border-accent-bright/25 hover:border-accent-bright/50 transition-all cursor-pointer"
                        >
                          + Alt
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Food items - primary or active alternative */}
                  {planType === "full" ? (
                    <>
                      <div className="divide-y divide-[rgba(0,0,0,0.03)] dark:divide-[rgba(255,255,255,0.03)]">
                        {displayItems.map((item) => {
                          const food = item.food;
                          if (!food) return null;
                          const qty = Number(item.quantity) || 1;
                          return (
                            <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <span className="text-[13px] text-text-primary">{food.name}</span>
                                <span className="text-[13px] text-text-secondary/50 ml-1">
                                  ({Math.round(parseGrams(food.serving_size) * item.quantity)}g)
                                </span>
                              </div>
                              {(() => {
                                const baseGrams = parseGrams(food.serving_size);
                                const actualGrams = Math.round(baseGrams * item.quantity);
                                return (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      value={actualGrams}
                                      onChange={(e) => {
                                        const newGrams = Number(e.target.value) || baseGrams;
                                        const newQty = newGrams / baseGrams;
                                        if (activeAlt) {
                                          updateAltFoodQuantity(meal.id, activeAlt.id, item.id, newQty);
                                        } else {
                                          updateFoodQuantity(meal.id, item.id, newQty);
                                        }
                                      }}
                                      min={1}
                                      step={5}
                                      className="w-16 px-2 py-1 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center"
                                    />
                                    <span className="text-[11px] text-text-secondary/50">g</span>
                                  </div>
                                );
                              })()}
                              <span className="text-[13px] text-text-secondary w-16 text-right flex-shrink-0">
                                {Math.round(food.calories * qty)} kcal
                              </span>
                              <input
                                type="text"
                                value={item.notes || ""}
                                onChange={(e) => {
                                  if (!activeAlt) updateFoodNotes(meal.id, item.id, e.target.value);
                                }}
                                placeholder="Note..."
                                className="w-24 px-2 py-1 rounded-lg border border-transparent hover:border-[rgba(0,0,0,0.08)] dark:hover:border-[rgba(255,255,255,0.08)] bg-transparent text-[13px] text-accent-bright/70 italic"
                              />
                              <button
                                onClick={() => {
                                  if (activeAlt) {
                                    removeFoodFromAlternative(meal.id, activeAlt.id, item.id);
                                  } else {
                                    removeFoodFromMeal(meal.id, item.id);
                                  }
                                }}
                                className="text-text-secondary/40 hover:text-red-400 flex-shrink-0"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add food button */}
                      <div className="p-2">
                        <button
                          onClick={() => {
                            if (activeAlt) {
                              setPickerAltId(`${meal.id}:${activeAlt.id}`);
                            } else {
                              setPickerMealId(meal.id);
                            }
                          }}
                          className="w-full py-2 rounded-xl border border-dashed border-[rgba(0,0,0,0.1)] dark:border-[rgba(255,255,255,0.1)] text-[13px] text-text-secondary hover:text-accent-bright hover:border-accent-bright/30 transition-colors"
                        >
                          + Add Food
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Macro Only mode - show macro targets per meal */
                    <div className="p-3 grid grid-cols-4 gap-2">
                      {(["calories", "protein_g", "carbs_g", "fat_g"] as const).map((macro) => {
                        const labels = { calories: "Calories", protein_g: "Protein", carbs_g: "Carbs", fat_g: "Fat" };
                        const units = { calories: "kcal", protein_g: "g", carbs_g: "g", fat_g: "g" };
                        const colors = { calories: "text-text-primary", protein_g: "text-blue-400", carbs_g: "text-accent-bright", fat_g: "text-red-400" };
                        const noteKey = `__macro_${macro}_${meal.id}`;
                        const stored = meal.notes ? (() => { try { const p = JSON.parse(meal.notes); return p[noteKey] || ""; } catch { return ""; } })() : "";
                        return (
                          <div key={macro}>
                            <label className={`text-[10px] font-semibold uppercase tracking-wider mb-1 block ${colors[macro]}`}>{labels[macro]}</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                defaultValue={stored}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMeals((prev) => prev.map((m) => {
                                    if (m.id !== meal.id) return m;
                                    let notesObj: Record<string, string> = {};
                                    try { notesObj = m.notes ? JSON.parse(m.notes) : {}; } catch { notesObj = {}; }
                                    notesObj[noteKey] = val;
                                    return { ...m, notes: JSON.stringify(notesObj) };
                                  }));
                                }}
                                className="w-full px-2 py-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center"
                              />
                              <span className="text-[10px] text-text-muted">{units[macro]}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Food picker modal - primary meal */}
      {pickerMealId && (
        <FoodPicker
          onPick={(food) => addFoodToMeal(pickerMealId, food)}
          onClose={() => setPickerMealId(null)}
        />
      )}

      {/* Food picker modal - alternative meal */}
      {pickerAltId && (() => {
        const [mealId, altId] = pickerAltId.split(":");
        return (
          <FoodPicker
            onPick={(food) => addFoodToAlternative(mealId, altId, food)}
            onClose={() => setPickerAltId(null)}
          />
        );
      })()}
    </div>
  );
}
