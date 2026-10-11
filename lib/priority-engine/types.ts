/**
 * Priority Engine V1 — ranked training qualities.
 * Does not choose exercises. Does not invent reference significance.
 */

import type { Goal, ProgramMode } from "@/lib/programming-profile/types";

export const QUALITIES = [
  "MAXIMAL_STRENGTH",
  "LOWER_BODY_STRENGTH",
  "UPPER_BODY_STRENGTH",
  "KNEE_EXTENSOR_STRENGTH",
  "KNEE_FLEXOR_STRENGTH",
  "HIP_ABDUCTION_STRENGTH",
  "GRIP_STRENGTH",
  "POWER",
  "RAPID_FORCE_PRODUCTION",
  "AEROBIC_CAPACITY",
  "ANAEROBIC_CAPACITY",
  "BALANCE",
  "GAIT_FUNCTION",
  "SPEED_ACCELERATION",
  "ANKLE_MOBILITY",
  "HIP_MOBILITY",
  "POSTERIOR_CHAIN_MOBILITY",
  "SHOULDER_MOBILITY",
  "LEFT_RIGHT_SYMMETRY",
  "MOVEMENT_COMPETENCY",
  "HYPERTROPHY",
  "BODY_COMPOSITION",
  "RECOVERY",
  "SLEEP",
  "GENERAL_ACTIVITY",
] as const;
export type Quality = (typeof QUALITIES)[number];

export const PRIORITY_LEVELS = [
  "P1_PRIMARY",
  "P2_SECONDARY",
  "P3_MONITOR",
  "MAINTAIN",
  "NOT_RELEVANT",
  "REVIEW_REQUIRED",
] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const SEVERITIES = ["NONE", "MILD", "MODERATE", "HIGH", "VERY_HIGH"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIDENCES = ["LOW", "MODERATE", "HIGH"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const RELEVANCE_LEVELS = ["NONE", "LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;
export type RelevanceLevel = (typeof RELEVANCE_LEVELS)[number];

export const FUNC_RELEVANCE = ["LOW", "MODERATE", "HIGH"] as const;
export type FunctionalRelevance = (typeof FUNC_RELEVANCE)[number];

export const TRENDS = ["IMPROVING", "STABLE", "DECLINING", "NEW_FINDING", "UNKNOWN"] as const;
export type Trend = (typeof TRENDS)[number];

export const SUPPORT_LEVELS = ["NONE", "ONE_SUPPORTING", "MULTIPLE_SUPPORTING"] as const;
export type SupportLevel = (typeof SUPPORT_LEVELS)[number];

export type Finding = {
  finding_id: string;
  quality: Quality;
  parent_quality: Quality | null;
  laterality: "L" | "R" | "BILATERAL" | null;
  test_source: string;
  metric: string;
  raw_value: number | null;
  normalised_value: number | null;
  reference_percentile: number | null;
  reference_category: string | null;
  left_value: number | null;
  right_value: number | null;
  asymmetry_percent: number | null;
  lower_side: "L" | "R" | null;
  severity: Severity;
  severity_confidence: Confidence;
  confidence: Confidence;
  functional_relevance: FunctionalRelevance;
  goal_relevance: RelevanceLevel;
  trend_status: Trend;
  pain_associated: boolean;
  movement_limitation_associated: boolean;
  source_count: number;
  supporting_findings: string[];
  cluster: string | null;
  notes: string;
  created_at: string;
};

export type RankedPriority = {
  quality: Quality;
  parent_quality: Quality | null;
  laterality: "L" | "R" | "BILATERAL" | null;
  automatic_priority: PriorityLevel;
  practitioner_priority: PriorityLevel | null;
  effective_priority: PriorityLevel;
  override_reason: string;
  override_date: string | null;
  overridden_by: string | null;
  /** Internal ranking tool — never shown to clients. */
  priority_score: number;
  severity: Severity;
  confidence: Confidence;
  goal_relevance: RelevanceLevel;
  functional_relevance: FunctionalRelevance;
  trend: Trend;
  multi_test_support: SupportLevel;
  cluster: string | null;
  action: "improve" | "maintain" | "monitor" | "escalate";
  why: string[];
  recommended_quality_work: string;
  client_line: string;
  finding_ids: string[];
};

export type PriorityOverride = {
  value: PriorityLevel;
  reason: string;
  date: string;
  overridden_by: string | null;
};

export type PriorityOverrides = Partial<Record<string, PriorityOverride>>;

export type PriorityResult = {
  program_mode: ProgramMode;
  primary_goal: Goal | null;
  findings: Finding[];
  priorities: RankedPriority[];
  clusters: string[];
  weights_id: string;
};

export function qualityKey(p: Pick<RankedPriority, "quality" | "laterality" | "parent_quality">) {
  return [p.parent_quality ?? "", p.quality, p.laterality ?? ""].join(":");
}

export const QUALITY_LABEL: Record<Quality, string> = {
  MAXIMAL_STRENGTH: "Maximal strength",
  LOWER_BODY_STRENGTH: "Lower-body strength",
  UPPER_BODY_STRENGTH: "Upper-body strength",
  KNEE_EXTENSOR_STRENGTH: "Knee-extensor strength",
  KNEE_FLEXOR_STRENGTH: "Knee-flexor strength",
  HIP_ABDUCTION_STRENGTH: "Hip-abduction strength",
  GRIP_STRENGTH: "Grip strength",
  POWER: "Power",
  RAPID_FORCE_PRODUCTION: "Rapid force production",
  AEROBIC_CAPACITY: "Aerobic capacity",
  ANAEROBIC_CAPACITY: "Anaerobic capacity",
  BALANCE: "Balance",
  GAIT_FUNCTION: "Gait function",
  SPEED_ACCELERATION: "Speed / acceleration",
  ANKLE_MOBILITY: "Ankle mobility",
  HIP_MOBILITY: "Hip mobility",
  POSTERIOR_CHAIN_MOBILITY: "Posterior-chain mobility",
  SHOULDER_MOBILITY: "Shoulder mobility",
  LEFT_RIGHT_SYMMETRY: "Left–right symmetry",
  MOVEMENT_COMPETENCY: "Movement competency",
  HYPERTROPHY: "Hypertrophy",
  BODY_COMPOSITION: "Body composition",
  RECOVERY: "Recovery",
  SLEEP: "Sleep",
  GENERAL_ACTIVITY: "General activity",
};

export const LEVEL_LABEL: Record<PriorityLevel, string> = {
  P1_PRIMARY: "P1 · Primary",
  P2_SECONDARY: "P2 · Secondary",
  P3_MONITOR: "P3 · Monitor",
  MAINTAIN: "Maintain",
  NOT_RELEVANT: "Not relevant",
  REVIEW_REQUIRED: "Review required",
};

export const LEVEL_CLIENT: Record<PriorityLevel, string> = {
  P1_PRIMARY: "Improve",
  P2_SECONDARY: "Improve",
  P3_MONITOR: "Keep an eye on",
  MAINTAIN: "Keep",
  NOT_RELEVANT: "",
  REVIEW_REQUIRED: "Needs a closer look",
};

export function qlabel(q: Quality) {
  return QUALITY_LABEL[q] ?? q.replaceAll("_", " ").toLowerCase();
}

export function llabel(l: PriorityLevel) {
  return LEVEL_LABEL[l];
}
