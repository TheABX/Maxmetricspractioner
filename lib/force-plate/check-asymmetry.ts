import { calculateAsymmetry } from "./derive";

const sample = calculateAsymmetry(37.71, 24.26);
if (!sample.peak_force_asymmetry_percent || Math.abs(sample.peak_force_asymmetry_percent - 35.7) > 0.1) {
  throw new Error(`Asymmetry formula failed: ${sample.peak_force_asymmetry_percent}`);
}
if (sample.weaker_side !== "R" || sample.stronger_side !== "L") {
  throw new Error("Weaker/stronger side mapping failed");
}
console.log("asymmetry check ok", sample.peak_force_asymmetry_percent.toFixed(1));
