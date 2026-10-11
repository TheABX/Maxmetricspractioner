/**
 * Configurable internal weights. Not scientific truth. Not shown to clients.
 */

import type { Confidence, FunctionalRelevance, PriorityLevel, RelevanceLevel, Severity, SupportLevel, Trend } from "./types";

export const WEIGHTS_ID = "v1_transparent_framework";

export const SEVERITY_W: Record<Severity, number> = {
  NONE: 0,
  MILD: 1,
  MODERATE: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

export const GOAL_W: Record<RelevanceLevel, number> = {
  NONE: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

export const FUNC_W: Record<FunctionalRelevance, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
};

export const CONF_W: Record<Confidence, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
};

export const SUPPORT_W: Record<SupportLevel, number> = {
  NONE: 0,
  ONE_SUPPORTING: 1,
  MULTIPLE_SUPPORTING: 2,
};

export const TREND_W: Record<Trend, number> = {
  IMPROVING: 0,
  STABLE: 0,
  DECLINING: 2,
  NEW_FINDING: 1,
  UNKNOWN: 0,
};

export const ASYMMETRY_W = {
  none: 0,
  mild: 1,
  notable: 2,
};

/** Extra points when the quality is the client's primary goal (goal-driven, not a deficit). */
export const PRIMARY_GOAL_BOOST = 4;
export const SECONDARY_GOAL_BOOST = 2;
export const SUPPORTS_PRIMARY_BOOST = 1;

export const SCORE_TO_LEVEL: { min: number; level: PriorityLevel }[] = [
  { min: 9, level: "P1_PRIMARY" },
  { min: 6, level: "P2_SECONDARY" },
  { min: 3, level: "P3_MONITOR" },
  { min: 0, level: "MAINTAIN" },
];

export function levelFromScore(score: number): PriorityLevel {
  for (const row of SCORE_TO_LEVEL) if (score >= row.min) return row.level;
  return "MAINTAIN";
}

export const PARENT_OF: Partial<Record<import("./types").Quality, import("./types").Quality>> = {
  KNEE_EXTENSOR_STRENGTH: "LOWER_BODY_STRENGTH",
  KNEE_FLEXOR_STRENGTH: "LOWER_BODY_STRENGTH",
  HIP_ABDUCTION_STRENGTH: "LOWER_BODY_STRENGTH",
  RAPID_FORCE_PRODUCTION: "POWER",
  ANKLE_MOBILITY: "MOVEMENT_COMPETENCY",
  HIP_MOBILITY: "MOVEMENT_COMPETENCY",
  POSTERIOR_CHAIN_MOBILITY: "MOVEMENT_COMPETENCY",
  SHOULDER_MOBILITY: "MOVEMENT_COMPETENCY",
};
