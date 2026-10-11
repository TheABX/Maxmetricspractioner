export type NutritionGoal = "maintain" | "lean" | "bulk";
export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export type DietPattern = "none" | "vegetarian" | "vegan" | "pescatarian" | "halal";
export type EntryKind = "plan" | "log";

export type NutritionPrefs = {
  goal: NutritionGoal;
  diet: DietPattern;
  avoid: string[];
  avoidDetail: string;
  mealsPerDay: "3" | "3_snacks" | "2_snacks" | "grazing";
  cookMinutes: number;
  breakfastStyle: "savoury" | "sweet" | "either";
  cookingConfidence: "low" | "ok" | "confident";
  loves: string;
  wont: string;
  proteinPowder: "yes" | "no" | "maybe";
  breakfastTiming: "early" | "mid" | "late" | "skip";
  hunger: "morning" | "even" | "evening" | "graze";
  weightKg: number | null;
};

export type EnergyTargets = {
  bmr: number | null;
  tdee: number | null;
  targetKcal: number | null;
  proteinG: number | null;
  carbG: number | null;
  fatG: number | null;
  goal: NutritionGoal;
  slots: Record<MealSlot, { kcal: number; share: number }>;
  missing: string[];
  method: string;
};

export type Meal = {
  slug: string;
  name: string;
  slot: MealSlot;
  description: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  prep_minutes: number;
  diet: Array<"omnivore" | "vegetarian" | "vegan" | "pescatarian">;
  avoid_flags: string[];
  style?: "savoury" | "sweet";
  goals: NutritionGoal[];
};

export type PhotoEstimateItem = {
  name: string;
  portion: string;
  kcal: number;
};

export type PhotoEstimate = {
  name: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  confidence: number;
  items: PhotoEstimateItem[];
  notes: string;
  not_food?: boolean;
};

export type NutritionEntry = {
  id: string;
  entry_date: string;
  slot: MealSlot;
  kind: EntryKind;
  meal_slug: string;
  servings: number;
  source?: "library" | "photo" | "favorite";
  custom_name?: string | null;
  kcal?: number | null;
  protein_g?: number | null;
  carb_g?: number | null;
  fat_g?: number | null;
  photo_path?: string | null;
  estimate?: PhotoEstimate | Record<string, unknown> | null;
};

export type FavoriteMeal = {
  id: string;
  slot: MealSlot;
  source: "library" | "photo" | "favorite";
  meal_slug: string;
  custom_name: string | null;
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fat_g: number | null;
  photo_path: string | null;
  estimate?: PhotoEstimate | Record<string, unknown> | null;
};

export type Anthropometrics = {
  sex: string | null;
  dob: string | null;
  heightCm: number | null;
  bodyweightKg: number | null;
};
