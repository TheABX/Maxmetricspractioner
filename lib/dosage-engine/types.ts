/**
 * Layer 5 — dose around selected exercises.
 * Does not choose exercises. Age is not a dosage input.
 */

import type { PriorityLevel } from "@/lib/priority-engine/types";
import type { Laterality, SlotIntent } from "@/lib/exercise-kb/types";

export const REP_SCHEMES = [
  "FIXED_REPS",
  "REP_RANGE",
  "AMRAP_CONTROLLED",
  "TIME_BASED",
  "DISTANCE_BASED",
  "HOLD_BASED",
  "INTERVAL_BASED",
  "PERCENT_1RM",
  "RPE_BASED",
  "RIR_BASED",
  "CUSTOM",
] as const;
export type RepScheme = (typeof REP_SCHEMES)[number];

export const LOAD_TYPES = ["RIR", "RPE", "PERCENT_1RM", "BODYWEIGHT", "RPE_TALK_TEST", "NONE"] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

export const PROGRESSIONS = [
  "DOUBLE_PROGRESSION",
  "LOAD_PROGRESSION",
  "REP_PROGRESSION",
  "SET_PROGRESSION",
  "DURATION_PROGRESSION",
  "INTENSITY_PROGRESSION",
  "EXERCISE_PROGRESSION",
  "CUSTOM",
] as const;
export type ProgressionMethod = (typeof PROGRESSIONS)[number];

export const VOLUME_REGIONS = [
  "QUADRICEPS",
  "HAMSTRINGS",
  "GLUTES",
  "CHEST",
  "BACK",
  "SHOULDERS",
  "BICEPS",
  "TRICEPS",
  "CALVES",
  "TRUNK",
] as const;
export type VolumeRegion = (typeof VOLUME_REGIONS)[number];

export const DOSAGE_FLAGS = [
  "RAPID_VOLUME_INCREASE",
  "SESSION_FATIGUE_OVERLOAD",
  "FATIGUE_CONFLICT",
  "REVIEW_REQUIRED",
  "HIGH_FAILURE_RISK",
  "INSUFFICIENT_SESSION_TIME",
] as const;
export type DosageFlag = (typeof DOSAGE_FLAGS)[number];

export type Tempo = {
  eccentric: number | null;
  pause_bottom: number | null;
  concentric: number | null;
  pause_top: number | null;
};

export type Prescription = {
  slot_id: string;
  exercise_id: string;
  slug: string;
  name: string;
  intent: SlotIntent;
  training_quality: string;
  priority_level: PriorityLevel | "MAINTAIN";
  laterality: Laterality;
  sets: number;
  extra_weak_side_sets: number;
  weaker_side_first: boolean;
  rep_scheme_type: RepScheme;
  reps_min: number | null;
  reps_max: number | null;
  target_load_type: LoadType;
  target_load_value: string | null;
  rir_min: number | null;
  rir_max: number | null;
  rpe_min: number | null;
  rpe_max: number | null;
  rest_seconds_min: number;
  rest_seconds_max: number;
  tempo: Tempo | null;
  hold_duration_seconds: number | null;
  duration_seconds: number | null;
  distance: string | null;
  power_reps_per_set: number | null;
  interval_work_seconds: number | null;
  interval_rest_seconds: number | null;
  interval_repeats: number | null;
  weekly_target_sets: number;
  weekly_frequency: number;
  progression_method: ProgressionMethod;
  progression_criteria: string;
  stop_rule: string | null;
  notes: string;
  client_line: string;
  rationale: string[];
  constraint_flags: DosageFlag[];
  practitioner_overridden: boolean;
  order: number;
};

export type PrescribedSession = {
  day: string;
  session_type: string;
  label: string;
  duration_minutes: number;
  exercises: Prescription[];
  flags: DosageFlag[];
};

export type WeeklyDosage = {
  resistance_sessions: number;
  total_working_sets: number;
  region_sets: Record<VolumeRegion, number>;
  power_exposures: number;
  aerobic_minutes: number;
  aerobic_sessions: number;
  mobility_exposures: number;
  balance_exposures: number;
  estimated_current_hard_sets: number;
};

export type DosageResult = {
  sessions: PrescribedSession[];
  weekly: WeeklyDosage;
  flags: DosageFlag[];
  rationale: string[];
  weights_id: string;
};

export type DoseOverride = {
  slots: Record<string, Partial<Pick<Prescription, "sets" | "reps_min" | "reps_max" | "rir_min" | "rir_max" | "rpe_min" | "rpe_max" | "rest_seconds_min" | "rest_seconds_max" | "progression_method" | "notes">>>;
  extra_weak_side_sets?: boolean;
  reason: string;
};

export const WEIGHTS_ID = "v1_dosage_framework";
