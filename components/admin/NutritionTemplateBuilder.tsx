"use client";

import { useState } from "react";
import FoodPicker from "./FoodPicker";
import MacroSummaryBar from "./MacroSummaryBar";
import type { NutritionTemplate, NutritionMeal, NutritionMealItem, Food } from "@/lib/types";

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

export default function NutritionTemplateBuilder({ template, onSave, onCancel }: NutritionTemplateBuilderProps) {
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

  const addMeal = () => {
    setMeals([
      ...meals,
      {
        id: crypto.randomUUID(),
        name: `Meal ${meals.length + 1}`,
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

  const totals = calcTotalMacros(meals);
  const targets = targetCalories ? { calories: targetCalories, protein_g: targetProtein, carbs_g: targetCarbs, fat_g: targetFat } : null;

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

            {meals.map((meal) => {
              const mealMacros = calcMealMacros(meal);
              return (
                <div
                  key={meal.id}
                  className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden"
                >
                  {/* Meal header */}
                  <div className="flex items-center gap-3 p-3 border-b border-[rgba(0,0,0,0.04)] dark:border-[rgba(255,255,255,0.04)]">
                    <input
                      type="text"
                      value={meal.name}
                      onChange={(e) => updateMealName(meal.id, e.target.value)}
                      className="flex-1 px-2 py-1 rounded-lg border border-transparent hover:border-[rgba(0,0,0,0.08)] dark:hover:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary font-semibold text-[14px] focus:border-accent-bright focus:outline-none"
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
                            <span className="text-[13px] text-text-secondary/50 ml-1">({food.serving_size})</span>
                          </div>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateFoodQuantity(meal.id, item.id, Number(e.target.value) || 1)}
                            min={0.25}
                            step={0.25}
                            className="w-16 px-2 py-1 rounded-lg border border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.08)] bg-transparent text-text-primary text-[13px] text-center"
                          />
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
