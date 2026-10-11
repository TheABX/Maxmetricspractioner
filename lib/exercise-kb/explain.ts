import { pretty, type ExerciseRecord } from "./types";

/** Practitioner-facing: why the selection engine might (or might not) pick this tool. Not a client score. */
export function engineMayChoose(ex: ExerciseRecord) {
  const reasons: string[] = [];
  const limits: string[] = [];
  if (!ex.active) limits.push("Inactive — kept for history, excluded from automatic selection.");
  if (!ex.practitioner_approved) limits.push("Not practitioner-approved — automatic selection will not use it.");
  if (!ex.ai_selection_enabled) limits.push("AI selection is off — available for manual programming only.");
  if (ex.active && ex.practitioner_approved && ex.ai_selection_enabled) {
    reasons.push("Eligible for automatic Layer 4 selection.");
  }
  if (ex.training_qualities.length) reasons.push(`Trains ${ex.training_qualities.slice(0, 4).map(pretty).join(", ")}.`);
  if (ex.primary_regions.length) reasons.push(`Primary regions: ${ex.primary_regions.map(pretty).join(", ")}.`);
  reasons.push(`Uses ${ex.equipment_required.map(pretty).join(" / ") || "no listed equipment"}.`);
  reasons.push(`${pretty(ex.laterality)} — ${ex.laterality === "UNILATERAL" ? "each side can be trained independently." : "bilateral or shared-load option."}`);
  reasons.push(`Foundation suitability: ${pretty(ex.foundation_suitability)}.`);
  reasons.push(`Difficulty ${pretty(ex.difficulty_level)}, technical complexity ${pretty(ex.technical_complexity)}, stability ${pretty(ex.stability_requirement)}.`);
  if (ex.hypertrophy_suitability === "HIGH" || ex.hypertrophy_suitability === "VERY_HIGH") reasons.push("High hypertrophy suitability.");
  if (ex.strength_suitability === "HIGH" || ex.strength_suitability === "VERY_HIGH") reasons.push("High strength suitability.");
  if (ex.power_suitability === "HIGH" || ex.power_suitability === "VERY_HIGH") reasons.push("High power suitability.");
  if (ex.time_efficiency === "HIGH") reasons.push("Time-efficient for short sessions.");
  if (ex.systemic_fatigue_cost === "HIGH" || ex.systemic_fatigue_cost === "VERY_HIGH") limits.push("High systemic fatigue cost — ranked down when tolerance or sport load is high.");
  if (ex.ankle_mobility_requirement === "HIGH") limits.push("High ankle-mobility demand — ranked down when ankle mobility is limited.");
  if (ex.stability_requirement === "VERY_HIGH" || ex.stability_requirement === "HIGH") limits.push("High stability demand — ranked down when movement competency is low.");
  if (ex.technical_complexity === "HIGH") limits.push("High technical complexity — complexity must earn its place.");
  return { reasons, limits };
}
