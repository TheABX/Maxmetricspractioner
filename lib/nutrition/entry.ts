import { mealBySlug } from "./meals";
import type { Meal, NutritionEntry } from "./types";

export type ResolvedEntry = {
  name: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  photo: boolean;
  items: string[];
};

export function isCustomEntry(entry: NutritionEntry) {
  return entry.source === "photo" || entry.source === "favorite" || entry.meal_slug === "photo" || Boolean(entry.photo_path);
}

export function isPhotoEntry(entry: NutritionEntry) {
  return isCustomEntry(entry);
}

export function resolveEntry(entry: NutritionEntry): ResolvedEntry | null {
  const servings = Number(entry.servings) || 1;
  if (isCustomEntry(entry) || (entry.kcal != null && !mealBySlug(entry.meal_slug))) {
    const estimate = (entry.estimate ?? {}) as { items?: { name?: string }[] };
    return {
      name: entry.custom_name?.trim() || (entry.source === "favorite" ? "Favourite" : "Photo meal"),
      kcal: (Number(entry.kcal) || 0) * servings,
      protein_g: (Number(entry.protein_g) || 0) * servings,
      carb_g: (Number(entry.carb_g) || 0) * servings,
      fat_g: (Number(entry.fat_g) || 0) * servings,
      photo: Boolean(entry.photo_path) || entry.source === "photo",
      items: (estimate.items ?? []).map((i) => String(i.name ?? "")).filter(Boolean),
    };
  }
  const meal = mealBySlug(entry.meal_slug);
  if (!meal) return null;
  return {
    name: meal.name,
    kcal: meal.kcal * servings,
    protein_g: meal.protein_g * servings,
    carb_g: meal.carb_g * servings,
    fat_g: meal.fat_g * servings,
    photo: false,
    items: [],
  };
}

export function asMeal(resolved: ResolvedEntry): Meal {
  return {
    slug: "resolved",
    name: resolved.name,
    slot: "snack",
    description: "",
    kcal: resolved.kcal,
    protein_g: resolved.protein_g,
    carb_g: resolved.carb_g,
    fat_g: resolved.fat_g,
    prep_minutes: 0,
    diet: ["omnivore"],
    avoid_flags: [],
    goals: ["maintain"],
  };
}

export function entryTotals(entries: NutritionEntry[]) {
  return entries.reduce(
    (acc, e) => {
      const r = resolveEntry(e);
      if (!r) return acc;
      return {
        kcal: acc.kcal + r.kcal,
        protein: acc.protein + r.protein_g,
        carb: acc.carb + r.carb_g,
        fat: acc.fat + r.fat_g,
      };
    },
    { kcal: 0, protein: 0, carb: 0, fat: 0 },
  );
}
