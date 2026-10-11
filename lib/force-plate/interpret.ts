import { ASYMMETRY_PROTOCOL_TARGET_PERCENT, TRIAL_CONSISTENCY_CV_REVIEW_PERCENT } from "./derive";
import { resolveMovement } from "./movements";

export type InterpretationInput = {
  clientFirstName: string;
  movementName: string;
  peakForceKg: number | null;
  relativePeakForce: number | null;
  force200msKg: number | null;
  rfdPeakNs: number | null;
  leftContribution: number | null;
  rightContribution: number | null;
  asymmetryPercent: number | null;
  weakerSide: "L" | "R" | null;
  referenceAvailable: boolean;
};

export type Interpretation = {
  peakForce: string;
  symmetry: string;
  rapidForce: string;
  summary: string;
  whyItMatters: string;
  whatWeTested: string;
  workOn: string[];
  bodyMap: {
    globalLowerBody: "green" | "amber" | "red" | "neutral";
    leftLowerLimb: "green" | "amber" | "red" | "neutral";
    rightLowerLimb: "green" | "amber" | "red" | "neutral";
    symmetry: "green" | "amber" | "red" | "neutral";
    note: string;
  };
};

function symmetryBand(asymmetry: number | null) {
  if (asymmetry === null) return { label: "we could not compare sides", colour: "neutral" as const };
  if (asymmetry <= ASYMMETRY_PROTOCOL_TARGET_PERCENT) {
    return { label: "your left and right sides shared the work fairly evenly", colour: "green" as const };
  }
  if (asymmetry <= 15) {
    return { label: "one side did a little more of the work", colour: "amber" as const };
  }
  return { label: "one side did clearly more of the work", colour: "red" as const };
}

export function interpretForcePlate(input: InterpretationInput): Interpretation {
  const name = input.clientFirstName || "You";
  const movement = resolveMovement(input.movementName);
  const sym = symmetryBand(input.asymmetryPercent);
  const left = input.leftContribution?.toFixed(0) ?? "—";
  const right = input.rightContribution?.toFixed(0) ?? "—";
  const weaker =
    input.weakerSide === "L" ? "left" : input.weakerSide === "R" ? "right" : null;
  const rapidShare =
    input.force200msKg !== null && input.peakForceKg
      ? (input.force200msKg / input.peakForceKg) * 100
      : null;

  const peakForce = input.relativePeakForce
    ? `You produced ${input.relativePeakForce.toFixed(2)} times your bodyweight (${input.peakForceKg?.toFixed(1) ?? "—"} kg). That is a simple way to describe your strength today. We will compare it with your next test rather than guessing a population ranking.`
    : `Your highest force today was ${input.peakForceKg?.toFixed(1) ?? "—"} kg. We need a session bodyweight to say how that compares with your own size.`;

  const symmetry =
    input.asymmetryPercent === null
      ? "We could not compare left and right from this file."
      : `${sym.label}. Left contributed ${left}% and right contributed ${right}% (${input.asymmetryPercent.toFixed(1)}% difference). A difference at or under ${ASYMMETRY_PROTOCOL_TARGET_PERCENT}% is our in-house target, not a medical diagnosis.`;

  const rapidForce =
    input.force200msKg === null
      ? "We did not have a clean 200 ms force reading on the selected trial."
      : `In the first 200 milliseconds you reached ${input.force200msKg.toFixed(1)} kg${
          rapidShare !== null ? ` — about ${rapidShare.toFixed(0)}% of your peak force` : ""
        }. That is about how quickly the force showed up, not how strong you are overall.`;

  const workOn: string[] = [];
  if (input.asymmetryPercent !== null && input.asymmetryPercent > ASYMMETRY_PROTOCOL_TARGET_PERCENT && weaker) {
    workOn.push(
      `Help the ${weaker} side contribute more during two-legged work. Think even pushing, not “a weak ${weaker} quad”.`,
    );
  }
  if (rapidShare !== null && rapidShare < 45) {
    workOn.push(
      "Practise producing force quickly, not only as hard as possible. Short, sharp lower-body efforts are a useful next step.",
    );
  }
  if (input.relativePeakForce !== null) {
    workOn.push(
      "Keep building whole-body strength so the next retest shows a higher force for your bodyweight.",
    );
  }
  if (workOn.length === 0) {
    workOn.push("Repeat this test later so we can see what changed. Today is your baseline.");
  }

  const summary = `${name}, here is the simple version. ${movement.plainWhatWeTested} ${
    input.relativePeakForce
      ? `Your best effort was ${input.relativePeakForce.toFixed(2)} times your bodyweight.`
      : `Your best effort was ${input.peakForceKg?.toFixed(1) ?? "—"} kg.`
  } ${
    input.asymmetryPercent !== null
      ? `Left and right split the work ${left}:${right}.`
      : ""
  }`.replace(/\s+/g, " ").trim();

  const limbColour = (side: "L" | "R") => {
    if (input.asymmetryPercent === null) return "neutral" as const;
    const status =
      input.asymmetryPercent <= 10 ? "green" : input.asymmetryPercent <= 20 ? "amber" : "red";
    if (status === "green") return "green" as const;
    if (weaker === (side === "L" ? "left" : "right")) return status;
    return "green" as const;
  };

  return {
    peakForce,
    symmetry,
    rapidForce,
    summary,
    whyItMatters:
      "Being able to produce force with your legs helps you walk with confidence, get up from a chair, climb stairs, and stay capable as you age. Speed of force matters when you need to catch yourself or change direction.",
    whatWeTested: movement.plainWhatWeTested,
    workOn,
    bodyMap: {
      globalLowerBody: input.peakForceKg ? "green" : "neutral",
      leftLowerLimb: limbColour("L"),
      rightLowerLimb: limbColour("R"),
      symmetry: sym.colour,
      note:
        weaker && input.asymmetryPercent && input.asymmetryPercent > ASYMMETRY_PROTOCOL_TARGET_PERCENT
          ? `The ${weaker} lower limb contributed less during this two-sided test. That is a contribution finding, not a diagnosis of a single muscle.`
          : "Both lower limbs contributed during this two-sided test.",
    },
  };
}

export function consistencyStatus(cvPercent: number | null) {
  if (cvPercent === null) return { label: "Insufficient trials", review: false };
  if (cvPercent > TRIAL_CONSISTENCY_CV_REVIEW_PERCENT) {
    return { label: "Review trials — high variability", review: true };
  }
  return { label: "Acceptable", review: false };
}
