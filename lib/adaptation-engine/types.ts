/**
 * Layer 6 — what should happen next, from evidence not calendar time.
 * Age is not an input. Pain is a flag, not a diagnosis.
 */

import type { Prescription } from "@/lib/dosage-engine/types";
import type { MasteryLevel, SlotIntent } from "@/lib/exercise-kb/types";

export const DECISION_STATES = ["PROGRESS", "HOLD", "REGRESS", "REVIEW", "PAUSE"] as const;
export type DecisionState = (typeof DECISION_STATES)[number];

export const EXERCISE_STATUSES = [
  "LEARNING",
  "PROGRESSING",
  "STABLE",
  "STALLED",
  "REGRESSING",
  "PAUSED",
  "REVIEW_REQUIRED",
] as const;
export type ExerciseStatus = (typeof EXERCISE_STATUSES)[number];

export const ADAPT_ACTIONS = [
  "INCREASE_LOAD",
  "INCREASE_REPS",
  "INCREASE_SETS",
  "HOLD_PRESCRIPTION",
  "REDUCE_LOAD",
  "REDUCE_SETS",
  "PROGRESS_EXERCISE",
  "REGRESS_EXERCISE",
  "INCREASE_DURATION",
  "HOLD_DURATION",
  "ASK_CLIENT",
  "PAUSE_EXERCISE",
  "PRACTITIONER_REVIEW",
] as const;
export type AdaptAction = (typeof ADAPT_ACTIONS)[number];

export const CONFIDENCES = ["LOW", "MODERATE", "HIGH"] as const;
export type AdaptConfidence = (typeof CONFIDENCES)[number];

export const ADHERENCE_BANDS = ["EXCELLENT", "GOOD", "MODERATE", "LOW"] as const;
export type AdherenceBand = (typeof ADHERENCE_BANDS)[number];

export const PAIN_LEVELS = ["NONE", "MILD", "MODERATE", "SEVERE"] as const;
export type PainLevel = (typeof PAIN_LEVELS)[number];

export const PAIN_COURSES = ["NONE", "NEW", "REPEATED", "WORSENING", "IMPROVING"] as const;
export type PainCourse = (typeof PAIN_COURSES)[number];

export const TRENDS = ["IMPROVING", "STABLE", "DECLINING", "INCONSISTENT", "INSUFFICIENT_DATA"] as const;
export type AdaptTrend = (typeof TRENDS)[number];

