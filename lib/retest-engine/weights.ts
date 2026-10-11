/**
 * Conservative change thresholds. Not claimed as published MDCs unless a
 * protocol row later supplies one. Age is not a programming input here.
 */

export const WEIGHTS_ID = "v1_retest_framework";
export const ENGINE_VERSION = "layer8-v1";

export const CHANGE = {
  /** Relative change that is treated as noise when no reliability data exists. */
  default_mdc_percent: 8,
  /** Force / isometric — still conservative without trial reliability. */
  strength_mdc_percent: 8,
  /** Asymmetry uses percentage-points, not percent-of-percent. */
  asymmetry_mdc_points: 5,
  mobility_mdc_percent: 10,
  percentile_mdc_points: 8,
  /** Absolute floor so tiny kg changes on small values are not over-read. */
  strength_abs_floor: 2,
  bodyweight_material_percent: 3,
  cv_noisy_percent: 10,
  symmetry_resolved_percent: 10,
  symmetry_monitor_percent: 10,
  percentile_satisfactory: 55,
  percentile_strong: 70,
  borderline_percentile: 50,
  adherence_low: 0.6,
  adherence_high: 0.85,
  maintain_to_promote_percentile_drop: 15,
} as const;

export const CATEGORY_RANK: Record<string, number> = {
  below_average: 0,
  average: 1,
  good: 2,
  high: 3,
  priority: 0,
  monitor: 1,
  balanced: 2,
};
