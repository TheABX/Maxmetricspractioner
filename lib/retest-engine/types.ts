/**
 * Layer 8 — what changed, whether it matters, and what the next block should train.
 * Chronological age is never a programming filter. Age/sex may already sit on
 * stored percentiles from reference lookup; this layer does not recompute them.
 */

import type { Finding, PriorityLevel, Quality, RankedPriority } from "@/lib/priority-engine/types";
import type { Stage } from "@/lib/programming-profile/types";

export const CHANGE_STATUSES = ["IMPROVED", "STABLE", "DECLINED", "UNCERTAIN", "NOT_COMPARABLE"] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

export const CHANGE_CONFIDENCES = ["LOW", "MODERATE", "HIGH"] as const;
export type ChangeConfidence = (typeof CHANGE_CONFIDENCES)[number];

export const COMPATIBILITIES = ["COMPATIBLE", "PARTIALLY_COMPATIBLE", "NOT_COMPATIBLE"] as const;
export type Compatibility = (typeof COMPATIBILITIES)[number];

export const DIRECTIONS = ["UP", "DOWN", "UNCHANGED"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const FAVOURABLE = ["HIGHER", "LOWER", "TARGET_RANGE", "CONTEXT_DEPENDENT"] as const;
export type Favourable = (typeof FAVOURABLE)[number];

export const PRIORITY_OUTCOMES = [
  "RESOLVED",
  "IMPROVED_BUT_REMAINS",
  "UNCHANGED",
  "WORSENED",
  "NO_LONGER_RELEVANT",
  "INSUFFICIENT_DATA",
  "SUCCESSFUL_MAINTENANCE",
] as const;
export type PriorityOutcome = (typeof PRIORITY_OUTCOMES)[number];

export const RESPONSE_LABELS = ["HIGH_RESPONSE", "MODERATE_RESPONSE", "LOW_RESPONSE", "MAINTAINED", "UNINTERPRETABLE"] as const;
export type ResponseLabel = (typeof RESPONSE_LABELS)[number];

export const PROGRAM_ISSUES = ["NONE", "PROGRAM_ADHERENCE_ISSUE", "PROGRAM_RESPONSE_ISSUE"] as const;
export type ProgramIssue = (typeof PROGRAM_ISSUES)[number];

export const DOMAINS = ["STRENGTH", "SYMMETRY", "MOBILITY", "POWER", "AEROBIC", "BODY"] as const;
export type MetricDomain = (typeof DOMAINS)[number];

export type ProtocolStamp = {
  protocol_id: string | null;
  protocol_version: string | null;
  equipment: string | null;
  body_position: string | null;
  unit: string | null;
  trial_selection: string | null;
  processing: string | null;
};

export type SnapshotMetric = {
  key: string;
  family: string;
  label: string;
  quality: Quality;
  domain: MetricDomain;
  value: number;
  unit: string;
  favourable: Favourable;
  percentile: number | null;
  category: string | null;
  side: "L" | "R" | "BILATERAL" | "ASYMMETRY" | null;
  left_value: number | null;
  right_value: number | null;
  protocol: ProtocolStamp | null;
  noisy: boolean;
  bodyweight_kg: number | null;
  relative_value: number | null;
};

export type AssessmentSnapshot = {
  session_id: string;
  assessment_date: string;
  assessment_type: string;
  bodyweight_kg: number | null;
  protocol_versions: Record<string, string>;
  metrics: SnapshotMetric[];
  domains_tested: string[];
  domains_missing: string[];
};

export type MetricChange = {
  key: string;
  family: string;
  label: string;
  quality: Quality;
  domain: MetricDomain;
  unit: string;
  favourable: Favourable;
  previous_value: number | null;
  current_value: number | null;
  absolute_change: number | null;
  percentage_change: number | null;
  direction: Direction | null;
  previous_percentile: number | null;
  current_percentile: number | null;
  percentile_change: number | null;
  previous_category: string | null;
  current_category: string | null;
  previous_relative: number | null;
  current_relative: number | null;
  relative_percentage_change: number | null;
  change_status: ChangeStatus;
  change_confidence: ChangeConfidence;
  protocol_compatibility: Compatibility;
  interpretation: string;
  client_line: string;
  programming_implication: string;
  both_sides_declined: boolean;
};

export type PriorityOutcomeRow = {
  quality: Quality;
  laterality: RankedPriority["laterality"];
  previous_level: PriorityLevel;
  suggested_level: PriorityLevel;
  outcome: PriorityOutcome;
  why: string[];
  related_keys: string[];
};

export type NewFinding = {
  quality: Quality;
  reason: string;
  suggested_level: PriorityLevel;
};

export type NextBlockItem = {
  quality: Quality;
  laterality: RankedPriority["laterality"];
  level: PriorityLevel;
  source: "CURRENT_LAYER_2" | "LAYER_8_TRANSITION" | "NEW_FINDING" | "MAINTAIN";
  why: string[];
};

export type Implication = {
  finding: string;
  change: string;
  implication: string;
};

export type Scorecard = {
  priorities_resolved: number;
  priorities_total: number;
  priorities_improved: number;
  adherence_percent: number | null;
  training_stage: Stage;
  suggested_stage: Stage | null;
};

export type BodyRegion = {
  id: string;
  label: string;
  heat: number | null;
  change: ChangeStatus | null;
};

export type BodyMaps = {
  strength: { previous: BodyRegion[]; current: BodyRegion[] };
  symmetry: { previous: BodyRegion[]; current: BodyRegion[] };
  mobility: { previous: BodyRegion[]; current: BodyRegion[] };
};

export type SeriesPoint = {
  date: string;
  assessment_id: string;
  assessment_type: string;
  value: number;
  unit: string;
};

export type LongitudinalSeries = {
  key: string;
  label: string;
  unit: string;
  points: SeriesPoint[];
};

export type RetestOverride = {
  goals_still_current: boolean | null;
  contextual_change: string;
  notes: string;
  suppress_comms: boolean;
};

export type RetestResult = {
  current_session_id: string;
  compare_session_id: string | null;
  baseline_session_id: string | null;
  compare_label: string;
  counts: Record<ChangeStatus, number>;
  vs_previous: MetricChange[];
  vs_baseline: MetricChange[];
  top_improvements: MetricChange[];
  still_to_improve: MetricChange[];
  priority_outcomes: PriorityOutcomeRow[];
  new_findings: NewFinding[];
  next_block: NextBlockItem[];
  implications: Implication[];
  scorecard: Scorecard;
  program_issue: ProgramIssue;
  response_review: { quality: Quality; label: ResponseLabel; note: string }[];
  body_maps: BodyMaps;
  series: LongitudinalSeries[];
  practitioner_summary: string;
  client_summary: string;
  comms_draft: string | null;
  flags: string[];
  weights_id: string;
  engine_version: string;
};

export type RetestInput = {
  first_name: string;
  current: AssessmentSnapshot;
  previous: AssessmentSnapshot | null;
  baseline: AssessmentSnapshot | null;
  history: AssessmentSnapshot[];
  previous_priorities: RankedPriority[];
  current_priorities: RankedPriority[];
  current_findings: Finding[];
  previous_findings: Finding[];
  adherence_percent: number | null;
  training_stage: Stage;
  primary_goal: string | null;
  goals_still_current: boolean | null;
  contextual_change: string | null;
};

export function prettyQuality(q: Quality) {
  return q.replaceAll("_", " ").toLowerCase();
}
