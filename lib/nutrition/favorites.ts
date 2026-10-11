import { mealBySlug } from "./meals";
import type { FavoriteMeal, Meal, MealSlot, NutritionEntry } from "./types";
import { resolveEntry } from "./entry";

export function matchingFavorite(favorites: FavoriteMeal[], entry: NutritionEntry) {
  const resolved = resolveEntry(entry);
  if (entry.source === "library" || (entry.meal_slug && mealBySlug(entry.meal_slug))) {
    return favorites.find((f) => f.slot === entry.slot && f.source === "library" && f.meal_slug === entry.meal_slug) ?? null;
  }
  const name = (resolved?.name ?? entry.custom_name ?? "").trim().toLowerCase();
  if (!name) return null;
  return (
    favorites.find(
      (f) => f.slot === entry.slot && f.source !== "library" && (f.custom_name ?? "").trim().toLowerCase() === name,
    ) ?? null
  );
}

export function favoriteAsMeal(fav: FavoriteMeal): Meal {
  if (fav.source === "library") {
    const lib = mealBySlug(fav.meal_slug);
    if (lib) return { ...lib, slug: `fav:${fav.id}` };
  }
  return {
    slug: `fav:${fav.id}`,
    name: fav.custom_name?.trim() || "Favourite",
    slot: fav.slot,
    description: "Saved to your list",
    kcal: Math.round(Number(fav.kcal) || 0),
    protein_g: Math.round(Number(fav.protein_g) || 0),
    carb_g: Math.round(Number(fav.carb_g) || 0),
    fat_g: Math.round(Number(fav.fat_g) || 0),
    prep_minutes: 0,
    diet: ["omnivore"],
    avoid_flags: [],
    goals: ["maintain"],
  };
}

export function payloadFromEntry(entry: NutritionEntry, slot: MealSlot) {
  const resolved = resolveEntry(entry);
  const library = entry.source !== "photo" && entry.source !== "favorite" && Boolean(mealBySlug(entry.meal_slug));
  return {
    slot,
    source: library ? ("library" as const) : ("photo" as const),
    meal_slug: library ? entry.meal_slug : "photo",
    custom_name: library ? null : resolved?.name ?? entry.custom_name ?? "Meal",
    kcal: library ? null : resolved?.kcal ?? entry.kcal ?? null,
    protein_g: library ? null : resolved?.protein_g ?? entry.protein_g ?? null,
    carb_g: library ? null : resolved?.carb_g ?? entry.carb_g ?? null,
    fat_g: library ? null : resolved?.fat_g ?? entry.fat_g ?? null,
    photo_path: entry.photo_path ?? null,
    estimate: (entry.estimate as Record<string, unknown> | null) ?? {},
  };
}
