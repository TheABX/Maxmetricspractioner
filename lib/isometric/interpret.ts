import { isometricTest } from "./tests";
import { symmetryLabel, type SymmetryStatus } from "@/lib/metrics/stats";
import type { IsoDerived } from "./derive";

export function interpretIsometric(options: {
  firstName: string;
  testType: string;
  derived: IsoDerived;
}) {
  const test = isometricTest(options.testType);
  const name = test?.displayName ?? "Isometric test";
  const weaker =
    options.derived.weaker_side === "L" ? "left" : options.derived.weaker_side === "R" ? "right" : null;
  const status = options.derived.symmetry_status as SymmetryStatus;
  const interpretation =
    options.derived.best_bilateral_peak_force != null
      ? `${name} peak force was ${options.derived.best_bilateral_peak_force.toFixed(1)} kg. Population strength rating is not shown until a matching reference dataset is loaded.`
      : `${name}: left ${options.derived.best_left_peak_force?.toFixed(1) ?? "—"} kg, right ${options.derived.best_right_peak_force?.toFixed(1) ?? "—"} kg. ${
          options.derived.asymmetry_percent != null
            ? `Side-to-side difference ${options.derived.asymmetry_percent.toFixed(1)}% (${symmetryLabel(status)}). This is a symmetry finding, not a population-strength rating.`
            : ""
        }`;
  const programming =
    status === "priority" && weaker
      ? `Consider prioritising appropriate unilateral work for the ${weaker} side while monitoring symmetry over the next training block.`
      : status === "monitor" && weaker
        ? `Monitor the ${weaker} side. A difference was present, but it is not automatically a problem.`
        : `Maintain currently balanced loading and retest.`;
  return {
    whatThisMeasures: test?.whatThisMeasures ?? "Measures maximal isometric force.",
    interpretation,
    programming,
    whyItMatters: test?.whyItMatters ?? "",
  };
}
