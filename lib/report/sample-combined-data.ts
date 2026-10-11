import { interpretForcePlate } from "@/lib/force-plate/interpret";
import { deriveIsometric, type IsoTrialInput } from "@/lib/isometric/derive";
import { interpretIsometric } from "@/lib/isometric/interpret";
import { isometricTest } from "@/lib/isometric/tests";
import { calculateAsymmetry, DEFAULT_CV_REVIEW_PERCENT, symmetryLabel } from "@/lib/metrics/stats";
import { sampleScaleBodyComposition } from "@/lib/body-comp/scale";
import { GRIP_TEST } from "@/lib/grip/meta";
import { deriveMobility } from "@/lib/mobility/derive";
import { interpretMobility, interpretOverheadSquat } from "@/lib/mobility/interpret";
import { MOBILITY_BATTERY, formatMobilityUnit } from "@/lib/mobility/tests";
import type { CombinedReportData } from "@/lib/report/combined-pdf";

const BODYWEIGHT_KG = 80;
const FIRST = "Sam";

function trials(
  side: IsoTrialInput["side"],
  peaks: [number, number, number],
): IsoTrialInput[] {
  return peaks.map((peak_force, i) => ({
    side,
    trial_number: i + 1,
    peak_force,
    excluded: false,
  }));
}

function isoBlock(testType: string, inputs: IsoTrialInput[]) {
  const meta = isometricTest(testType)!;
  const derived = deriveIsometric(inputs, BODYWEIGHT_KG, DEFAULT_CV_REVIEW_PERCENT);
  const copy = interpretIsometric({ firstName: FIRST, testType, derived });
  const trialText = inputs
    .map((t) => {
      const best =
        t.side === "BILATERAL"
          ? t.peak_force === derived.best_bilateral_peak_force
          : t.side === "L"
            ? t.peak_force === derived.best_left_peak_force
            : t.peak_force === derived.best_right_peak_force;
      return `${t.side} T${t.trial_number} ${t.peak_force}${best ? "*" : ""}`;
    })
    .join(" · ");
  return {
    testType,
    name: meta.displayName,
    whatThisMeasures: meta.whatThisMeasures,
    whyItMatters: meta.whyItMatters,
    leftKg: derived.best_left_peak_force,
    rightKg: derived.best_right_peak_force,
    bilateralKg: derived.best_bilateral_peak_force,
    relative: derived.bilateral_relative_force,
    asymmetryPercent: derived.asymmetry_percent,
    weakerSide: derived.weaker_side === "L" ? "Left" : derived.weaker_side === "R" ? "Right" : null,
    symmetryStatus: derived.symmetry_status,
    strengthStatus: derived.population_strength_status,
    interpretation: copy.interpretation,
    programming: copy.programming,
    qc: derived.high_variability
      ? "High trial variability — practitioner review recommended. Mean is stored for QC, not as the headline."
      : "Trial variability acceptable. Headline is best valid peak, not the three-trial mean.",
    trials: trialText,
    derived,
    inputs,
  };
}

