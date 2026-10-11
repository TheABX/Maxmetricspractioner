import type { Day, Stage } from "@/lib/programming-profile/types";
import type { PriorityLevel, Quality } from "@/lib/priority-engine/types";

export const SPLITS = [
  "FULL_BODY",
  "UPPER_LOWER",
  "FULL_BODY_PLUS_CARDIO",
  "STRENGTH_CARDIO_SPLIT",
  "PUSH_PULL_LEGS",
  "SPORT_SUPPORT",
  "CUSTOM",
] as const;
export type Split = (typeof SPLITS)[number];

export const SESSION_TYPES = [
  "STRENGTH",
  "HYPERTROPHY",
  "POWER",
  "AEROBIC_LOW_INTENSITY",
  "AEROBIC_HIGH_INTENSITY",
  "MOBILITY",
  "BALANCE",
  "RECOVERY",
  "MIXED",
  "FULL_BODY_STRENGTH",
  "UPPER_STRENGTH",
  "LOWER_STRENGTH",
  "OPTIONAL_ACTIVITY",
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_COMPONENTS = [
  "POWER",
  "STRENGTH",
  "HYPERTROPHY",
  "AEROBIC",
  "MOBILITY",
  "BALANCE",
  "UNILATERAL",
  "RECOVERY",
] as const;
export type SessionComponent = (typeof SESSION_COMPONENTS)[number];

export const CARDIO_KINDS = ["LOW_INTENSITY_STEADY_STATE", "MODERATE_CONTINUOUS", "INTERVAL", "SPORT_SPECIFIC"] as const;
export type CardioKind = (typeof CARDIO_KINDS)[number];

export const MOBILITY_PLACEMENTS = ["DEDICATED", "WARM_UP_INTEGRATED", "BETWEEN_SETS", "COOLDOWN", "HOME_MICROSESSION"] as const;
export type MobilityPlacement = (typeof MOBILITY_PLACEMENTS)[number];

export const SPORT_LOADS = ["NONE", "LOW", "MODERATE", "HIGH"] as const;
export type SportLoad = (typeof SPORT_LOADS)[number];

export type ConstraintFlag =
  | "RAPID_LOAD_INCREASE"
  | "CONSTRAINT_CONFLICT"
  | "FOUNDATION_CAP"
  | "LOW_TOLERANCE_CAP"
  | "INSUFFICIENT_TIME"
  | "SPORT_LOAD_CONFLICT";

export type Allocation = {
  quality: Quality;
  priority: PriorityLevel;
  percent: number;
  minutes: number;
  emphasis: "high" | "moderate" | "small" | "minimum";
};

export type ScheduledSession = {
  day: Day;
  kind: "PRESCRIBED" | "OPTIONAL" | "REST";
  session_type: SessionType | "REST";
  primary_session_type: SessionType | "REST";
  secondary_components: SessionComponent[];
  duration_minutes: number;
  components: { name: SessionComponent | "REST"; minutes: number }[];
  sport_load: SportLoad;
  label: string;
  client_label: string;
};

export type ProgramPhase = {
  id: string;
  name: string;
  weeks: string;
  week_start: number;
  week_end: number;
  intent: string;
};

export type StructureResult = {
  recommended_sessions_per_week: number;
  optional_activity_days: number;
  weekly_available_minutes: number;
  weekly_training_minutes: number;
  effective_training_budget: number;
  session_minutes: number;
  session_split: Split;
  cardio_sessions_per_week: number;
  cardio_minutes_per_week: number;
  cardio_session_type: CardioKind;
  power_distribution: "INTEGRATED_FRESH" | "DEDICATED" | "NONE";
  mobility_distribution: MobilityPlacement;
  balance_distribution: "INTEGRATED_UNILATERAL" | "DEDICATED" | "NONE";
  unilateral_bias: boolean;
  priority_time_allocation: Allocation[];
  weekly_schedule: ScheduledSession[];
  program_phase_structure: ProgramPhase[];
  recovery_spacing: { minimum_recovery_hours_between_similar_sessions: number; note: string };
  constraint_flags: ConstraintFlag[];
  practitioner_rationale: string[];
  client_week: { day: string; label: string }[];
};

export type StructureOverride = {
  recommended_sessions_per_week?: number;
  session_minutes?: number;
  session_split?: Split;
  weekly_schedule?: ScheduledSession[];
  priority_time_allocation?: Allocation[];
  program_phase_structure?: ProgramPhase[];
  sport_load_by_day?: Partial<Record<Day, SportLoad>>;
  reason: string;
};

export const SPLIT_LABEL: Record<Split, string> = {
  FULL_BODY: "Full body",
  UPPER_LOWER: "Upper / lower",
  FULL_BODY_PLUS_CARDIO: "Full body + cardio",
  STRENGTH_CARDIO_SPLIT: "Strength + cardio split",
  PUSH_PULL_LEGS: "Push / pull / legs",
  SPORT_SUPPORT: "Sport support",
  CUSTOM: "Custom",
};

export const DAY_LABEL: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export function slabel(s: Split) {
  return SPLIT_LABEL[s];
}

export function dlabel(d: Day) {
  return DAY_LABEL[d];
}

export function stagePhases(stage: Stage, primaryGoal: string | null): ProgramPhase[] {
  if (primaryGoal === "HYPERTROPHY") {
    return [
      { id: "p1", name: "Volume foundation", weeks: "1–4", week_start: 1, week_end: 4, intent: "Establish recoverable volume and repeat patterns. Do not rotate exercises for novelty." },
      { id: "p2", name: "Volume / load progression", weeks: "5–8", week_start: 5, week_end: 8, intent: "Progress load or sets on successful exercises." },
      { id: "p3", name: "Continued overload", weeks: "9–12", week_start: 9, week_end: 12, intent: "Intensify within tolerance. Keep exercises that are working." },
    ];
  }
  if (stage === "FOUNDATION") {
    return [
      { id: "p1", name: "Foundation", weeks: "1–4", week_start: 1, week_end: 4, intent: "Competency, moderate effort, repeated patterns, conservative volume." },
      { id: "p2", name: "Development", weeks: "5–8", week_start: 5, week_end: 8, intent: "Progressive overload on the same core patterns." },
      { id: "p3", name: "Consolidation", weeks: "9–12", week_start: 9, week_end: 12, intent: "Solidify capacity. Still no obligatory exercise swap." },
    ];
  }
  return [
    { id: "p1", name: "Accumulation", weeks: "1–4", week_start: 1, week_end: 4, intent: "Build weekly structure and technical consistency." },
    { id: "p2", name: "Progressive overload", weeks: "5–8", week_start: 5, week_end: 8, intent: "Increase density, load, or quality emphasis." },
    { id: "p3", name: "Progression / consolidation", weeks: "9–12", week_start: 9, week_end: 12, intent: "Push priority qualities; keep successful exercises." },
  ];
}
