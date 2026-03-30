"use client";

import { useState } from "react";
import FoodPicker from "./FoodPicker";
import MacroSummaryBar from "./MacroSummaryBar";
import type { NutritionTemplate, NutritionMeal, NutritionMealItem, Food } from "@/lib/types";

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
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const tpl: NutritionTemplate = {
      id: template?.id || crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      calorie_range: calorieRange,
      target_calories: targetCalories || undefined,
      target_protein_g: targetProtein || undefined,
      target_carbs_g: targetCarbs || undefined,
      target_fat_g: targetFat || undefined,
      is_active: true,
      meals,
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
              <button
                onClick={addMeal}
                className="text-[13px] px-3 py-1.5 rounded-xl bg-accent-bright/10 text-accent-bright font-medium hover:bg-accent-bright/20 transition-colors"
              >
                + Add Meal
              </button>
            </div>

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
                        {Math.round(mealMacros.calories)} kcal
                      </span>
                      <button
                        onClick={() => removeMeal(meal.id)}
                        className="text-red-400 hover:text-red-500 flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

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
                  </div>

                  {/* Food items */}
                  <div className="divide-y divide-[rgba(0,0,0,0.03)] dark:divide-[rgba(255,255,255,0.03)]">
                    {meal.items.map((item) => {
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
                                    updateFoodQuantity(meal.id, item.id, newGrams / baseGrams);
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
                            onChange={(e) => updateFoodNotes(meal.id, item.id, e.target.value)}
                            placeholder="Note..."
                            className="w-24 px-2 py-1 rounded-lg border border-transparent hover:border-[rgba(0,0,0,0.08)] dark:hover:border-[rgba(255,255,255,0.08)] bg-transparent text-[13px] text-accent-bright/70 italic"
                          />
                          <button
                            onClick={() => removeFoodFromMeal(meal.id, item.id)}
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
                      onClick={() => setPickerMealId(meal.id)}
                      className="w-full py-2 rounded-xl border border-dashed border-[rgba(0,0,0,0.1)] dark:border-[rgba(255,255,255,0.1)] text-[13px] text-text-secondary hover:text-accent-bright hover:border-accent-bright/30 transition-colors"
                    >
                      + Add Food
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Food picker modal */}
      {pickerMealId && (
        <FoodPicker
          onPick={(food) => addFoodToMeal(pickerMealId, food)}
          onClose={() => setPickerMealId(null)}
        />
      )}
    </div>
  );
}
