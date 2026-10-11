export const ISOMETRIC_BATTERY = [
  {
    testType: "ISO_GLOBAL_LOWER_BODY",
    displayName: "Global Lower-Body Isometric",
    laterality: "bilateral" as const,
    bodyRegions: ["lower_body_global"],
    whatThisMeasures:
      "Measures maximal lower-body force in a standardised isometric position. It describes overall force capacity, not a single muscle.",
    whyItMatters:
      "This is your overall lower-body strength. It sits behind walking, hiking, standing from the floor, and getting through a long day on your feet.",
    protocolNotes: "Three bilateral maximal trials. Primary result is the highest valid peak-force trial.",
  },
  {
    testType: "ISO_KNEE_EXTENSION",
    displayName: "Knee Extension",
    laterality: "unilateral" as const,
    bodyRegions: ["left_anterior_thigh", "right_anterior_thigh"],
    whatThisMeasures:
      "Measures maximal knee-extensor force independently on each side, allowing assessment of regional strength and side-to-side differences.",
    whyItMatters:
      "This is front-of-thigh strength. You use it to stand from a chair, climb stairs, and squat to pick something up.",
    protocolNotes: "Three maximal trials left and three right. Report best valid left and best valid right.",
  },
  {
    testType: "ISO_KNEE_FLEXION",
    displayName: "Knee Flexion",
    laterality: "unilateral" as const,
    bodyRegions: ["left_posterior_thigh", "right_posterior_thigh"],
    whatThisMeasures:
      "Measures maximal knee-flexor force independently on each side. This is regional posterior-thigh force, not a medical diagnosis.",
    whyItMatters:
      "This is back-of-thigh strength. It helps you slow down, control a stride, and stay steady walking downhill.",
    protocolNotes: "Three maximal trials left and three right. Report best valid left and best valid right.",
  },
  {
    testType: "ISO_HIP_ABDUCTION",
    displayName: "Hip Abduction",
    laterality: "unilateral" as const,
    bodyRegions: ["left_hip", "right_hip"],
    whatThisMeasures:
      "Measures maximal lateral-hip force independently on each side, allowing regional hip strength and side-to-side comparison.",
    whyItMatters:
      "This is side-hip strength. It helps you stand on one leg, get in and out of a car, and walk without the hip dropping.",
    protocolNotes: "Three maximal trials left and three right. Report best valid left and best valid right.",
  },
  {
    testType: "ISO_UPPER_PULL",
    displayName: "Upper-Body Pull",
    laterality: "unilateral" as const,
    bodyRegions: ["left_upper_arm", "right_upper_arm", "left_upper_back", "right_upper_back"],
    whatThisMeasures:
      "Measures maximal upper-body pulling force independently on each side. Grip is assessed separately and is not duplicated here.",
    whyItMatters:
      "This is pulling strength. You use it to carry bags, open a heavy door, and lift something toward you. Grip is tested separately.",
    protocolNotes: "Three maximal trials left and three right. Report best valid left and best valid right.",
  },
] as const;

export type IsometricTestType = (typeof ISOMETRIC_BATTERY)[number]["testType"];

export function isometricTest(testType: string) {
  return ISOMETRIC_BATTERY.find((t) => t.testType === testType);
}
