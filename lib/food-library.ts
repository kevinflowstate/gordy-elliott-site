import type { Food } from "@/lib/types";

type FoodPromptCandidate = Pick<
  Food,
  "id" | "name" | "category" | "serving_size" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "fibre_g"
>;

const FOOD_CATEGORIES = [
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
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "their",
  "meal",
  "meals",
  "plan",
  "plans",
  "client",
  "clients",
  "easy",
  "simple",
  "daily",
  "calorie",
  "calories",
  "protein",
  "carbs",
  "fats",
  "grams",
  "gram",
  "full",
  "only",
  "high",
  "low",
  "moderate",
]);

function tokenizePrompt(input: string): string[] {
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
    ),
  );
}

function scoreFood(food: FoodPromptCandidate, tokens: string[]): number {
  const name = food.name.toLowerCase();
  const category = food.category.toLowerCase();
  const serving = food.serving_size.toLowerCase();
  const combined = `${name} ${category} ${serving}`;
  let score = 0;

  for (const token of tokens) {
    if (new RegExp(`\\b${token}\\b`).test(name)) score += 8;
    else if (name.includes(token)) score += 5;
    if (category.includes(token) || serving.includes(token)) score += 2;
  }

  if (tokens.includes("breakfast") && /(oat|porridge|egg|yoghurt|yogurt|bread|banana|berries)/.test(combined)) score += 3;
  if (tokens.includes("snack") && /(bar|yoghurt|yogurt|cottage|shake|fruit|nuts|egg)/.test(combined)) score += 3;
  if (tokens.includes("office") && /(tuna|potato|wrap|rice|chicken|shake|bar|egg|apple|banana)/.test(combined)) score += 3;
  if (tokens.includes("vegetarian") || tokens.includes("vegan")) {
    if (/(tofu|tempeh|lentil|bean|chickpea|quinoa|soya|soy)/.test(combined)) score += 5;
  }
  if (tokens.includes("fish") && /(salmon|cod|tuna|prawn|haddock)/.test(combined)) score += 4;

  return score;
}

export function selectFoodsForPrompt(
  foods: FoodPromptCandidate[],
  prompt: string,
  options?: { maxFoods?: number; maxPerCategory?: number },
): FoodPromptCandidate[] {
  const maxFoods = options?.maxFoods ?? 180;
  const maxPerCategory = options?.maxPerCategory ?? 20;
  const tokens = tokenizePrompt(prompt);
  const selected: FoodPromptCandidate[] = [];
  const seen = new Set<string>();
  const categoryCounts = new Map<string, number>();

  const tryAdd = (food: FoodPromptCandidate, allowOverflow = false) => {
    if (selected.length >= maxFoods || seen.has(food.id)) return false;
    const count = categoryCounts.get(food.category) ?? 0;
    if (!allowOverflow && count >= maxPerCategory) return false;
    selected.push(food);
    seen.add(food.id);
    categoryCounts.set(food.category, count + 1);
    return true;
  };

  const scored = foods
    .map((food) => ({ food, score: scoreFood(food, tokens) }))
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name));

  for (const { food, score } of scored) {
    if (score <= 0) break;
    tryAdd(food);
  }

  const foodsByCategory = new Map<string, FoodPromptCandidate[]>();
  for (const food of foods) {
    const bucket = foodsByCategory.get(food.category) ?? [];
    bucket.push(food);
    foodsByCategory.set(food.category, bucket);
  }

  for (const category of FOOD_CATEGORIES) {
    const bucket = (foodsByCategory.get(category) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    for (const food of bucket) {
      if ((categoryCounts.get(category) ?? 0) >= Math.min(8, maxPerCategory)) break;
      tryAdd(food);
    }
  }

  for (const food of foods.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))) {
    if (!tryAdd(food, true) && selected.length >= maxFoods) break;
  }

  return selected.slice(0, maxFoods);
}
