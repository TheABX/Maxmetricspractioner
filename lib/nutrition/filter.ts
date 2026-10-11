import { MEALS } from "./meals";
import type { EnergyTargets, Meal, MealSlot, NutritionPrefs } from "./types";

function dietOk(meal: Meal, diet: NutritionPrefs["diet"]): boolean {
  if (diet === "vegan") return meal.diet.includes("vegan");
  if (diet === "vegetarian") return meal.diet.includes("vegan") || meal.diet.includes("vegetarian");
  if (diet === "pescatarian") {
    return meal.diet.includes("vegan") || meal.diet.includes("vegetarian") || meal.diet.includes("pescatarian");
  }
  if (diet === "halal") return !meal.avoid_flags.includes("pork");
  return true;
}

function powderOk(meal: Meal, prefs: NutritionPrefs): boolean {
  if (prefs.proteinPowder === "no" && (meal.slug === "protein-smoothie" || meal.slug === "protein-shake")) return false;
  return true;
}

function styleOk(meal: Meal, prefs: NutritionPrefs): boolean {
  if (meal.slot !== "breakfast" || prefs.breakfastStyle === "either" || !meal.style) return true;
  return meal.style === prefs.breakfastStyle;
}

export function mealsForSlot(slot: MealSlot, prefs: NutritionPrefs, targets: EnergyTargets): Meal[] {
  const budget = targets.slots[slot].kcal;
  const avoid = new Set(prefs.avoid);
  const scored = MEALS.filter((m) => m.slot === slot)
    .filter((m) => dietOk(m, prefs.diet))
    .filter((m) => !m.avoid_flags.some((f) => avoid.has(f)))
    .filter((m) => m.prep_minutes <= prefs.cookMinutes + 5)
    .filter((m) => powderOk(m, prefs))
    .filter((m) => styleOk(m, prefs))
    .map((m) => {
      const goalFit = m.goals.includes(prefs.goal) ? 0 : 1;
      const kcalFit =
        budget > 0 ? Math.abs(m.kcal - budget) / Math.max(budget, 1) : 0;
      const skipBias = prefs.breakfastTiming === "skip" && m.slug === "skip-coffee" ? -2 : 0;
      return { m, rank: goalFit * 2 + kcalFit + skipBias };
    })
    .sort((a, b) => a.rank - b.rank);

  const list = scored.map((s) => s.m);
  if (list.length >= 4) return list;
  // If filters were harsh, relax cook time then style so the tray is never empty.
  const relaxed = MEALS.filter((m) => m.slot === slot)
    .filter((m) => dietOk(m, prefs.diet))
    .filter((m) => !m.avoid_flags.some((f) => avoid.has(f)))
    .filter((m) => powderOk(m, prefs));
  const seen = new Set(list.map((m) => m.slug));
  for (const m of relaxed) {
    if (!seen.has(m.slug)) list.push(m);
  }
  return list;
}

export function totals(meals: { meal: Meal; servings: number }[]) {
  return meals.reduce(
    (acc, { meal, servings }) => ({
      kcal: acc.kcal + meal.kcal * servings,
      protein: acc.protein + meal.protein_g * servings,
      carb: acc.carb + meal.carb_g * servings,
      fat: acc.fat + meal.fat_g * servings,
    }),
    { kcal: 0, protein: 0, carb: 0, fat: 0 },
  );
}
