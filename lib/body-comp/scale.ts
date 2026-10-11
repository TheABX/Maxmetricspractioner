/** Scale / BIA body composition — not a clinical DEXA scan. */
export type ScaleBodyComposition = {
  method: "bia_scale";
  deviceLabel: string;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  bodyFatPercent: number | null;
  fatMassKg: number | null;
  muscleMassKg: number | null;
  boneMassKg: number | null;
  bodyWaterPercent: number | null;
  visceralFatIndex: number | null;
  musclePercentile?: number | null;
  fatPercentile?: number | null;
  whyItMatters: {
    weight: string;
    bodyFat: string;
    muscle: string;
    visceral: string;
    water: string;
    bone: string;
  };
  disclaimer: string;
  interpretation: string;
  changes?: { label: string; from: string; to: string; change: string }[];
};

export const SCALE_BODY_COMP_DISCLAIMER =
  "This is a standing scale estimate (bioelectrical impedance), not a hospital DEXA scan. Hydration, food, and time of day move the numbers. Use it to track change under the same conditions, not as a medical diagnosis of bone or fat distribution.";

export function sampleScaleBodyComposition(): ScaleBodyComposition {
  return {
    method: "bia_scale",
    deviceLabel: "Multi-frequency body-composition scale",
    heightCm: 178,
    weightKg: 80.0,
    bmi: 25.2,
    bodyFatPercent: 22.4,
    fatMassKg: 17.9,
    muscleMassKg: 36.8,
    boneMassKg: 3.1,
    bodyWaterPercent: 55.1,
    visceralFatIndex: 8,
    musclePercentile: 61,
    fatPercentile: 46,
    whyItMatters: {
      weight:
        "Your bodyweight on the day. Useful for loading calculations, but it does not tell you what the weight is made of.",
      bodyFat:
        "The share of your weight the scale estimates as fat. It is a trend tool. Lower is not automatically better if muscle is being lost.",
      muscle:
        "Estimated skeletal muscle. More muscle supports strength, blood-sugar control, and staying capable with age.",
      visceral:
        "A scale index of fat around the organs. Higher readings are a reason to keep training and nutrition honest — not a CT diagnosis.",
      water:
        "Estimated body water. A sudden jump or drop often means hydration, not a real change in fat or muscle.",
      bone:
        "A scale estimate of bone mineral, not a DEXA bone-density T-score. Do not treat this as an osteoporosis result.",
    },
    disclaimer: SCALE_BODY_COMP_DISCLAIMER,
    interpretation:
      "Most of today’s weight is lean tissue. Fat mass is in a workable range for a man in his fifties. Muscle is the lever we can still improve. The visceral index is something to watch, not panic about.",
    changes: [
      { label: "Weight", from: "81.4 kg", to: "80.0 kg", change: "−1.4 kg" },
      { label: "Body fat", from: "24.1%", to: "22.4%", change: "−1.7 pts" },
      { label: "Muscle mass", from: "35.6 kg", to: "36.8 kg", change: "+1.2 kg ↑" },
    ],
  };
}
