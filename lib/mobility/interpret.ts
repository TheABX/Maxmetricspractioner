import { mobilityTest, type MobilityTestDefinition } from "./tests";
import type { MobilityDerived } from "./derive";
import type { MobilityReferenceHit } from "./reference";
import { symmetryLabel } from "@/lib/metrics/stats";

function sideWord(side: MobilityDerived["lower_side"]) {
  if (side === "L") return "left";
  if (side === "R") return "right";
  return null;
}

function fmt(value: number | null, unit: string | null) {
  if (value == null) return "—";
  if (unit === "deg") return `${Math.round(value)}°`;
  if (unit === "cm") return `${value.toFixed(1)} cm`;
  return value.toFixed(1);
}

export function interpretMobility(options: {
  def: MobilityTestDefinition;
  derived: MobilityDerived;
  leftRef: MobilityReferenceHit | null;
  rightRef: MobilityReferenceHit | null;
  notes?: string | null;
}) {
  const { def, derived, leftRef, rightRef } = options;
  const unit = def.unit;
  const lower = sideWord(derived.lower_side);
  const abs =
    derived.absolute_difference != null
      ? unit === "deg"
        ? `${Math.round(derived.absolute_difference)}°`
        : `${derived.absolute_difference.toFixed(1)} ${unit}`
      : null;

  const lr =
    derived.lower_side === "EQUAL"
      ? `${def.displayName} was similar on both sides.`
      : lower
        ? `${def.displayName} range was lower on the ${lower} than the ${lower === "left" ? "right" : "left"}${abs ? ` (${abs})` : ""}.`
        : `${def.displayName}: left ${fmt(derived.left_value, unit)}, right ${fmt(derived.right_value, unit)}.`;

  const popBits: string[] = [];
  if (leftRef?.category) popBits.push(`Left: ${leftRef.category.replaceAll("_", " ")}`);
  if (rightRef?.category) popBits.push(`Right: ${rightRef.category.replaceAll("_", " ")}`);
  if (leftRef?.mean != null && !leftRef.category) {
    popBits.push(`Left compared with a loaded mean of ${fmt(leftRef.mean, unit)}`);
  }
  const pop =
    leftRef || rightRef
      ? popBits.length
        ? ` ${popBits.join(". ")}.`
        : ""
      : " No age/sex reference is shown because a matching validated dataset is not loaded.";

  const interpretation = `${lr}${pop} This is not a diagnosis of injury or dysfunction.`;

  const programming =
    derived.symmetry_status === "priority" && lower
      ? `${def.clientLabel} on the ${lower} may be considered a priority during the next training block. Keep the other side moving.`
      : derived.symmetry_status === "monitor" && lower
        ? `Monitor ${def.clientLabel.toLowerCase()} on the ${lower}. A difference is present, but it is not automatically a problem.`
        : `No specific ${def.clientLabel.toLowerCase()} intervention is required from this result; maintain current capacity and retest.`;

  return {
    whatThisMeasures: def.whatThisMeasures,
    whyItMatters: def.whyItMatters,
    interpretation,
    programming,
    qc: `Headline uses ${derived.trial_selection_method.replaceAll("_", " ").toLowerCase()} — not an automatic best-of-three. ${
      derived.symmetry_status !== "unavailable"
        ? `Side-to-side: ${symmetryLabel(derived.symmetry_status)}.`
        : ""
    }`.trim(),
  };
}

export function interpretByTestKey(
  testKey: string,
  derived: MobilityDerived,
  leftRef: MobilityReferenceHit | null,
  rightRef: MobilityReferenceHit | null,
) {
  const def = mobilityTest(testKey);
  if (!def) return null;
  return interpretMobility({ def, derived, leftRef, rightRef });
}

export function interpretOverheadSquat(obs: {
  depth_achieved: string | null;
  heel_contact: string | null;
  left_right_weight_shift: string | null;
  knee_tracking: string | null;
  trunk_control: string | null;
  overhead_arm_position: string | null;
  pain_reported: string | null;
  practitioner_notes: string | null;
}) {
  const bits: string[] = [];
  if (obs.heel_contact === "LEFT_LOST" || obs.heel_contact === "RIGHT_LOST" || obs.heel_contact === "BOTH_LOST") {
    const side =
      obs.heel_contact === "BOTH_LOST"
        ? "Both heels"
        : obs.heel_contact === "LEFT_LOST"
          ? "The left heel"
          : "The right heel";
    bits.push(`${side} lifted during the overhead squat. Consider the ankle mobility results alongside this observation.`);
  }
  if (obs.left_right_weight_shift === "LEFT" || obs.left_right_weight_shift === "RIGHT") {
    bits.push(`Weight shift toward the ${obs.left_right_weight_shift.toLowerCase()} was observed. This is an observation, not a diagnosis.`);
  }
  if (obs.overhead_arm_position === "NOT_MAINTAINED") {
    bits.push("Overhead arm position was not maintained. Read this with the shoulder flexion measurements.");
  }
  if (obs.pain_reported === "YES") {
    bits.push("Pain was reported. Do not treat this observation as a diagnosis; follow the clinic’s usual pathway.");
  }
  if (!bits.length) {
    bits.push("Overhead squat observations were recorded. They are not scored as a longevity biomarker.");
  }
  return {
    interpretation: bits.join(" "),
    programming:
      obs.heel_contact && obs.heel_contact !== "BOTH"
        ? "If ankle measurements also show a lower side, ankle dorsiflexion capacity may be a programming priority."
        : "No squat-based correction is auto-assigned from this observation alone.",
  };
}
