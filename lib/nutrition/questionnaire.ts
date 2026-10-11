import type { Field, Section } from "@/lib/questionnaire/schema";
import type { NutritionGoal, NutritionPrefs } from "./types";

export const NUTRITION_SECTION_KEYS = ["nutrition_goal", "nutrition_eating"] as const;

export const NUTRITION_SECTIONS: Section[] = [
  {
    key: "nutrition_goal",
    title: "Nutrition",
    intro:
      "This is separate from training. It sets your daily energy target and which meals we put in front of you. Nothing here is a diagnosis.",
    fields: [
      {
        key: "nutrition_goal",
        label: "What should food do for you over this block?",
        type: "select",
        help: "Leaning = a modest deficit. Building = a modest surplus. Maintaining = eat around what you burn.",
        options: [
          { value: "lean", label: "Lean — lose body fat, keep training quality" },
          { value: "maintain", label: "Maintain — stay about the same weight" },
          { value: "bulk", label: "Build — support muscle with a little extra food" },
        ],
      },
      {
        key: "current_weight_kg",
        label: "Current body weight (kg)",
        type: "number",
        help: "Used for the energy estimate. Your practitioner’s file is a fallback if you leave this blank.",
        placeholder: "e.g. 72",
      },
      {
        key: "diet_pattern",
        label: "How do you eat?",
        type: "select",
        options: [
          { value: "none", label: "No particular pattern" },
          { value: "vegetarian", label: "Vegetarian" },
          { value: "vegan", label: "Vegan" },
          { value: "pescatarian", label: "Pescatarian" },
          { value: "halal", label: "Halal" },
        ],
      },
      {
        key: "food_avoid",
        label: "Foods you cannot or will not eat",
        type: "multi",
        options: [
          { value: "dairy", label: "Dairy" },
          { value: "gluten", label: "Gluten" },
          { value: "nuts", label: "Nuts" },
          { value: "eggs", label: "Eggs" },
          { value: "shellfish", label: "Shellfish" },
          { value: "soy", label: "Soy" },
          { value: "pork", label: "Pork" },
          { value: "red_meat", label: "Red meat" },
          { value: "fish", label: "Fish" },
        ],
      },
      { key: "food_avoid_detail", label: "Allergies or other restrictions we should not miss", type: "textarea" },
    ],
  },
  {
    key: "nutrition_eating",
    title: "How you like to eat",
    intro: "We use this to pick meals you will actually make, not a perfect plan on paper.",
    fields: [
      {
        key: "meals_per_day",
        label: "How do you prefer to eat across the day?",
        type: "select",
        options: [
          { value: "3", label: "Three meals, no snacks" },
          { value: "3_snacks", label: "Three meals plus snacks" },
          { value: "2_snacks", label: "Two larger meals plus snacks" },
          { value: "grazing", label: "Smaller meals, more often" },
        ],
      },
      {
        key: "cook_time",
        label: "How long will you spend on a typical meal?",
        type: "select",
        options: [
          { value: "10", label: "About 10 minutes — assemble, don’t cook" },
          { value: "20", label: "About 20 minutes" },
          { value: "30", label: "30 minutes is fine" },
        ],
      },
      {
        key: "breakfast_style",
        label: "Breakfast preference",
        type: "select",
        options: [
          { value: "savoury", label: "Savoury" },
          { value: "sweet", label: "Sweet" },
          { value: "either", label: "Either" },
        ],
      },
      {
        key: "breakfast_timing",
        label: "When do you usually eat first?",
        type: "select",
        options: [
          { value: "early", label: "Soon after waking" },
          { value: "mid", label: "Mid-morning" },
          { value: "late", label: "Late — closer to lunch" },
          { value: "skip", label: "I often skip breakfast" },
        ],
      },
      {
        key: "hunger_pattern",
        label: "When are you hungriest?",
        type: "select",
        options: [
          { value: "morning", label: "Morning" },
          { value: "even", label: "Evenly through the day" },
          { value: "evening", label: "Evening" },
          { value: "graze", label: "I graze rather than get properly hungry" },
        ],
      },
      {
        key: "cooking_confidence",
        label: "How confident are you in the kitchen?",
        type: "select",
        options: [
          { value: "low", label: "I’d rather assemble than cook" },
          { value: "ok", label: "Simple recipes are fine" },
          { value: "confident", label: "Happy to cook a proper meal" },
        ],
      },
      {
        key: "protein_powder",
        label: "Are you happy using protein powder?",
        type: "select",
        options: [
          { value: "yes", label: "Yes" },
          { value: "maybe", label: "Sometimes" },
          { value: "no", label: "No — food only" },
        ],
      },
      { key: "food_loves", label: "Foods you want to see often", type: "textarea", placeholder: "e.g. yoghurt, chicken, rice, berries" },
      { key: "food_wont", label: "Foods you will not eat even if they fit the numbers", type: "textarea" },
    ],
  },
];

