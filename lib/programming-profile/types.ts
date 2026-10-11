/**
 * Client Programming Profile V1 — types and enumerations.
 * These variables are deliberately kept separate. Do not collapse them into
 * a single "fitness level".
 */

export const PROGRAM_MODES = ["GENERAL_WELLNESS", "PERFORMANCE"] as const;
export type ProgramMode = (typeof PROGRAM_MODES)[number];

export const GOALS = [
  "GENERAL_HEALTH_LONGEVITY",
  "HYPERTROPHY",
  "MAXIMAL_STRENGTH",
  "FAT_LOSS_BODY_COMPOSITION",
  "AEROBIC_FITNESS",
  "POWER",
  "MOBILITY",
  "GENERAL_FITNESS",
  "SPORT_PERFORMANCE",
  "OTHER",
] as const;
export type Goal = (typeof GOALS)[number];

export const PRIORITIES = ["LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const RELEVANCE = ["NOT_RELEVANT", "LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;
export type Relevance = (typeof RELEVANCE)[number];

export const EXPERIENCE = ["NONE", "BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type Experience = (typeof EXPERIENCE)[number];

export const VOLUME = ["NONE", "LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;
export type Volume = (typeof VOLUME)[number];

export const LMH = ["LOW", "MODERATE", "HIGH"] as const;
export type LMH = (typeof LMH)[number];

export const STAGES = ["FOUNDATION", "DEVELOPMENT", "ADVANCED"] as const;
export type Stage = (typeof STAGES)[number];

export const LOCATIONS = [
  "COMMERCIAL_GYM",
  "HOME_GYM",
  "HOME_MINIMAL_EQUIPMENT",
  "OUTDOORS",
  "POOL",
  "TRACK",
  "OTHER",
] as const;
export type Location = (typeof LOCATIONS)[number];

export const EQUIPMENT = [
  "BARBELL",
  "SQUAT_RACK",
  "BENCH",
  "DUMBBELLS",
  "KETTLEBELLS",
  "CABLE_MACHINE",
  "SELECTORISED_MACHINES",
  "LEG_PRESS",
  "LEG_EXTENSION",
  "LEG_CURL",
  "PULLUP_BAR",
  "RESISTANCE_BANDS",
  "TRX_SUSPENSION",
  "SLED",
  "MEDICINE_BALL",
  "TREADMILL",
  "BIKE",
  "ROWER",
  "SKIERG",
  "STAIR_MACHINE",
  "BOX",
  "STEP",
  "OTHER",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const STYLE_PREFS = [
  "SHORT_EFFICIENT",
  "LONGER_SESSIONS",
  "MACHINE_BASED",
  "FREE_WEIGHTS",
  "CIRCUIT_STYLE",
  "TRADITIONAL_STRENGTH",
  "BODYBUILDING_STYLE",
  "CARDIO_HEAVY",
  "VARIETY",
  "SIMPLE_REPETITIVE",
  "NO_PREFERENCE",
] as const;
export type StylePref = (typeof STYLE_PREFS)[number];

export const EXCLUSION_REASONS = [
  "PAIN",
  "MEDICAL_RESTRICTION",
  "PRACTITIONER_DECISION",
  "CLIENT_REFUSES",
  "EQUIPMENT_UNAVAILABLE",
  "OTHER",
] as const;
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export const EXCLUSION_SOURCES = ["CLIENT", "PRACTITIONER", "ASSESSMENT", "MEDICAL"] as const;
export type ExclusionSource = (typeof EXCLUSION_SOURCES)[number];

/** How an exclusion reason should be treated by exercise selection. */
export const EXCLUSION_SEVERITY: Record<ExclusionReason, "hard_review" | "hard_preference" | "environmental" | "soft"> = {
  PAIN: "hard_review",
  MEDICAL_RESTRICTION: "hard_review",
  PRACTITIONER_DECISION: "hard_review",
  CLIENT_REFUSES: "hard_preference",
  EQUIPMENT_UNAVAILABLE: "environmental",
  OTHER: "soft",
};

export const PAIN_LOCATIONS = [
  "NECK",
  "SHOULDER_L",
  "SHOULDER_R",
  "ELBOW_L",
  "ELBOW_R",
  "WRIST_HAND_L",
  "WRIST_HAND_R",
  "UPPER_BACK",
  "LOWER_BACK",
  "HIP_L",
  "HIP_R",
  "KNEE_L",
  "KNEE_R",
  "ANKLE_FOOT_L",
  "ANKLE_FOOT_R",
  "OTHER",
] as const;
export type PainLocation = (typeof PAIN_LOCATIONS)[number];

export const PERF_QUALITIES = [
  "maximal_strength",
  "power",
  "speed",
  "acceleration",
  "aerobic",
  "anaerobic",
  "mobility",
  "symmetry",
  "muscular_endurance",
  "hypertrophy",
] as const;
export type PerfQuality = (typeof PERF_QUALITIES)[number];

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

export type Exclusion = {
  exercise: string;
  reason: ExclusionReason;
  source: ExclusionSource;
  notes?: string;
};

/** Practitioner/client-entered fields. Stored in programming_profiles.profile. */
export type ProfileInput = {
  // 1–4 goals
  program_mode: ProgramMode;
  primary_goal: Goal | null;
  primary_goal_custom: string;
  secondary_goals: Goal[];
  goal_priorities: Partial<Record<Goal, Priority>>;
  goal_notes: string;

  // 5 experience (entered; auto suggestion also exists)
  training_experience: Experience | null;

  // 6 current training status
  currently_training: boolean | null;
  current_training_days_per_week: number | null;
  current_strength_sessions_per_week: number | null;
  current_cardio_sessions_per_week: number | null;
  average_session_duration_minutes: number | null;
  current_training_notes: string;

  // 9 availability
  available_training_days_per_week: number | null;
  preferred_days: Day[];
  minimum_sessions_per_week: number | null;
  preferred_sessions_per_week: number | null;
  maximum_sessions_per_week: number | null;

  // 10 duration
  minimum_session_minutes: number | null;
  preferred_session_minutes: number | null;
  maximum_session_minutes: number | null;

  // 11–12 environment
  training_locations: Location[];
  equipment: Equipment[];
  equipment_notes: string;

  // 13 preferences
  preferred_exercises: string[];
  disliked_exercises: string[];
  training_style_preferences: StylePref[];

  // 14 exclusions
  excluded_exercises: Exclusion[];

  // 15 pain
  pain_present: boolean | null;
  pain_locations: PainLocation[];
  pain_severity: number | null; // 0–10
  pain_notes: string;
  activities_that_provoke: string;
  medical_clearance_required: boolean | null;
  medical_clearance_obtained: boolean | null;
  medical_clearance_notes: string;

  // 16 tolerance inputs (auto uses these plus lifestyle from questionnaire)
  recovery_quality: LMH | null;
  recent_consistency: "NONE" | "SPORADIC" | "REGULAR" | "COMMITTED" | null;

  // 18 performance
  performance: {
    sport: string;
    event_or_position: string;
    competition_level: string;
    current_training_phase: string;
    next_major_competition_date: string;
    sport_specific_notes: string;
    qualities: Partial<Record<PerfQuality, Relevance>>;
  };

  practitioner_notes: string;
};

/** Automatically classified fields. Stored in programming_profiles.auto. */
export type AutoClassification = {
  training_experience: Experience;
  current_training_volume_category: Volume;
  movement_competency: LMH;
  tolerance_to_training: LMH;
  foundation_phase_recommended: boolean;
  training_stage: Stage;
  /** Why each value was chosen, for the practitioner to verify. */
  rationale: Partial<Record<keyof Omit<AutoClassification, "rationale">, string>>;
};

export type OverridableField = Exclude<keyof AutoClassification, "rationale">;

export type Override = { value: AutoClassification[OverridableField]; reason: string };
export type Overrides = Partial<Record<OverridableField, Override>>;

export type EffectiveClassification = Omit<AutoClassification, "rationale"> & {
  overridden: OverridableField[];
};

export const LABEL: Record<string, string> = {
  GENERAL_WELLNESS: "General wellness",
  PERFORMANCE: "Performance",
  GENERAL_HEALTH_LONGEVITY: "General health & longevity",
  HYPERTROPHY: "Hypertrophy",
  MAXIMAL_STRENGTH: "Maximal strength",
  FAT_LOSS_BODY_COMPOSITION: "Fat loss / body composition",
  AEROBIC_FITNESS: "Aerobic fitness",
  POWER: "Power",
  MOBILITY: "Mobility",
  GENERAL_FITNESS: "General fitness",
  SPORT_PERFORMANCE: "Sport performance",
  OTHER: "Other",
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  VERY_HIGH: "Very high",
  NOT_RELEVANT: "Not relevant",
  NONE: "None",
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  FOUNDATION: "Foundation",
  DEVELOPMENT: "Development",
  COMMERCIAL_GYM: "Commercial gym",
  HOME_GYM: "Home gym",
  HOME_MINIMAL_EQUIPMENT: "Home — minimal equipment",
  OUTDOORS: "Outdoors",
  POOL: "Pool",
  TRACK: "Track",
  SHORT_EFFICIENT: "Short & efficient",
  LONGER_SESSIONS: "Longer sessions",
  MACHINE_BASED: "Machine-based",
  FREE_WEIGHTS: "Free weights",
  CIRCUIT_STYLE: "Circuit style",
  TRADITIONAL_STRENGTH: "Traditional strength",
  BODYBUILDING_STYLE: "Bodybuilding style",
  CARDIO_HEAVY: "Cardio-heavy",
  VARIETY: "Variety",
  SIMPLE_REPETITIVE: "Simple & repetitive",
  NO_PREFERENCE: "No preference",
  PAIN: "Pain",
  MEDICAL_RESTRICTION: "Medical restriction",
  PRACTITIONER_DECISION: "Practitioner decision",
  CLIENT_REFUSES: "Client refuses",
  EQUIPMENT_UNAVAILABLE: "Equipment unavailable",
  CLIENT: "Client",
  PRACTITIONER: "Practitioner",
  ASSESSMENT: "Assessment",
  MEDICAL: "Medical",
  SPORADIC: "Sporadic",
  REGULAR: "Regular",
  COMMITTED: "Committed",
};

export function label(v: string | null | undefined) {
  if (!v) return "—";
  return LABEL[v] ?? v.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function emptyProfile(): ProfileInput {
  return {
    program_mode: "GENERAL_WELLNESS",
    primary_goal: null,
    primary_goal_custom: "",
    secondary_goals: [],
    goal_priorities: {},
    goal_notes: "",
    training_experience: null,
    currently_training: null,
    current_training_days_per_week: null,
    current_strength_sessions_per_week: null,
    current_cardio_sessions_per_week: null,
    average_session_duration_minutes: null,
    current_training_notes: "",
    available_training_days_per_week: null,
    preferred_days: [],
    minimum_sessions_per_week: null,
    preferred_sessions_per_week: null,
    maximum_sessions_per_week: null,
    minimum_session_minutes: null,
    preferred_session_minutes: null,
    maximum_session_minutes: null,
    training_locations: [],
    equipment: [],
    equipment_notes: "",
    preferred_exercises: [],
    disliked_exercises: [],
    training_style_preferences: [],
    excluded_exercises: [],
    pain_present: null,
    pain_locations: [],
    pain_severity: null,
    pain_notes: "",
    activities_that_provoke: "",
    medical_clearance_required: null,
    medical_clearance_obtained: null,
    medical_clearance_notes: "",
    recovery_quality: null,
    recent_consistency: null,
    performance: {
      sport: "",
      event_or_position: "",
      competition_level: "",
      current_training_phase: "",
      next_major_competition_date: "",
      sport_specific_notes: "",
      qualities: {},
    },
    practitioner_notes: "",
  };
}
