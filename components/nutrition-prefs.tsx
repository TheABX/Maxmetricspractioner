import { labelFor } from "@/lib/questionnaire/schema";
import { NUTRITION_SECTIONS } from "@/lib/nutrition/questionnaire";
import type { NutritionPrefs } from "@/lib/nutrition/types";

const CHIP_KEYS = [
  "nutrition_goal",
  "diet_pattern",
  "food_avoid",
  "meals_per_day",
  "cook_time",
  "breakfast_style",
  "protein_powder",
];

export function NutritionPrefChips({
  answers,
  prefs,
}: {
  answers: Record<string, unknown>;
  prefs: NutritionPrefs;
}) {
  const fields = NUTRITION_SECTIONS.flatMap((s) => s.fields);
  const chips = CHIP_KEYS.map((key) => {
    const field = fields.find((f) => f.key === key);
    if (!field) return null;
    const value = labelFor(field, answers[key]);
    if (!value || value === "—") return null;
    return { key, label: field.label, value };
  }).filter(Boolean) as { key: string; label: string; value: string }[];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c.key} className="rounded-full border border-[var(--line)] bg-white px-2.5 py-0.5 font-sans text-[11px]">
            <span className="uppercase tracking-wide text-[var(--muted)]">{shortLabel(c.key)} </span>
            {c.value}
          </span>
        ))}
      </div>
      {(prefs.loves || prefs.wont || prefs.avoidDetail) && (
        <div className="space-y-1 font-sans text-sm text-[var(--muted)]">
          {prefs.loves && <p>Likes: {prefs.loves}</p>}
          {prefs.wont && <p>Will not eat: {prefs.wont}</p>}
          {prefs.avoidDetail && <p>Restrictions: {prefs.avoidDetail}</p>}
        </div>
      )}
    </div>
  );
}

function shortLabel(key: string) {
  return (
    {
      nutrition_goal: "Goal",
      diet_pattern: "Diet",
      food_avoid: "Avoid",
      meals_per_day: "Pattern",
      cook_time: "Cook",
      breakfast_style: "Breakfast",
      protein_powder: "Powder",
    }[key] ?? key
  );
}
