import { calculateAsymmetry, mean, symmetryStatus, type SymmetryStatus } from "@/lib/metrics/stats";
import type { TrialSelectionMethod } from "./tests";

export type MobilityTrialInput = {
  side: "L" | "R";
  trial_number: number;
  value: number | null;
  excluded?: boolean;
};

export type MobilityDerived = {
  left_value: number | null;
  right_value: number | null;
  absolute_difference: number | null;
  percentage_difference: number | null;
  lower_side: "L" | "R" | "EQUAL" | null;
  trial_selection_method: TrialSelectionMethod;
  symmetry_status: SymmetryStatus;
  population_status: "reference_pending";
  selected_left_trial: number | null;
  selected_right_trial: number | null;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function validValues(trials: MobilityTrialInput[], side: "L" | "R") {
  return trials
    .filter((t) => t.side === side && !t.excluded && t.value !== null)
    .sort((a, b) => a.trial_number - b.trial_number);
}

/**
 * Headline value for one side. BEST is implemented for completeness but V1
 * definitions do not use it — ROM is not treated like maximal isometric force.
 */
export function selectSideValue(
  trials: MobilityTrialInput[],
  side: "L" | "R",
  method: TrialSelectionMethod,
  practitionerValue: number | null,
): { value: number | null; trialNumber: number | null; methodUsed: TrialSelectionMethod } {
  const rows = validValues(trials, side);
  const nums = rows.map((r) => r.value as number);
  if (practitionerValue !== null && Number.isFinite(practitionerValue)) {
    return { value: practitionerValue, trialNumber: null, methodUsed: "PRACTITIONER_SELECTED" };
  }
  if (nums.length === 0) return { value: null, trialNumber: null, methodUsed: method };
  if (method === "SINGLE" || nums.length === 1) {
    const last = rows[rows.length - 1];
    return { value: last.value, trialNumber: last.trial_number, methodUsed: nums.length === 1 ? "SINGLE" : method };
  }
  if (method === "MEAN") return { value: mean(nums), trialNumber: null, methodUsed: "MEAN" };
  if (method === "MEDIAN") return { value: median(nums), trialNumber: null, methodUsed: "MEDIAN" };
  if (method === "BEST") {
    let best = rows[0];
    for (const r of rows) if ((r.value as number) > (best.value as number)) best = r;
    return { value: best.value, trialNumber: best.trial_number, methodUsed: "BEST" };
  }
  const last = rows[rows.length - 1];
  return { value: last.value, trialNumber: last.trial_number, methodUsed: "FINAL" };
}

export function deriveMobility(options: {
  trials: MobilityTrialInput[];
  method: TrialSelectionMethod;
  practitionerLeft: number | null;
  practitionerRight: number | null;
}): MobilityDerived {
  const left = selectSideValue(options.trials, "L", options.method, options.practitionerLeft);
  const right = selectSideValue(options.trials, "R", options.method, options.practitionerRight);
  const asym = calculateAsymmetry(left.value, right.value);
  const lower =
    left.value == null || right.value == null
      ? null
      : left.value < right.value
        ? "L"
        : left.value > right.value
          ? "R"
          : "EQUAL";
  const methodUsed =
    left.methodUsed === "PRACTITIONER_SELECTED" || right.methodUsed === "PRACTITIONER_SELECTED"
      ? "PRACTITIONER_SELECTED"
      : options.method;
  return {
    left_value: left.value,
    right_value: right.value,
    absolute_difference: asym.absolute_difference,
    percentage_difference: asym.asymmetry_percent,
    lower_side: lower,
    trial_selection_method: methodUsed,
    symmetry_status: symmetryStatus(asym.asymmetry_percent),
    population_status: "reference_pending",
    selected_left_trial: left.trialNumber,
    selected_right_trial: right.trialNumber,
  };
}

export function protocolsMatch(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined,
) {
  if (!a || !b) return false;
  const keys = ["protocol_id", "protocol_version", "testing_position", "hip_angle", "measurement_method"];
  return keys.every((k) => String(a[k] ?? "") === String(b[k] ?? ""));
}
