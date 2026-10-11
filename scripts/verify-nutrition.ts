import { entryTotals } from "../lib/nutrition/entry";
import { matchingFavorite } from "../lib/nutrition/favorites";
import { mealsForSlot } from "../lib/nutrition/filter";
import { MEALS, SLOTS } from "../lib/nutrition/meals";
import { defaultPrefs, derivePrefs, nutritionComplete } from "../lib/nutrition/questionnaire";
import { activityMultiplier, computeTargets, mifflinBmr, slotShares } from "../lib/nutrition/targets";

function fail(msg: string): never {
  console.error("FAIL", msg);
  process.exit(1);
}

const maleBmr = mifflinBmr({ sex: "male", kg: 80, cm: 180, age: 40 });
if (Math.abs(maleBmr - 1730) > 2) fail(`male BMR expected 1730, got ${maleBmr}`);

const femaleBmr = mifflinBmr({ sex: "female", kg: 65, cm: 165, age: 40 });
if (Math.abs(femaleBmr - 1320) > 2) fail(`female BMR expected ~1320, got ${femaleBmr}`);

if (activityMultiplier("sedentary", 0) !== 1.2) fail("sedentary multiplier");
if (activityMultiplier("active", 5) < 1.6) fail("active + training should lift the multiplier");

const shares = slotShares("3_snacks");
const shareSum = Object.values(shares).reduce((a, b) => a + b, 0);
if (Math.abs(shareSum - 1) > 0.001) fail(`slot shares should sum to 1, got ${shareSum}`);

const anthro = { sex: "female", dob: "1968-03-12", heightCm: 165, bodyweightKg: 68 };
const lean = computeTargets({ anthro, prefs: { ...defaultPrefs(), goal: "lean", weightKg: 68 }, activityLevel: "light", trainingDays: 3 });
const bulk = computeTargets({ anthro, prefs: { ...defaultPrefs(), goal: "bulk", weightKg: 68 }, activityLevel: "light", trainingDays: 3 });
const maintain = computeTargets({ anthro, prefs: { ...defaultPrefs(), goal: "maintain", weightKg: 68 }, activityLevel: "light", trainingDays: 3 });
if (!lean.tdee || !lean.targetKcal || lean.targetKcal >= lean.tdee) fail("lean target should sit under TDEE");
if (!bulk.targetKcal || !bulk.tdee || bulk.targetKcal <= bulk.tdee) fail("bulk target should sit over TDEE");
if (!maintain.targetKcal || maintain.targetKcal !== maintain.tdee) fail("maintain target should match TDEE");

const missing = computeTargets({
  anthro: { sex: "female", dob: null, heightCm: null, bodyweightKg: null },
  prefs: defaultPrefs(),
});
if (missing.tdee != null) fail("missing anthropometrics should not invent a TDEE");
if (!missing.missing.includes("weight")) fail("should report missing weight");

if (nutritionComplete({})) fail("empty answers are not complete");
if (!nutritionComplete({ nutrition_goal: "lean" })) fail("nutrition_goal should complete prefs");

const vegan = derivePrefs({ nutrition_goal: "lean", diet_pattern: "vegan", food_avoid: ["nuts"], cook_time: "10" });
const breakfast = mealsForSlot("breakfast", vegan, lean);
if (breakfast.some((m) => m.avoid_flags.includes("nuts"))) fail("avoid nuts leaked into breakfast");
if (breakfast.some((m) => !m.diet.includes("vegan"))) fail("vegan filter leaked a non-vegan breakfast");
if (breakfast.length < 2) fail("vegan breakfast tray too thin");

for (const slot of SLOTS) {
  const n = MEALS.filter((m) => m.slot === slot.key).length;
  if (n < 6) fail(`${slot.key} only has ${n} meals`);
}

const snack = mealsForSlot("snack", defaultPrefs(), maintain);
if (snack.length < 8) fail("snack tray should stay generous");

const photoTotals = entryTotals([
  {
    id: "1",
    entry_date: "2026-09-16",
    slot: "lunch",
    kind: "log",
    meal_slug: "photo",
    servings: 1,
    source: "photo",
    custom_name: "Rice bowl",
    kcal: 520,
    protein_g: 32,
    carb_g: 58,
    fat_g: 14,
  },
]);
if (photoTotals.kcal !== 520 || photoTotals.protein !== 32) fail("photo entries must count in daily totals");

const favHit = matchingFavorite(
  [{ id: "f1", slot: "lunch", source: "photo", meal_slug: "photo", custom_name: "Rice bowl", kcal: 520, protein_g: 32, carb_g: 58, fat_g: 14, photo_path: null }],
  { id: "1", entry_date: "2026-09-16", slot: "lunch", kind: "log", meal_slug: "photo", servings: 1, source: "photo", custom_name: "Rice bowl", kcal: 520, protein_g: 32, carb_g: 58, fat_g: 14 },
);
if (favHit?.id !== "f1") fail("logged photo meal should match the favourite of the same name");

console.log("OK nutrition");