export function nutritionFields(): Field[] {
  return NUTRITION_SECTIONS.flatMap((s) => s.fields);
}

export function nutritionComplete(answers: Record<string, unknown> | null | undefined): boolean {
  return Boolean(answers && String(answers.nutrition_goal ?? ""));
}

export function defaultPrefs(): NutritionPrefs {
  return {
    goal: "maintain",
    diet: "none",
    avoid: [],
    avoidDetail: "",
    mealsPerDay: "3_snacks",
    cookMinutes: 20,
    breakfastStyle: "either",
    cookingConfidence: "ok",
    loves: "",
    wont: "",
    proteinPowder: "maybe",
    breakfastTiming: "mid",
    hunger: "even",
    weightKg: null,
  };
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v) return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function s(v: unknown) {
  return v == null ? "" : String(v);
}

export function derivePrefs(answers: Record<string, unknown> | null | undefined): NutritionPrefs {
  const a = answers ?? {};
  const goal = s(a.nutrition_goal);
  const diet = s(a.diet_pattern);
  const meals = s(a.meals_per_day);
  const style = s(a.breakfast_style);
  const cook = Number(a.cook_time);
  const conf = s(a.cooking_confidence);
  const powder = s(a.protein_powder);
  const timing = s(a.breakfast_timing);
  const hunger = s(a.hunger_pattern);
  const kg = Number(a.current_weight_kg);
  return {
    goal: goal === "lean" || goal === "bulk" || goal === "maintain" ? goal : "maintain",
    diet: diet === "vegetarian" || diet === "vegan" || diet === "pescatarian" || diet === "halal" ? diet : "none",
    avoid: arr(a.food_avoid),
    avoidDetail: s(a.food_avoid_detail).trim(),
    mealsPerDay: meals === "3" || meals === "2_snacks" || meals === "grazing" || meals === "3_snacks" ? meals : "3_snacks",
    cookMinutes: cook === 10 || cook === 30 ? cook : 20,
    breakfastStyle: style === "savoury" || style === "sweet" || style === "either" ? style : "either",
    cookingConfidence: conf === "low" || conf === "confident" || conf === "ok" ? conf : "ok",
    loves: s(a.food_loves).trim(),
    wont: s(a.food_wont).trim(),
    proteinPowder: powder === "yes" || powder === "no" || powder === "maybe" ? powder : "maybe",
    breakfastTiming: timing === "early" || timing === "late" || timing === "skip" || timing === "mid" ? timing : "mid",
    hunger: hunger === "morning" || hunger === "evening" || hunger === "graze" || hunger === "even" ? hunger : "even",
    weightKg: Number.isFinite(kg) && kg > 0 ? kg : null,
  };
}

export function inferredGoalFromTraining(primaryGoal: unknown): NutritionGoal {
  const g = String(primaryGoal ?? "");
  if (g === "fat_loss") return "lean";
  if (g === "hypertrophy") return "bulk";
  return "maintain";
}

export function pickNutritionAnswers(answers: Record<string, unknown>): Record<string, unknown> {
  const keys = new Set(nutritionFields().map((f) => f.key));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (keys.has(k)) out[k] = v;
  }
  return out;
}
