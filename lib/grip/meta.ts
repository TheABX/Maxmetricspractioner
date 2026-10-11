export const GRIP_TEST = {
  testType: "GRIP_STRENGTH",
  displayName: "Grip Strength",
  laterality: "unilateral" as const,
  whatThisMeasures:
    "Measures maximal hand-grip force independently on each side. It is one of the simplest and strongest markers of overall capacity and longevity.",
  whyItMatters:
    "Grip is how you hold shopping, open jars, and catch yourself on a rail. Lower grip for your age is a signal to keep building whole-body strength — it is not a hand injury diagnosis.",
  protocolNotes:
    "Three maximal trials left and three right, standing, dynamometer at the second handle. Headline is best valid trial each side, not the average.",
} as const;