export const REVIEW_OUTCOMES = ["NO_ACTION", "ENCOURAGE", "ASK_QUESTION", "AUTO_ADJUST", "PRACTITIONER_REVIEW"] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export const MESSAGE_TYPES = [
  "ENCOURAGEMENT",
  "CHECK_IN",
  "PROGRESSION_NOTICE",
  "PROGRAM_ADJUSTMENT",
  "PAIN_FOLLOWUP",
  "ADHERENCE_CHECK",
  "RETEST_REMINDER",
  "GENERAL_SUPPORT",
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const TRAFFIC = ["GREEN", "AMBER", "RED"] as const;
export type Traffic = (typeof TRAFFIC)[number];

export const AUTOMATION_LEVELS = ["LEVEL_1_SUGGEST", "LEVEL_2_LOW_RISK", "LEVEL_3_ADVANCED"] as const;
export type AutomationLevel = (typeof AUTOMATION_LEVELS)[number];

export const QUEUE_STATUSES = ["NEW", "REVIEWED", "ACTIONED", "DISMISSED"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const ADHERENCE_REASONS = [
  "TIME",
  "SCHEDULE",
  "PAIN",
  "LOW_MOTIVATION",
  "EXERCISE_DISLIKE",
  "PROGRAM_TOO_LONG",
  "PROGRAM_TOO_HARD",
  "RECOVERY",
  "OTHER",
] as const;
export type AdherenceReason = (typeof ADHERENCE_REASONS)[number];

export type LoggedSet = {
  date: string;
  exercise_id: string | null;
  slug: string | null;
  name: string;
  set_number: number;
  reps: number | null;
  load: number | null;
  rir: number | null;
  rpe: number | null;
  pain: number | null;
  notes: string | null;
};

export type LoggedSession = {
  date: string;
  completed: boolean;
  skipped: boolean;
  session_rpe: number | null;
  duration_minutes: number | null;
  prescribed_minutes: number | null;
  energy: number | null;
  motivation: number | null;
  sleep: number | null;
  soreness: number | null;
  fatigue: number | null;
  notes: string | null;
};

export type Exposure = {
  date: string;
  reps: number[];
  loads: number[];
  rirs: number[];
  rpes: number[];
  max_pain: number | null;
  notes: string[];
  completed_sets: number;
};

export type ProposedChange = {
  current: string;
  proposed: string;
  reason: string;
  auto_eligible: boolean;
};

export type ExerciseDecision = {
  slot_id: string;
  exercise_id: string;
  slug: string;
  name: string;
  intent: SlotIntent;
  state: DecisionState;
  status: ExerciseStatus;
  action: AdaptAction;
  confidence: AdaptConfidence;
  reasons: string[];
  proposed: ProposedChange | null;
  load_increment: number | null;
  suggested_exercise: { slug: string; name: string; kind: "PROGRESSION" | "REGRESSION" } | null;
  mastery: MasteryLevel;
  mastery_suggested: MasteryLevel | null;
  pain_level: PainLevel;
  pain_course: PainCourse;
  effort_trend: AdaptTrend;
  client_message: DraftMessage | null;
  practitioner_flag: boolean;
  traffic: Traffic;
};

export type DraftMessage = {
  type: MessageType;
  priority: "LOW" | "NORMAL" | "HIGH";
  body: string;
  send: boolean;
};

export type QueueItem = {
  id: string;
  slot_id: string | null;
  exercise_name: string | null;
  severity: Traffic;
  trigger: string;
  issue: string;
  suggested_action: string;
  draft_message: string | null;
  date_detected: string;
  status: QueueStatus;
};

export type ClientAdaptation = {
  window_days: number;
  sessions_prescribed: number;
  sessions_completed: number;
  sessions_skipped: number;
  adherence_percent: number;
  adherence_band: AdherenceBand;
  pain_status: PainLevel;
  recovery_trend: AdaptTrend;
  strength_trend: AdaptTrend;
  duration_mismatch: boolean;
  retest_due: boolean;
  traffic: Traffic;
  fortnightly_outcome: ReviewOutcome;
  summary: string;
  messages: DraftMessage[];
  queue: QueueItem[];
  possible_adherence_reasons: AdherenceReason[];
};

export type AdaptationResult = {
  exercises: ExerciseDecision[];
  client: ClientAdaptation;
  rationale: string[];
  flags: string[];
  automation_level: AutomationLevel;
  weights_id: string;
};

export type AdaptationOverride = {
  exercises: Record<
    string,
    Partial<Pick<ExerciseDecision, "state" | "action" | "mastery">>
  >;
  automation_level?: AutomationLevel;
  suppress_messages?: boolean;
  reason: string;
};

export const WEIGHTS_ID = "v1_adaptation_framework";

export type AdaptInput = {
  prescriptions: Prescription[];
  exposures: Record<string, Exposure[]>;
  sessions: LoggedSession[];
  mastery: Record<string, MasteryLevel>;
  progressions: Record<string, { slug: string; name: string }[]>;
  regressions: Record<string, { slug: string; name: string }[]>;
  first_name: string;
  training_stage: "FOUNDATION" | "DEVELOPMENT" | "ADVANCED";
  training_experience: "NONE" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  program_week: number;
  program_weeks: number;
  sessions_per_week: number;
  as_of?: string;
  automation_level?: AutomationLevel;
  override?: AdaptationOverride | null;
};
