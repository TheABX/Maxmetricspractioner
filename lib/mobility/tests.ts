export const TRIAL_SELECTION_METHODS = [
  "BEST",
  "MEAN",
  "MEDIAN",
  "FINAL",
  "SINGLE",
  "PRACTITIONER_SELECTED",
] as const;

export type TrialSelectionMethod = (typeof TRIAL_SELECTION_METHODS)[number];

export type MobilityTestDefinition = {
  testKey: string;
  displayName: string;
  category: "quantitative" | "observational";
  unit: string | null;
  laterality: "unilateral" | "bilateral";
  bodyRegions: string[];
  trialSelectionMethod: TrialSelectionMethod;
  higherIsFavourable: boolean;
  protocolId: string;
  protocolVersion: string;
  testingPosition: string | null;
  hipAngle: string | null;
  measurementMethod: string | null;
  whatThisMeasures: string;
  whyItMatters: string;
  clientLabel: string;
};

/**
 * V1 battery. Active tests can later come from mobility_test_definitions.
 * Adding or retiring a test should not require a new results table.
 */
export const MOBILITY_BATTERY: MobilityTestDefinition[] = [
  {
    testKey: "MOBILITY_KNEE_TO_WALL",
    displayName: "Ankle Mobility (Knee-to-Wall)",
    clientLabel: "Ankle Mobility",
    category: "quantitative",
    unit: "cm",
    laterality: "unilateral",
    bodyRegions: ["left_ankle", "right_ankle"],
    trialSelectionMethod: "PRACTITIONER_SELECTED",
    higherIsFavourable: true,
    protocolId: "MOB_KNEE_TO_WALL_V1",
    protocolVersion: "v1",
    testingPosition: "weight_bearing_lunge",
    hipAngle: null,
    measurementMethod: "toe-to-wall distance with heel down",
    whatThisMeasures:
      "Measures weight-bearing ankle dorsiflexion as the distance from the great toe to the wall while the knee contacts the wall and the heel stays down.",
    whyItMatters:
      "Ankle range shows up in stairs, squatting, and walking. A lower side is a measurement, not a diagnosis of injury.",
  },
  {
    testKey: "MOBILITY_ASLR",
    displayName: "Active Straight-Leg Raise",
    clientLabel: "Straight-Leg Raise",
    category: "quantitative",
    unit: "deg",
    laterality: "unilateral",
    bodyRegions: ["left_posterior_chain", "right_posterior_chain"],
    trialSelectionMethod: "PRACTITIONER_SELECTED",
    higherIsFavourable: true,
    protocolId: "MOB_ASLR_V1",
    protocolVersion: "v1",
    testingPosition: "supine",
    hipAngle: null,
    measurementMethod: "inclinometer or goniometer",
    whatThisMeasures:
      "Measures active hip-flexion / posterior-chain mobility under a standardised straight-leg-raise protocol. Multiple structures can influence the angle.",
    whyItMatters:
      "This is how far you can raise a straight leg while staying in the test position. It is not an isolated hamstring diagnosis.",
  },
  {
    testKey: "MOBILITY_HIP_IR",
    displayName: "Hip Internal Rotation",
    clientLabel: "Hip Internal Rot.",
    category: "quantitative",
    unit: "deg",
    laterality: "unilateral",
    bodyRegions: ["left_hip", "right_hip"],
    trialSelectionMethod: "PRACTITIONER_SELECTED",
    higherIsFavourable: true,
    protocolId: "MOB_HIP_IR_V1",
    protocolVersion: "v1",
    testingPosition: "seated",
    hipAngle: "hip flexed ~90°",
    measurementMethod: "goniometer",
    whatThisMeasures:
      "Measures hip internal-rotation range in the stored testing position. Direct retest comparison needs a matching protocol.",
    whyItMatters:
      "Hip rotation range is one part of how you sit, turn, and squat. A difference between sides is not automatically a problem.",
  },
  {
    testKey: "MOBILITY_SHOULDER_FLEXION",
    displayName: "Shoulder Flexion",
    clientLabel: "Shoulder Flexion",
    category: "quantitative",
    unit: "deg",
    laterality: "unilateral",
    bodyRegions: ["left_shoulder", "right_shoulder"],
    trialSelectionMethod: "PRACTITIONER_SELECTED",
    higherIsFavourable: true,
    protocolId: "MOB_SHOULDER_FLEX_V1",
    protocolVersion: "v1",
    testingPosition: "standing_or_supine_active",
    hipAngle: null,
    measurementMethod: "goniometer",
    whatThisMeasures: "Measures active shoulder flexion range independently on each side.",
    whyItMatters:
      "Shoulder flexion is how far you can reach overhead. It matters for shelves, hanging, and overhead work — it is not a diagnosis.",
  },
];

export const OVERHEAD_SQUAT = {
  testKey: "MOBILITY_OVERHEAD_SQUAT",
  displayName: "Overhead Squat Observation",
  category: "observational" as const,
  protocolId: "MOB_OHS_OBS_V1",
  protocolVersion: "v1",
  whatThisMeasures:
    "Structured movement observation of a deep / overhead squat. This is not a longevity biomarker and is not assigned a population percentile.",
  whyItMatters:
    "Observations may help programming when read together with measured ankle, hip, and shoulder results. They are not a diagnosis.",
};

export const SQUAT_OPTIONS = {
  depth_achieved: ["FULL", "PARALLEL", "ABOVE_PARALLEL", "NOT_COMPLETED"],
  heel_contact: ["BOTH", "LEFT_LOST", "RIGHT_LOST", "BOTH_LOST"],
  left_right_weight_shift: ["NONE", "LEFT", "RIGHT"],
  knee_tracking: ["NO_OBVIOUS_ISSUE", "LEFT_OBSERVATION", "RIGHT_OBSERVATION", "BILATERAL_OBSERVATION"],
  trunk_control: ["NO_OBVIOUS_ISSUE", "FORWARD_LEAN_OBSERVED", "OTHER"],
  overhead_arm_position: ["MAINTAINED", "NOT_MAINTAINED"],
  pain_reported: ["NO", "YES"],
} as const;

export function mobilityTest(testKey: string) {
  return MOBILITY_BATTERY.find((t) => t.testKey === testKey);
}

export function formatMobilityUnit(unit: string | null | undefined, value: number | null) {
  if (value == null) return "—";
  if (unit === "deg") return `${value.toFixed(0)}°`;
  if (unit === "cm") return `${value.toFixed(1)} cm`;
  return value.toFixed(1);
}
