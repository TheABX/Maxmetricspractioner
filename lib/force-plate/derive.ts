import type { ForcePlateTrialPreview, NumericField } from "./parse";
import { NUMERIC_FIELDS } from "./parse";

export const ASYMMETRY_PROTOCOL_TARGET_PERCENT = 10;
export const TRIAL_CONSISTENCY_CV_REVIEW_PERCENT = 10;

export type SideLetter = "L" | "R";

export type DerivedTrialMetrics = {
  peak_force_asymmetry_percent: number | null;
  weaker_side: SideLetter | null;
  stronger_side: SideLetter | null;
  absolute_difference_kg: number | null;
  manufacturer_left_contribution: number | null;
  manufacturer_right_contribution: number | null;
  calculated_left_contribution: number | null;
  calculated_right_contribution: number | null;
  manufacturer_relative_peak_force: number | null;
  calculated_relative_peak_force: number | null;
};

export function calculateAsymmetry(left: number | null, right: number | null) {
  if (left === null || right === null) {
    return {
      peak_force_asymmetry_percent: null,
      weaker_side: null as SideLetter | null,
      stronger_side: null as SideLetter | null,
      absolute_difference_kg: null as number | null,
    };
  }
  const absolute_difference_kg = Math.abs(left - right);
  const larger = Math.max(left, right);
  if (larger === 0) {
    return {
      peak_force_asymmetry_percent: 0,
      weaker_side: left <= right ? ("L" as const) : ("R" as const),
      stronger_side: left > right ? ("L" as const) : ("R" as const),
      absolute_difference_kg,
    };
  }
  const peak_force_asymmetry_percent = (absolute_difference_kg / larger) * 100;
  return {
    peak_force_asymmetry_percent,
    weaker_side: (left < right ? "L" : left > right ? "R" : null) as SideLetter | null,
    stronger_side: (left > right ? "L" : left < right ? "R" : null) as SideLetter | null,
    absolute_difference_kg,
  };
}

export function calculateContribution(left: number | null, right: number | null) {
  if (left === null || right === null) {
    return { calculated_left_contribution: null, calculated_right_contribution: null };
  }
  const sum = left + right;
  if (sum === 0) {
    return { calculated_left_contribution: 0, calculated_right_contribution: 0 };
  }
  return {
    calculated_left_contribution: (left / sum) * 100,
    calculated_right_contribution: (right / sum) * 100,
  };
}

export function deriveTrial(
  trial: ForcePlateTrialPreview,
  bodyweightKg: number | null,
): DerivedTrialMetrics {
  const leftForce = trial.left?.peak_force_kg ?? null;
  const rightForce = trial.right?.peak_force_kg ?? null;
  const asymmetry = calculateAsymmetry(leftForce, rightForce);
  const contribution = calculateContribution(leftForce, rightForce);
  const combinedPeak = trial.combined?.peak_force_kg ?? null;

  return {
    ...asymmetry,
    manufacturer_left_contribution: trial.left?.peak_force_percent ?? null,
    manufacturer_right_contribution: trial.right?.peak_force_percent ?? null,
    ...contribution,
    manufacturer_relative_peak_force: trial.combined?.relative_peak_force ?? null,
    calculated_relative_peak_force:
      combinedPeak !== null && bodyweightKg && bodyweightKg > 0
        ? combinedPeak / bodyweightKg
        : null,
  };
}

export function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return (Math.sqrt(variance) / mean) * 100;
}

export function selectBestTrialIndex(trials: { combinedPeak: number | null; excluded: boolean }[]) {
  let best = -1;
  let bestForce = -Infinity;
  trials.forEach((t, idx) => {
    if (t.excluded || t.combinedPeak === null) return;
    if (t.combinedPeak > bestForce) {
      bestForce = t.combinedPeak;
      best = idx;
    }
  });
  return best;
}

export function trialRowColumns(
  trial: ForcePlateTrialPreview,
  derived: DerivedTrialMetrics,
) {
  const pick = (side: "combined" | "left" | "right", field: NumericField) => {
    const row = trial[side];
    return row ? row[field] : null;
  };

  const columns: Record<string, number | string | boolean | null> = {
    trial_number: trial.trial,
    performed_at: trial.performed_at,
    athlete_name: trial.athlete_name,
    movement_name: trial.movement_name,
    ...derived,
  };

  for (const field of NUMERIC_FIELDS) {
    columns[`combined_${field}`] = pick("combined", field);
    columns[`left_${field}`] = pick("left", field);
    columns[`right_${field}`] = pick("right", field);
  }

  columns.raw_rows = {
    combined: trial.combined,
    left: trial.left,
    right: trial.right,
  } as unknown as null;

  return columns;
}

export function round(value: number | null, digits = 2) {
  if (value === null || Number.isNaN(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
