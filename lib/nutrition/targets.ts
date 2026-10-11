import type { Anthropometrics, EnergyTargets, MealSlot, NutritionGoal, NutritionPrefs } from "./types";

function n(v: unknown): number | null {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : null;
}

export function ageFromDob(dob: string | null | undefined, on = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = on.getFullYear() - d.getFullYear();
  const m = on.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < d.getDate())) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

/** Mifflin–St Jeor. Age is used only in this energy equation, not as a program filter. */
export function mifflinBmr(input: { sex: string | null; kg: number; cm: number; age: number }): number {
  const base = 10 * input.kg + 6.25 * input.cm - 5 * input.age;
  const sex = (input.sex ?? "").toLowerCase();
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return base - 78;
}

export function activityMultiplier(activityLevel: string | null | undefined, trainingDays: number): number {
  const a = String(activityLevel ?? "");
  let m = a === "active" ? 1.55 : a === "light" ? 1.375 : 1.2;
  if (trainingDays >= 5) m += 0.1;
  else if (trainingDays >= 3) m += 0.05;
  return Math.min(m, 1.725);
}

export function slotShares(mealsPerDay: NutritionPrefs["mealsPerDay"]): Record<MealSlot, number> {
  if (mealsPerDay === "2_snacks") return { breakfast: 0.05, lunch: 0.38, dinner: 0.37, snack: 0.2 };
  if (mealsPerDay === "grazing") return { breakfast: 0.2, lunch: 0.25, dinner: 0.25, snack: 0.3 };
  if (mealsPerDay === "3") return { breakfast: 0.3, lunch: 0.35, dinner: 0.35, snack: 0 };
  return { breakfast: 0.25, lunch: 0.3, dinner: 0.3, snack: 0.15 };
}

export function computeTargets(input: {
  anthro: Anthropometrics;
  prefs: NutritionPrefs;
  activityLevel?: string | null;
  trainingDays?: number;
}): EnergyTargets {
  const missing: string[] = [];
  const kg = input.prefs.weightKg ?? n(input.anthro.bodyweightKg);
  const cm = n(input.anthro.heightCm);
  const age = ageFromDob(input.anthro.dob);
  if (!kg) missing.push("weight");
  if (!cm) missing.push("height");
  if (!age) missing.push("date of birth");

  const goal = input.prefs.goal;
  const shares = slotShares(input.prefs.mealsPerDay);
  const emptySlots = {
    breakfast: { kcal: 0, share: shares.breakfast },
    lunch: { kcal: 0, share: shares.lunch },
    dinner: { kcal: 0, share: shares.dinner },
    snack: { kcal: 0, share: shares.snack },
  };

  if (missing.length) {
    return {
      bmr: null,
      tdee: null,
      targetKcal: null,
      proteinG: null,
      carbG: null,
      fatG: null,
      goal,
      slots: emptySlots,
      missing,
      method: "Need height, weight, and date of birth on the client record (or a current weight in the nutrition questions).",
    };
  }

  const bmr = Math.round(mifflinBmr({ sex: input.anthro.sex, kg: kg!, cm: cm!, age: age! }));
  const tdee = Math.round(bmr * activityMultiplier(input.activityLevel, input.trainingDays ?? 0));
  const delta = goal === "lean" ? -0.18 : goal === "bulk" ? 0.12 : 0;
  const targetKcal = Math.round(tdee * (1 + delta));
  const proteinPerKg = goal === "lean" ? 2.0 : goal === "bulk" ? 1.8 : 1.6;
  const proteinG = Math.round(kg! * proteinPerKg);
  const fatG = Math.round((targetKcal * (goal === "lean" ? 0.28 : 0.3)) / 9);
  const carbG = Math.max(0, Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4));
  const slots = {
    breakfast: { kcal: Math.round(targetKcal * shares.breakfast), share: shares.breakfast },
    lunch: { kcal: Math.round(targetKcal * shares.lunch), share: shares.lunch },
    dinner: { kcal: Math.round(targetKcal * shares.dinner), share: shares.dinner },
    snack: { kcal: Math.round(targetKcal * shares.snack), share: shares.snack },
  };

  return {
    bmr,
    tdee,
    targetKcal,
    proteinG,
    carbG,
    fatG,
    goal,
    slots,
    missing: [],
    method:
      "Mifflin–St Jeor resting energy, then a multiplier from day-to-day activity and training days. Target intake is a modest surplus, match, or deficit from that — not a medical prescription.",
  };
}

export function goalLabel(goal: NutritionGoal) {
  return goal === "lean" ? "Leaning" : goal === "bulk" ? "Building" : "Maintaining";
}

export function goalWhy(goal: NutritionGoal) {
  if (goal === "lean") return "Eat a little under what you burn so fat loss can happen without starving training.";
  if (goal === "bulk") return "Eat a little over what you burn so muscle work has fuel.";
  return "Eat around what you burn so weight stays steady while you train.";
}
