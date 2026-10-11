export type SideLetter = "L" | "R";

export function calculateAsymmetry(left: number | null, right: number | null) {
  if (left === null || right === null) {
    return {
      asymmetry_percent: null as number | null,
      weaker_side: null as SideLetter | null,
      stronger_side: null as SideLetter | null,
      absolute_difference: null as number | null,
    };
  }
  const absolute_difference = Math.abs(left - right);
  const larger = Math.max(left, right);
  if (larger === 0) {
    return {
      asymmetry_percent: 0,
      weaker_side: left <= right ? ("L" as const) : ("R" as const),
      stronger_side: left > right ? ("L" as const) : ("R" as const),
      absolute_difference,
    };
  }
  return {
    asymmetry_percent: (absolute_difference / larger) * 100,
    weaker_side: (left < right ? "L" : left > right ? "R" : null) as SideLetter | null,
    stronger_side: (left > right ? "L" : left < right ? "R" : null) as SideLetter | null,
    absolute_difference,
  };
}

export function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return (Math.sqrt(variance) / mean) * 100;
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function selectBestValidIndex(trials: { peak: number | null; excluded: boolean }[]) {
  let best = -1;
  let bestForce = -Infinity;
  trials.forEach((t, idx) => {
    if (t.excluded || t.peak === null) return;
    if (t.peak > bestForce) {
      bestForce = t.peak;
      best = idx;
    }
  });
  return best;
}

export const DEFAULT_CV_REVIEW_PERCENT = 10;
export const DEFAULT_SYMMETRY_MONITOR_PERCENT = 10;
export const DEFAULT_SYMMETRY_PRIORITY_PERCENT = 20;

export type SymmetryStatus = "balanced" | "monitor" | "priority" | "unavailable";
export type StrengthStatus = "reference_pending" | "not_assessed";

export function symmetryStatus(
  percent: number | null,
  monitor = DEFAULT_SYMMETRY_MONITOR_PERCENT,
  priority = DEFAULT_SYMMETRY_PRIORITY_PERCENT,
): SymmetryStatus {
  if (percent === null) return "unavailable";
  if (percent <= monitor) return "balanced";
  if (percent <= priority) return "monitor";
  return "priority";
}

export function symmetryLabel(status: SymmetryStatus) {
  if (status === "balanced") return "Balanced";
  if (status === "monitor") return "Monitor";
  if (status === "priority") return "Priority";
  return "Not assessed";
}
