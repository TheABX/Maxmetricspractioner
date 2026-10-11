/**
 * Exercise knowledge base — what each exercise trains and costs.
 * Selection ranks tools; it does not prescribe sets, reps, or load.
 */

import type { Quality } from "@/lib/priority-engine/types";

export const CATEGORIES = [
  "RESISTANCE",
  "POWER",
  "PLYOMETRIC",
  "AEROBIC",
  "MOBILITY",
  "BALANCE",
  "GAIT",
  "CORE_TRUNK",
  "CARRY",
  "WARM_UP",
  "RECOVERY",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const MOVEMENTS = [
  "SQUAT",
  "HINGE",
  "LUNGE_SPLIT_SQUAT",
  "STEP",
  "HORIZONTAL_PUSH",
  "VERTICAL_PUSH",
  "HORIZONTAL_PULL",
  "VERTICAL_PULL",
  "CARRY",
  "ROTATION",
  "ANTI_ROTATION",
  "ANTI_EXTENSION",
  "ANTI_LATERAL_FLEXION",
  "CALF_PLANTARFLEXION",
  "KNEE_EXTENSION",
  "KNEE_FLEXION",
  "HIP_ABDUCTION",
  "HIP_ADDUCTION",
  "HIP_EXTENSION",
  "SHOULDER_ISOLATION",
  "ELBOW_FLEXION",
  "ELBOW_EXTENSION",
  "GRIP",
  "JUMP",
  "THROW",
  "SPRINT",
  "WALK",
  "RUN",
  "CYCLE",
  "ROW",
  "OTHER",
] as const;
export type Movement = (typeof MOVEMENTS)[number];

export const LEGACY_PATTERNS = ["squat", "hinge", "lunge", "push", "pull", "carry", "core", "mobility", "power", "conditioning", "other"] as const;
export type LegacyPattern = (typeof LEGACY_PATTERNS)[number];

export const EX_QUALITIES = [
  "MAXIMAL_STRENGTH",
  "GENERAL_STRENGTH",
  "LOWER_BODY_STRENGTH",
  "UPPER_BODY_STRENGTH",
  "KNEE_EXTENSOR_STRENGTH",
  "KNEE_FLEXOR_STRENGTH",
  "HIP_EXTENSOR_STRENGTH",
  "HIP_ABDUCTION_STRENGTH",
  "GRIP_STRENGTH",
  "HYPERTROPHY",
  "POWER",
  "RAPID_FORCE_PRODUCTION",
  "AEROBIC_CAPACITY",
  "ANAEROBIC_CAPACITY",
  "BALANCE",
  "COORDINATION",
  "UNILATERAL_CONTROL",
  "ANKLE_MOBILITY",
  "HIP_MOBILITY",
  "POSTERIOR_CHAIN_MOBILITY",
  "SHOULDER_MOBILITY",
  "TRUNK_CAPACITY",
  "GAIT_FUNCTION",
] as const;
export type ExQuality = (typeof EX_QUALITIES)[number];

export const REGIONS = [
  "QUADRICEPS",
  "HAMSTRINGS",
  "GLUTES",
  "HIP_ABDUCTORS",
  "CALVES",
  "CHEST",
  "UPPER_BACK",
  "LATS",
  "SHOULDERS",
  "BICEPS",
  "TRICEPS",
  "FOREARMS_GRIP",
  "TRUNK",
] as const;
export type Region = (typeof REGIONS)[number];

export const LATERALITIES = ["BILATERAL", "UNILATERAL", "ALTERNATING", "ASYMMETRIC_LOAD"] as const;
export type Laterality = (typeof LATERALITIES)[number];

export const KB_EQUIPMENT = [
  "BODYWEIGHT",
  "BARBELL",
  "DUMBBELL",
  "KETTLEBELL",
  "BENCH",
  "SQUAT_RACK",
  "CABLE",
  "MACHINE",
  "LEG_PRESS",
  "LEG_EXTENSION",
  "LEG_CURL",
  "BAND",
  "PULLUP_BAR",
  "TRX",
  "SLED",
  "MEDICINE_BALL",
  "BOX",
  "STEP",
  "TREADMILL",
  "BIKE",
  "ROWER",
  "SKIERG",
  "TRACK",
  "POOL",
  "SUPPORT_OBJECT",
] as const;
export type KbEquipment = (typeof KB_EQUIPMENT)[number];

export const DIFFICULTIES = ["FOUNDATION", "BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const LMH = ["LOW", "MODERATE", "HIGH"] as const;
export type Lmh = (typeof LMH)[number];
export const LMHV = ["LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;
export type Lmhv = (typeof LMHV)[number];

export const FOUNDATIONS = ["NOT_SUITABLE", "POSSIBLE", "GOOD", "EXCELLENT"] as const;
export type FoundationFit = (typeof FOUNDATIONS)[number];

export const REL_TYPES = ["REGRESSION", "PROGRESSION", "ALTERNATIVE", "SIMILAR_STIMULUS"] as const;
export type RelType = (typeof REL_TYPES)[number];

export const REVIEW_STATUSES = ["LIVE", "PENDING_REVIEW", "REJECTED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const EX_SOURCES = ["CATALOG", "PRACTITIONER", "AI_SUGGESTED"] as const;
export type ExSource = (typeof EX_SOURCES)[number];

export const MASTERY_LEVELS = ["NOT_ATTEMPTED", "LEARNING", "COMPETENT", "PROFICIENT"] as const;
export type MasteryLevel = (typeof MASTERY_LEVELS)[number];

export const FAMILY_DEFS = [
  { slug: "squat", name: "Squat family", movements: ["SQUAT"] },
  { slug: "hinge", name: "Hinge family", movements: ["HINGE", "HIP_EXTENSION"] },
  { slug: "split_squat", name: "Split squat family", movements: ["LUNGE_SPLIT_SQUAT", "STEP"] },
  { slug: "horizontal_push", name: "Horizontal push family", movements: ["HORIZONTAL_PUSH"] },
  { slug: "vertical_push", name: "Vertical push family", movements: ["VERTICAL_PUSH"] },
  { slug: "horizontal_pull", name: "Horizontal pull family", movements: ["HORIZONTAL_PULL"] },
  { slug: "vertical_pull", name: "Vertical pull family", movements: ["VERTICAL_PULL"] },
  { slug: "knee_extension", name: "Knee extension family", movements: ["KNEE_EXTENSION"] },
  { slug: "knee_flexion", name: "Knee flexion family", movements: ["KNEE_FLEXION"] },
  { slug: "hip_abduction", name: "Hip abduction family", movements: ["HIP_ABDUCTION", "HIP_ADDUCTION"] },
  { slug: "carry", name: "Carry family", movements: ["CARRY", "GRIP"] },
  { slug: "trunk", name: "Trunk family", movements: ["ANTI_ROTATION", "ANTI_EXTENSION", "ANTI_LATERAL_FLEXION", "ROTATION"] },
  { slug: "power_jump", name: "Power / jump family", movements: ["JUMP", "THROW", "SPRINT"] },
  { slug: "aerobic", name: "Aerobic family", movements: ["WALK", "RUN", "CYCLE", "ROW"] },
  { slug: "mobility", name: "Mobility family", movements: ["OTHER"] },
] as const;

export const LIBRARY_TAGS = [
  "BEGINNER_FRIENDLY",
  "HOME_FRIENDLY",
  "TIME_EFFICIENT",
  "LOW_FATIGUE",
  "HIGH_LOADING",
  "UNILATERAL",
  "LOW_IMPACT",
  "GOOD_FOR_SUPERSETS",
  "MACHINE",
  "FREE_WEIGHT",
  "POWER",
  "BALANCE",
  "ASYMMETRY_FRIENDLY",
] as const;
export type LibraryTag = (typeof LIBRARY_TAGS)[number];

export function pretty(v: string | null | undefined) {
  if (!v) return "—";
  return v.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function familySlugFor(movement: Movement): string {
  return FAMILY_DEFS.find((f) => (f.movements as readonly string[]).includes(movement))?.slug ?? "mobility";
}

export const ENVIRONMENTS = ["COMMERCIAL_GYM", "HOME_GYM", "HOME_MINIMAL_EQUIPMENT", "OUTDOORS", "POOL", "TRACK", "CLINIC"] as const;
export type ExEnvironment = (typeof ENVIRONMENTS)[number];

export type ExerciseKb = {
  slug: string;
  name: string;
  display_name: string;
  description: string;
  category: Category;
  movement_pattern: Movement;
  legacy_pattern: LegacyPattern;
  training_qualities: ExQuality[];
  primary_regions: Region[];
  secondary_regions: Region[];
  laterality: Laterality;
  equipment_required: KbEquipment[];
  equipment_optional: KbEquipment[];
  difficulty_level: Difficulty;
  technical_complexity: Lmh;
  stability_requirement: Lmhv;
  ankle_mobility_requirement: Lmh;
  hip_mobility_requirement: Lmh;
  shoulder_mobility_requirement: Lmh;
  thoracic_mobility_requirement: Lmh;
  loading_potential: Lmhv;
  hypertrophy_suitability: Lmhv;
  strength_suitability: Lmhv;
  power_suitability: Lmhv;
  general_wellness_suitability: Lmhv;
  foundation_suitability: FoundationFit;
  time_efficiency: Lmh;
  systemic_fatigue_cost: Lmhv;
  local_fatigue_cost: Lmhv;
  impact_level: Lmh;
  landing_demand: Lmh;
  setup_complexity: Lmh;
  exercise_environment: ExEnvironment[];
  contraindication_tags: string[];
  caution_tags: string[];
  superset_compatibility_tags: string[];
  tags: string[];
  instructions: string;
  coaching_cues: string;
  common_errors: string;
  video_url: string;
  progression_potential: Lmh;
  family_slug: string;
  ai_selection_enabled: boolean;
  practitioner_approved: boolean;
  review_status: ReviewStatus;
  source: ExSource;
  active: boolean;
};

export type ExerciseRecord = ExerciseKb & {
  id: string;
  practitioner_id: string | null;
  family_id: string | null;
  updated_at: string | null;
  used_count: number;
};

export type ExerciseRel = { from_slug: string; to_slug: string; type: RelType };

export type SlotIntent =
  | "POWER"
  | "KNEE_DOMINANT"
  | "HIP_DOMINANT"
  | "UNILATERAL_LOWER"
  | "UPPER_PUSH"
  | "UPPER_PULL"
  | "CARRY"
  | "TRUNK"
  | "AEROBIC"
  | "MOBILITY"
  | "BALANCE"
  | "KNEE_ISOLATION"
  | "HIP_ISOLATION"
  | "RECOVERY";

export type SessionSlot = {
  slot_id: string;
  intent: SlotIntent;
  quality: Quality | ExQuality;
  priority: import("@/lib/priority-engine/types").PriorityLevel | "MAINTAIN";
  pattern_hint: Movement | null;
  laterality_hint: Laterality | null;
  label: string;
};

export type Candidate = {
  exercise: ExerciseRecord;
  score: number;
  reasons: string[];
  penalties: string[];
  hard_fail: string | null;
};

export type SelectedExercise = {
  slot_id: string;
  intent: SlotIntent;
  quality: string;
  priority: string;
  exercise_id: string;
  slug: string;
  name: string;
  laterality: Laterality;
  equipment_used: KbEquipment[];
  selection_reason: string[];
  client_reason: string;
  eligible_alternatives: { id: string; slug: string; name: string; score: number; why: string[] }[];
  regression_options: { id: string; name: string }[];
  progression_options: { id: string; name: string }[];
  constraint_flags: string[];
  practitioner_locked: boolean;
  order: number;
};

export type SelectedSession = {
  day: string;
  session_type: string;
  label: string;
  duration_minutes: number;
  exercises: SelectedExercise[];
};

export type SelectionResult = {
  sessions: SelectedSession[];
  unused_priorities: string[];
  rationale: string[];
  weights_id: string;
};

export type SelectionOverride = {
  locks: Record<string, string>; // slot_id → exercise slug
  replacements: Record<string, string>;
  removed_slot_ids: string[];
  added: { day: string; slug: string; intent: SlotIntent }[];
  reason: string;
};

export type ExerciseHistorySummary = {
  exercise_id: string;
  slug: string | null;
  name: string;
  sessions_completed: number;
  average_rpe: number | null;
  pain_reports: number;
  last_prescribed: string | null;
};

export const WEIGHTS_ID = "v1_selection_framework";

export const SCORE_W = {
  quality_match: 6,
  goal_suitability: 4,
  stage_match: 3,
  competency_match: 3,
  mobility_fit: 2,
  stability_fit: 2,
  time_efficiency: 2,
  preference: 3,
  previous_success: 3,
  loading_for_goal: 3,
  unilateral_for_asym: 3,
  complexity_penalty: 3,
  fatigue_penalty: 2,
  redundancy_penalty: 5,
  dislike_penalty: 2,
};

export function movementToLegacy(m: Movement): LegacyPattern {
  if (m === "SQUAT" || m === "KNEE_EXTENSION") return "squat";
  if (m === "HINGE" || m === "HIP_EXTENSION" || m === "KNEE_FLEXION") return "hinge";
  if (m === "LUNGE_SPLIT_SQUAT" || m === "STEP") return "lunge";
  if (m === "HORIZONTAL_PUSH" || m === "VERTICAL_PUSH") return "push";
  if (m === "HORIZONTAL_PULL" || m === "VERTICAL_PULL") return "pull";
  if (m === "CARRY" || m === "GRIP") return "carry";
  if (m === "ANTI_ROTATION" || m === "ANTI_EXTENSION" || m === "ANTI_LATERAL_FLEXION" || m === "ROTATION") return "core";
  if (m.endsWith("MOBILITY") || m === "OTHER") return m === "OTHER" ? "other" : "mobility";
  if (m === "JUMP" || m === "THROW" || m === "SPRINT") return "power";
  if (m === "WALK" || m === "RUN" || m === "CYCLE" || m === "ROW") return "conditioning";
  if (m === "HIP_ABDUCTION" || m === "HIP_ADDUCTION" || m === "CALF_PLANTARFLEXION") return "other";
  return "other";
}

export function blankExercise(): ExerciseKb {
  return {
    slug: "",
    name: "",
    display_name: "",
    description: "",
    category: "RESISTANCE",
    movement_pattern: "SQUAT",
    legacy_pattern: movementToLegacy("SQUAT"),
    training_qualities: [],
    primary_regions: [],
    secondary_regions: [],
    laterality: "BILATERAL",
    equipment_required: ["BODYWEIGHT"],
    equipment_optional: [],
    difficulty_level: "BEGINNER",
    technical_complexity: "LOW",
    stability_requirement: "MODERATE",
    ankle_mobility_requirement: "LOW",
    hip_mobility_requirement: "LOW",
    shoulder_mobility_requirement: "LOW",
    thoracic_mobility_requirement: "LOW",
    loading_potential: "MODERATE",
    hypertrophy_suitability: "MODERATE",
    strength_suitability: "MODERATE",
    power_suitability: "LOW",
    general_wellness_suitability: "HIGH",
    foundation_suitability: "GOOD",
    time_efficiency: "HIGH",
    systemic_fatigue_cost: "MODERATE",
    local_fatigue_cost: "MODERATE",
    impact_level: "LOW",
    landing_demand: "LOW",
    setup_complexity: "LOW",
    exercise_environment: ["COMMERCIAL_GYM", "HOME_GYM", "CLINIC"],
    contraindication_tags: [],
    caution_tags: [],
    superset_compatibility_tags: [],
    tags: [],
    instructions: "",
    coaching_cues: "",
    common_errors: "",
    video_url: "",
    progression_potential: "MODERATE",
    family_slug: familySlugFor("SQUAT"),
    ai_selection_enabled: false,
    practitioner_approved: false,
    review_status: "PENDING_REVIEW",
    source: "PRACTITIONER",
    active: true,
  };
}
