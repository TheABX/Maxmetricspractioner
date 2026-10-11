import {
  calculateAsymmetry,
  coefficientOfVariation,
  mean,
  selectBestValidIndex,
  symmetryStatus,
  type SymmetryStatus,
} from "@/lib/metrics/stats";

export type IsoTrialInput = {
  side: "L" | "R" | "BILATERAL";
  trial_number: number;
  peak_force: number | null;
  excluded: boolean;
};

export type IsoDerived = {
  best_left_peak_force: number | null;
  best_right_peak_force: number | null;
  best_bilateral_peak_force: number | null;
  mean_left_peak_force: number | null;
  mean_right_peak_force: number | null;
  mean_bilateral_peak_force: number | null;
  cv_left_percent: number | null;
  cv_right_percent: number | null;
  cv_bilateral_percent: number | null;
  high_variability: boolean;
  asymmetry_percent: number | null;
  absolute_difference: number | null;
  stronger_side: "L" | "R" | null;
  weaker_side: "L" | "R" | null;
  symmetry_status: SymmetryStatus;
  population_strength_status: "reference_pending";
  left_relative_force: number | null;
  right_relative_force: number | null;
  bilateral_relative_force: number | null;
};

export function deriveIsometric(trials: IsoTrialInput[], bodyweightKg: number | null, cvReviewPercent: number): IsoDerived {
  const valid = (side: IsoTrialInput["side"]) =>
    trials.filter((t) => t.side === side && !t.excluded && t.peak_force !== null);
  const left = valid("L");
  const right = valid("R");
  const bi = valid("BILATERAL");
  const leftPeaks = left.map((t) => t.peak_force as number);
  const rightPeaks = right.map((t) => t.peak_force as number);
  const biPeaks = bi.map((t) => t.peak_force as number);
  const bestLeftIdx = selectBestValidIndex(left.map((t) => ({ peak: t.peak_force, excluded: false })));
  const bestRightIdx = selectBestValidIndex(right.map((t) => ({ peak: t.peak_force, excluded: false })));
  const bestBiIdx = selectBestValidIndex(bi.map((t) => ({ peak: t.peak_force, excluded: false })));
  const bestLeft = bestLeftIdx >= 0 ? leftPeaks[bestLeftIdx] : null;
  const bestRight = bestRightIdx >= 0 ? rightPeaks[bestRightIdx] : null;
  const bestBi = bestBiIdx >= 0 ? biPeaks[bestBiIdx] : null;
  const asym = calculateAsymmetry(bestLeft, bestRight);
  const cvLeft = coefficientOfVariation(leftPeaks);
  const cvRight = coefficientOfVariation(rightPeaks);
  const cvBi = coefficientOfVariation(biPeaks);
  const high =
    (cvLeft !== null && cvLeft > cvReviewPercent) ||
    (cvRight !== null && cvRight > cvReviewPercent) ||
    (cvBi !== null && cvBi > cvReviewPercent);
  const rel = (n: number | null) =>
    n !== null && bodyweightKg && bodyweightKg > 0 ? n / bodyweightKg : null;
  return {
    best_left_peak_force: bestLeft,
    best_right_peak_force: bestRight,
    best_bilateral_peak_force: bestBi,
    mean_left_peak_force: mean(leftPeaks),
    mean_right_peak_force: mean(rightPeaks),
    mean_bilateral_peak_force: mean(biPeaks),
    cv_left_percent: cvLeft,
    cv_right_percent: cvRight,
    cv_bilateral_percent: cvBi,
    high_variability: high,
    asymmetry_percent: asym.asymmetry_percent,
    absolute_difference: asym.absolute_difference,
    stronger_side: asym.stronger_side,
    weaker_side: asym.weaker_side,
    symmetry_status: symmetryStatus(asym.asymmetry_percent),
    population_strength_status: "reference_pending",
    left_relative_force: rel(bestLeft),
    right_relative_force: rel(bestRight),
    bilateral_relative_force: rel(bestBi),
  };
}