/** Illustrative 12-week retest figures. Not manufacturer data. */
export function buildSampleCombinedReport(): CombinedReportData {
  const fpPeak = 161.2;
  const fpLeft = 75.2;
  const fpRight = 86.0;
  const fpAsym = calculateAsymmetry(fpLeft, fpRight);
  const fpLeftContrib = (fpLeft / (fpLeft + fpRight)) * 100;
  const fpRightContrib = (fpRight / (fpLeft + fpRight)) * 100;
  const fpInterp = interpretForcePlate({
    clientFirstName: FIRST,
    movementName: "Isometric Mid-Thigh Pull",
    peakForceKg: fpPeak,
    relativePeakForce: fpPeak / BODYWEIGHT_KG,
    force200msKg: 102.4,
    rfdPeakNs: 2840,
    leftContribution: fpLeftContrib,
    rightContribution: fpRightContrib,
    asymmetryPercent: fpAsym.asymmetry_percent,
    weakerSide: fpAsym.weaker_side,
    referenceAvailable: false,
  });

  const global = isoBlock("ISO_GLOBAL_LOWER_BODY", trials("BILATERAL", [171.2, 178.4, 176.1]));
  const kneeExt = isoBlock("ISO_KNEE_EXTENSION", [
    ...trials("L", [46.2, 48.9, 48.1]),
    ...trials("R", [51.8, 52.6, 52.1]),
  ]);
  const kneeFlex = isoBlock("ISO_KNEE_FLEXION", [
    ...trials("L", [30.4, 31.8, 31.1]),
    ...trials("R", [32.6, 33.2, 32.9]),
  ]);
  const hipAbd = isoBlock("ISO_HIP_ABDUCTION", [
    ...trials("L", [19.8, 21.4, 20.9]),
    ...trials("R", [26.4, 27.1, 25.8]),
  ]);
  const upper = isoBlock("ISO_UPPER_PULL", [
    ...trials("L", [37.1, 38.7, 38.2]),
    ...trials("R", [39.8, 40.9, 40.4]),
  ]);

  const demoP: Record<string, { percentile?: number; leftPercentile?: number; rightPercentile?: number }> = {
    ISO_GLOBAL_LOWER_BODY: { percentile: 72 },
    ISO_KNEE_EXTENSION: { leftPercentile: 61, rightPercentile: 74 },
    ISO_KNEE_FLEXION: { leftPercentile: 58, rightPercentile: 62 },
    ISO_HIP_ABDUCTION: { leftPercentile: 34, rightPercentile: 66 },
    ISO_UPPER_PULL: { leftPercentile: 57, rightPercentile: 61 },
  };

  const isometric = [global, kneeExt, kneeFlex, hipAbd, upper].map((row) => ({
    testType: row.testType,
    name: row.name,
    whatThisMeasures: row.whatThisMeasures,
    whyItMatters: row.whyItMatters,
    leftKg: row.leftKg,
    rightKg: row.rightKg,
    bilateralKg: row.bilateralKg,
    relative: row.relative,
    asymmetryPercent: row.asymmetryPercent,
    weakerSide: row.weakerSide,
    symmetryStatus: row.symmetryStatus,
    strengthStatus: row.strengthStatus,
    interpretation: row.interpretation,
    programming: row.programming,
    qc: row.qc,
    trials: row.trials,
    ...demoP[row.testType],
  }));

  const gripDerived = deriveIsometric(
    [
      { side: "L", trial_number: 1, peak_force: 38.4, excluded: false },
      { side: "L", trial_number: 2, peak_force: 41.6, excluded: false },
      { side: "L", trial_number: 3, peak_force: 40.9, excluded: false },
      { side: "R", trial_number: 1, peak_force: 42.8, excluded: false },
      { side: "R", trial_number: 2, peak_force: 44.8, excluded: false },
      { side: "R", trial_number: 3, peak_force: 43.9, excluded: false },
    ],
    BODYWEIGHT_KG,
    DEFAULT_CV_REVIEW_PERCENT,
  );

  const refCaption = "Illustrative marker · males 50–54 · demo only until a real dataset is loaded.";

  function mobBlock(testKey: string, left: number, right: number) {
    const def = MOBILITY_BATTERY.find((t) => t.testKey === testKey)!;
    const derived = deriveMobility({
      trials: [],
      method: def.trialSelectionMethod,
      practitionerLeft: left,
      practitionerRight: right,
    });
    const copy = interpretMobility({ def, derived, leftRef: null, rightRef: null });
    return { def, derived, copy };
  }
  const ankle = mobBlock("MOBILITY_KNEE_TO_WALL", 8.2, 10.7);
  const aslr = mobBlock("MOBILITY_ASLR", 72, 81);
  const hipIr = mobBlock("MOBILITY_HIP_IR", 31, 39);
  const shoulder = mobBlock("MOBILITY_SHOULDER_FLEXION", 158, 169);
  const squatCopy = interpretOverheadSquat({
    depth_achieved: "PARALLEL",
    heel_contact: "BOTH_LOST",
    left_right_weight_shift: "NONE",
    knee_tracking: "NO_OBVIOUS_ISSUE",
    trunk_control: "FORWARD_LEAN_OBSERVED",
    overhead_arm_position: "MAINTAINED",
    pain_reported: "NO",
    practitioner_notes: null,
  });

  return {
    clientName: "Sam Smith",
    firstName: FIRST,
    dob: "14 June 1974",
    sex: "Male",
    assessmentDate: "10 December 2026",
    assessmentType: "twelve_week_retest",
    previousDate: "12 September 2026",
    sampleNotice:
      "ILLUSTRATIVE SAMPLE — invented figures and invented age/sex markers for layout review. Live reports will not show a percentile until a real dataset is loaded.",
    referenceCaption: refCaption,
    bodyComposition: sampleScaleBodyComposition(),
    force: {
      peakForceKg: fpPeak,
      relativePeakForce: fpPeak / BODYWEIGHT_KG,
      force200msKg: 102.4,
      leftKg: fpLeft,
      rightKg: fpRight,
      leftContribution: fpLeftContrib,
      rightContribution: fpRightContrib,
      asymmetryPercent: fpAsym.asymmetry_percent,
      weakerSide: fpAsym.weaker_side === "L" ? "Left" : "Right",
      whatThisMeasures:
        "Measures maximal lower-body force, force relative to bodyweight, how quickly force appears, and how the two sides share the work.",
      interpretation: fpInterp.summary,
      qc: "Trial quality: Acceptable. Best valid combined peak force is the headline result. Trials stored: 154.6 / 161.2* / 159.8 kg.",
      peakPercentile: 64,
      relativePercentile: 68,
      rapidPercentile: 55,
      technical: [
        { label: "Peak force (selected trial 2)", value: "161.20 kg" },
        { label: "Force @100 / 200 / 300 ms", value: "78.4 / 102.4 / 128.6 kg" },
        { label: "RFD peak / 100 / 200 / 300", value: "2840 / 1960 / 1680 / 1420 N/s" },
        { label: "Impulse peak / 100 / 200 / 300", value: "412 / 38 / 96 / 168" },
        { label: "Time to peak (stored, not headline)", value: "412 ms" },
        { label: "Mean force (stored, not headline)", value: "118.4 kg" },
      ],
    },
    isometric,
    grip: {
      leftKg: gripDerived.best_left_peak_force,
      rightKg: gripDerived.best_right_peak_force,
      asymmetryPercent: gripDerived.asymmetry_percent,
      weakerSide: gripDerived.weaker_side === "L" ? "Left" : gripDerived.weaker_side === "R" ? "Right" : null,
      symmetryStatus: gripDerived.symmetry_status,
      whatThisMeasures: GRIP_TEST.whatThisMeasures,
      whyItMatters: GRIP_TEST.whyItMatters,
      interpretation: `Grip: left ${gripDerived.best_left_peak_force?.toFixed(1)} kg, right ${gripDerived.best_right_peak_force?.toFixed(1)} kg.`,
      qc: "Headline is best valid squeeze each side, not the three-trial mean.",
      trials: "L T1 38.4 · L T2 41.6* · L T3 40.9 · R T1 42.8 · R T2 44.8* · R T3 43.9",
      leftPercentile: 58,
      rightPercentile: 67,
      relativeBest: (gripDerived.best_right_peak_force ?? 0) / BODYWEIGHT_KG,
      dominantHand: "Right",
    },
    mobility: {
      tests: [ankle, aslr, hipIr, shoulder].map((row) => ({
        testKey: row.def.testKey,
        name: row.def.displayName,
        clientLabel: row.def.clientLabel,
        unit: row.def.unit,
        whatThisMeasures: row.def.whatThisMeasures,
        whyItMatters: row.def.whyItMatters,
        left: row.derived.left_value,
        right: row.derived.right_value,
        absoluteDifference: row.derived.absolute_difference,
        percentageDifference: row.derived.percentage_difference,
        lowerSide:
          row.derived.lower_side === "L"
            ? "Left"
            : row.derived.lower_side === "R"
              ? "Right"
              : row.derived.lower_side === "EQUAL"
                ? "Equal"
                : null,
        symmetryStatus: row.derived.symmetry_status,
        leftPercentile: null,
        rightPercentile: null,
        leftCategory: null,
        rightCategory: null,
        leftMean: null,
        rightMean: null,
        referenceAvailable: false,
        interpretation: row.copy.interpretation,
        programming: row.copy.programming,
      })),
      squat: {
        interpretation: squatCopy.interpretation,
        programming: squatCopy.programming,
        depth: "PARALLEL",
        heels: "BOTH_LOST",
        shift: "NONE",
        knees: "NO_OBVIOUS_ISSUE",
        trunk: "FORWARD_LEAN_OBSERVED",
        arms: "MAINTAINED",
        pain: "NO",
        notes: "",
      },
    },
    findings: [
      `Force-plate selected trial showed ${fpAsym.asymmetry_percent?.toFixed(1)}% peak-force asymmetry, with lower force on the left. This is a contribution finding, not a population-strength rating.`,
      `Knee Extension: ${kneeExt.asymmetryPercent?.toFixed(1)}% side-to-side difference (${symmetryLabel(kneeExt.symmetryStatus)}). Improved from the baseline test.`,
      `Hip Abduction: ${hipAbd.asymmetryPercent?.toFixed(1)}% side-to-side difference (${symmetryLabel(hipAbd.symmetryStatus)}). This is the main regional symmetry priority for the next block.`,
      `Grip: left ${gripDerived.best_left_peak_force?.toFixed(1)} kg, right ${gripDerived.best_right_peak_force?.toFixed(1)} kg. A strong longevity marker, stored as best valid trial each side.`,
      ankle.copy.interpretation,
      squatCopy.interpretation,
    ],
    priorities: [hipAbd, kneeExt, kneeFlex, upper, global].map((t) => t.programming).concat([ankle.copy.programming]),
    changes: [
      {
        label: "Knee Extension — Left",
        from: "42.8 kg",
        to: "48.9 kg",
        change: "+14.3% ↑",
      },
      {
        label: "Knee Extension L:R asymmetry",
        from: "16.6%",
        to: `${kneeExt.asymmetryPercent?.toFixed(1)}%`,
        change: `${(16.6 - (kneeExt.asymmetryPercent ?? 0)).toFixed(1)} percentage points ↓`,
      },
      {
        label: "Grip — Right",
        from: "42.1 kg",
        to: "44.8 kg",
        change: "+6.4% ↑",
      },
      {
        label: "Ankle Mobility — Left",
        from: formatMobilityUnit("cm", 7.8),
        to: formatMobilityUnit("cm", 8.2),
        change: "+0.4 cm",
      },
      {
        label: "Ankle Mobility L:R difference",
        from: "3.1 cm",
        to: "2.5 cm",
        change: "-0.6 cm",
      },
      {
        label: "Shoulder Flexion — Left",
        from: "154°",
        to: "158°",
        change: "+4°",
      },
    ],
    missingModules: ["Cardiorespiratory Fitness"],
  };
}

export const SAMPLE_TRIAL_TABLES = {
  bodyweightKg: BODYWEIGHT_KG,
  forcePlate: {
    movement: "Isometric Mid-Thigh Pull",
    trials: [
      { trial: 1, combined: 154.6, left: 72.1, right: 82.5 },
      { trial: 2, combined: 161.2, left: 75.2, right: 86.0, best: true },
      { trial: 3, combined: 159.8, left: 74.8, right: 85.0 },
    ],
  },
  isometric: {
    "Global Lower-Body Isometric": { bilateral: [171.2, 178.4, 176.1] },
    "Knee Extension": { left: [46.2, 48.9, 48.1], right: [51.8, 52.6, 52.1] },
    "Knee Flexion": { left: [30.4, 31.8, 31.1], right: [32.6, 33.2, 32.9] },
    "Hip Abduction": { left: [19.8, 21.4, 20.9], right: [26.4, 27.1, 25.8] },
    "Upper-Body Pull": { left: [37.1, 38.7, 38.2], right: [39.8, 40.9, 40.4] },
  },
};
