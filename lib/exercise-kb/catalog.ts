import { familySlugFor, movementToLegacy, type ExerciseKb, type ExerciseRel, type KbEquipment, type Movement } from "./types";
import type { Category, Difficulty, ExQuality, FoundationFit, Laterality, Lmh, Lmhv, Region } from "./types";

type Draft = {
  slug: string;
  name: string;
  category?: Category;
  movement: Movement;
  qualities: ExQuality[];
  primary: Region[];
  secondary?: Region[];
  laterality?: Laterality;
  equipment: KbEquipment[];
  optional?: KbEquipment[];
  difficulty?: Difficulty;
  complexity?: Lmh;
  stability?: Lmhv;
  ankle?: Lmh;
  hip?: Lmh;
  shoulder?: Lmh;
  loading?: Lmhv;
  hypertrophy?: Lmhv;
  strength?: Lmhv;
  power?: Lmhv;
  wellness?: Lmhv;
  time?: Lmh;
  fatigue?: Lmhv;
  local?: Lmhv;
  foundation?: FoundationFit;
  impact?: Lmh;
  landing?: Lmh;
  setup?: Lmh;
  env?: ExerciseKb["exercise_environment"];
  cues?: string;
  description?: string;
  contra?: string[];
  caution?: string[];
  supersets?: string[];
};

function kb(d: Draft): ExerciseKb {
  return {
    slug: d.slug,
    name: d.name,
    display_name: d.name,
    description: d.description ?? "",
    category: d.category ?? "RESISTANCE",
    movement_pattern: d.movement,
    legacy_pattern: movementToLegacy(d.movement),
    training_qualities: d.qualities,
    primary_regions: d.primary,
    secondary_regions: d.secondary ?? [],
    laterality: d.laterality ?? "BILATERAL",
    equipment_required: d.equipment,
    equipment_optional: d.optional ?? [],
    difficulty_level: d.difficulty ?? "BEGINNER",
    technical_complexity: d.complexity ?? "LOW",
    stability_requirement: d.stability ?? "MODERATE",
    ankle_mobility_requirement: d.ankle ?? "LOW",
    hip_mobility_requirement: d.hip ?? "LOW",
    shoulder_mobility_requirement: d.shoulder ?? "LOW",
    thoracic_mobility_requirement: "LOW",
    loading_potential: d.loading ?? "MODERATE",
    hypertrophy_suitability: d.hypertrophy ?? "MODERATE",
    strength_suitability: d.strength ?? "MODERATE",
    power_suitability: d.power ?? "LOW",
    general_wellness_suitability: d.wellness ?? "HIGH",
    foundation_suitability: d.foundation ?? "GOOD",
    time_efficiency: d.time ?? "HIGH",
    systemic_fatigue_cost: d.fatigue ?? "MODERATE",
    local_fatigue_cost: d.local ?? "MODERATE",
    impact_level: d.impact ?? "LOW",
    landing_demand: d.landing ?? "LOW",
    setup_complexity: d.setup ?? "LOW",
    exercise_environment: d.env ?? ["COMMERCIAL_GYM", "HOME_GYM", "CLINIC"],
    contraindication_tags: d.contra ?? [],
    caution_tags: d.caution ?? [],
    superset_compatibility_tags: d.supersets ?? [],
    tags: inferTags(d),
    instructions: "",
    coaching_cues: d.cues ?? "",
    common_errors: "",
    video_url: "",
    progression_potential: d.loading === "VERY_HIGH" || d.loading === "HIGH" ? "HIGH" : "MODERATE",
    family_slug: familySlugFor(d.movement),
    ai_selection_enabled: true,
    practitioner_approved: true,
    review_status: "LIVE",
    source: "CATALOG",
    active: true,
  };
}

function inferTags(d: Draft): string[] {
  const tags: string[] = [];
  if ((d.difficulty ?? "BEGINNER") === "FOUNDATION" || (d.difficulty ?? "BEGINNER") === "BEGINNER") tags.push("BEGINNER_FRIENDLY");
  if (d.env?.includes("HOME_GYM") || d.env?.includes("HOME_MINIMAL_EQUIPMENT") || d.equipment.includes("DUMBBELL") || d.equipment.includes("BODYWEIGHT") || d.equipment.includes("BAND")) tags.push("HOME_FRIENDLY");
  if ((d.time ?? "HIGH") === "HIGH") tags.push("TIME_EFFICIENT");
  if ((d.fatigue ?? "MODERATE") === "LOW") tags.push("LOW_FATIGUE");
  if (d.loading === "HIGH" || d.loading === "VERY_HIGH") tags.push("HIGH_LOADING");
  if (d.laterality === "UNILATERAL" || d.laterality === "ALTERNATING") {
    tags.push("UNILATERAL");
    tags.push("ASYMMETRY_FRIENDLY");
  }
  if ((d.impact ?? "LOW") === "LOW") tags.push("LOW_IMPACT");
  if (d.supersets?.length) tags.push("GOOD_FOR_SUPERSETS");
  if (d.equipment.includes("MACHINE") || d.equipment.includes("LEG_PRESS") || d.equipment.includes("LEG_EXTENSION") || d.equipment.includes("LEG_CURL")) tags.push("MACHINE");
  if (d.equipment.includes("DUMBBELL") || d.equipment.includes("BARBELL") || d.equipment.includes("KETTLEBELL")) tags.push("FREE_WEIGHT");
  if (d.qualities.includes("POWER") || d.category === "POWER" || d.category === "PLYOMETRIC") tags.push("POWER");
  if (d.qualities.includes("BALANCE") || d.category === "BALANCE") tags.push("BALANCE");
  return tags;
}

const GYM: ExerciseKb["exercise_environment"] = ["COMMERCIAL_GYM"];
const HOME: ExerciseKb["exercise_environment"] = ["COMMERCIAL_GYM", "HOME_GYM", "HOME_MINIMAL_EQUIPMENT", "CLINIC"];
const ANY: ExerciseKb["exercise_environment"] = ["COMMERCIAL_GYM", "HOME_GYM", "HOME_MINIMAL_EQUIPMENT", "OUTDOORS", "CLINIC"];

export const CATALOG: ExerciseKb[] = [
  kb({ slug: "sit_to_stand", name: "Chair Sit-to-Stand", movement: "SQUAT", qualities: ["LOWER_BODY_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "GENERAL_STRENGTH"], primary: ["QUADRICEPS", "GLUTES"], equipment: ["BODYWEIGHT"], difficulty: "FOUNDATION", complexity: "LOW", stability: "LOW", loading: "LOW", hypertrophy: "LOW", strength: "MODERATE", foundation: "EXCELLENT", fatigue: "LOW", env: ANY, cues: "Stand up without using hands if you can." }),
  kb({ slug: "sit_to_stand_fast", name: "Fast Sit-to-Stand", category: "POWER", movement: "SQUAT", qualities: ["POWER", "RAPID_FORCE_PRODUCTION", "KNEE_EXTENSOR_STRENGTH"], primary: ["QUADRICEPS", "GLUTES"], equipment: ["BODYWEIGHT"], difficulty: "FOUNDATION", complexity: "LOW", stability: "LOW", power: "HIGH", hypertrophy: "LOW", loading: "LOW", foundation: "EXCELLENT", impact: "LOW", env: ANY, cues: "Stand up quickly, sit down with control." }),
  kb({ slug: "goblet_box_squat", name: "Goblet Box Squat", movement: "SQUAT", qualities: ["LOWER_BODY_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "HIP_EXTENSOR_STRENGTH", "HYPERTROPHY", "GENERAL_STRENGTH"], primary: ["QUADRICEPS", "GLUTES"], secondary: ["HAMSTRINGS", "TRUNK"], equipment: ["DUMBBELL"], optional: ["KETTLEBELL", "BOX"], difficulty: "FOUNDATION", ankle: "LOW", hip: "MODERATE", loading: "MODERATE", hypertrophy: "HIGH", strength: "HIGH", foundation: "EXCELLENT", env: HOME, cues: "Sit to the box, stand tall." }),
  kb({ slug: "goblet_squat", name: "Goblet Squat", movement: "SQUAT", qualities: ["LOWER_BODY_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "HIP_EXTENSOR_STRENGTH", "HYPERTROPHY", "GENERAL_STRENGTH"], primary: ["QUADRICEPS", "GLUTES"], secondary: ["HAMSTRINGS", "TRUNK"], equipment: ["DUMBBELL"], optional: ["KETTLEBELL"], ankle: "MODERATE", hip: "MODERATE", loading: "MODERATE", hypertrophy: "HIGH", strength: "HIGH", foundation: "EXCELLENT", wellness: "VERY_HIGH", supersets: ["UPPER_PULL"], cues: "Elbows inside knees, chest up." }),
  kb({ slug: "box_squat", name: "Box Squat", movement: "SQUAT", qualities: ["LOWER_BODY_STRENGTH", "MAXIMAL_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "HIP_EXTENSOR_STRENGTH"], primary: ["QUADRICEPS", "GLUTES"], equipment: ["BARBELL", "SQUAT_RACK", "BOX"], optional: ["DUMBBELL"], difficulty: "BEGINNER", complexity: "MODERATE", ankle: "LOW", hip: "MODERATE", loading: "VERY_HIGH", hypertrophy: "HIGH", strength: "VERY_HIGH", foundation: "GOOD", fatigue: "HIGH", setup: "MODERATE", env: GYM }),
  kb({ slug: "back_squat", name: "Barbell Back Squat", movement: "SQUAT", qualities: ["MAXIMAL_STRENGTH", "LOWER_BODY_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "HIP_EXTENSOR_STRENGTH", "HYPERTROPHY"], primary: ["QUADRICEPS", "GLUTES"], secondary: ["HAMSTRINGS", "TRUNK"], equipment: ["BARBELL", "SQUAT_RACK"], difficulty: "INTERMEDIATE", complexity: "HIGH", stability: "MODERATE", ankle: "HIGH", hip: "HIGH", loading: "VERY_HIGH", hypertrophy: "HIGH", strength: "VERY_HIGH", foundation: "POSSIBLE", fatigue: "HIGH", setup: "MODERATE", env: GYM, caution: ["ankle_limitation", "high_skill"] }),
  kb({ slug: "front_squat", name: "Front Squat", movement: "SQUAT", qualities: ["MAXIMAL_STRENGTH", "LOWER_BODY_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "HYPERTROPHY"], primary: ["QUADRICEPS"], secondary: ["GLUTES", "TRUNK"], equipment: ["BARBELL", "SQUAT_RACK"], difficulty: "INTERMEDIATE", complexity: "HIGH", ankle: "HIGH", hip: "MODERATE", shoulder: "MODERATE", loading: "VERY_HIGH", hypertrophy: "HIGH", strength: "VERY_HIGH", foundation: "POSSIBLE", fatigue: "HIGH", env: GYM }),
  kb({ slug: "hack_squat", name: "Hack Squat", movement: "SQUAT", qualities: ["KNEE_EXTENSOR_STRENGTH", "LOWER_BODY_STRENGTH", "HYPERTROPHY"], primary: ["QUADRICEPS"], secondary: ["GLUTES"], equipment: ["MACHINE"], difficulty: "BEGINNER", complexity: "LOW", stability: "LOW", ankle: "MODERATE", loading: "VERY_HIGH", hypertrophy: "VERY_HIGH", strength: "HIGH", foundation: "EXCELLENT", fatigue: "MODERATE", env: GYM }),
  kb({ slug: "leg_press", name: "Leg Press", movement: "SQUAT", qualities: ["LOWER_BODY_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "HIP_EXTENSOR_STRENGTH", "HYPERTROPHY", "MAXIMAL_STRENGTH"], primary: ["QUADRICEPS", "GLUTES"], secondary: ["HAMSTRINGS"], equipment: ["LEG_PRESS"], difficulty: "FOUNDATION", complexity: "LOW", stability: "LOW", ankle: "LOW", loading: "VERY_HIGH", hypertrophy: "VERY_HIGH", strength: "VERY_HIGH", foundation: "EXCELLENT", fatigue: "MODERATE", env: GYM }),
  kb({ slug: "leg_extension", name: "Leg Extension", movement: "KNEE_EXTENSION", qualities: ["KNEE_EXTENSOR_STRENGTH", "HYPERTROPHY"], primary: ["QUADRICEPS"], laterality: "BILATERAL", equipment: ["LEG_EXTENSION"], difficulty: "FOUNDATION", complexity: "LOW", stability: "LOW", loading: "HIGH", hypertrophy: "VERY_HIGH", strength: "HIGH", power: "LOW", foundation: "EXCELLENT", fatigue: "LOW", local: "HIGH", env: GYM }),
  kb({ slug: "supported_bw_split_squat", name: "Supported Bodyweight Split Squat", movement: "LUNGE_SPLIT_SQUAT", qualities: ["LOWER_BODY_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "HIP_EXTENSOR_STRENGTH", "UNILATERAL_CONTROL", "BALANCE"], primary: ["QUADRICEPS", "GLUTES"], secondary: ["HAMSTRINGS", "CALVES", "TRUNK"], laterality: "UNILATERAL", equipment: ["BODYWEIGHT", "SUPPORT_OBJECT"], difficulty: "FOUNDATION", complexity: "LOW", stability: "MODERATE", ankle: "MODERATE", hip: "MODERATE", loading: "LOW", hypertrophy: "MODERATE", strength: "MODERATE", foundation: "EXCELLENT", env: ANY }),
  kb({ slug: "supported_db_split_squat", name: "Supported Dumbbell Split Squat", movement: "LUNGE_SPLIT_SQUAT", qualities: ["LOWER_BODY_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "HIP_EXTENSOR_STRENGTH", "HYPERTROPHY", "UNILATERAL_CONTROL"], primary: ["QUADRICEPS", "GLUTES"], secondary: ["HAMSTRINGS", "CALVES", "TRUNK"], laterality: "UNILATERAL", equipment: ["DUMBBELL", "SUPPORT_OBJECT"], difficulty: "BEGINNER", complexity: "LOW", stability: "MODERATE", ankle: "MODERATE", hip: "MODERATE", loading: "HIGH", hypertrophy: "HIGH", strength: "HIGH", power: "LOW", foundation: "EXCELLENT", time: "HIGH", fatigue: "MODERATE", env: HOME, cues: "Hold a rail. Same reps each side. Weaker side first." }),
  kb({ slug: "db_split_squat", name: "Dumbbell Split Squat", movement: "LUNGE_SPLIT_SQUAT", qualities: ["LOWER_BODY_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "HIP_EXTENSOR_STRENGTH", "HYPERTROPHY", "UNILATERAL_CONTROL"], primary: ["QUADRICEPS", "GLUTES"], secondary: ["HAMSTRINGS", "TRUNK"], laterality: "UNILATERAL", equipment: ["DUMBBELL"], difficulty: "BEGINNER", complexity: "MODERATE", stability: "HIGH", ankle: "MODERATE", hip: "MODERATE", loading: "HIGH", hypertrophy: "HIGH", strength: "HIGH", foundation: "GOOD", env: HOME }),
  kb({ slug: "rfe_split_squat", name: "Rear-Foot-Elevated Split Squat", movement: "LUNGE_SPLIT_SQUAT", qualities: ["LOWER_BODY_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "HYPERTROPHY", "UNILATERAL_CONTROL"], primary: ["QUADRICEPS", "GLUTES"], laterality: "UNILATERAL", equipment: ["DUMBBELL", "BENCH"], difficulty: "INTERMEDIATE", complexity: "MODERATE", stability: "VERY_HIGH", ankle: "MODERATE", hip: "HIGH", loading: "HIGH", hypertrophy: "VERY_HIGH", strength: "HIGH", foundation: "POSSIBLE", env: HOME }),
  kb({ slug: "step_up", name: "Step-up", movement: "STEP", qualities: ["LOWER_BODY_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "UNILATERAL_CONTROL", "GAIT_FUNCTION"], primary: ["QUADRICEPS", "GLUTES"], laterality: "UNILATERAL", equipment: ["BOX"], optional: ["DUMBBELL", "STEP"], difficulty: "BEGINNER", stability: "HIGH", ankle: "MODERATE", loading: "MODERATE", hypertrophy: "MODERATE", strength: "MODERATE", foundation: "GOOD", env: HOME }),
  kb({ slug: "reverse_lunge", name: "Reverse Lunge", movement: "LUNGE_SPLIT_SQUAT", qualities: ["LOWER_BODY_STRENGTH", "KNEE_EXTENSOR_STRENGTH", "UNILATERAL_CONTROL"], primary: ["QUADRICEPS", "GLUTES"], laterality: "UNILATERAL", equipment: ["DUMBBELL"], optional: ["BODYWEIGHT"], stability: "HIGH", foundation: "GOOD", env: HOME }),
  kb({ slug: "trap_bar_deadlift", name: "Trap Bar Deadlift", movement: "HINGE", qualities: ["MAXIMAL_STRENGTH", "LOWER_BODY_STRENGTH", "HIP_EXTENSOR_STRENGTH", "GRIP_STRENGTH"], primary: ["GLUTES", "HAMSTRINGS"], secondary: ["QUADRICEPS", "FOREARMS_GRIP", "TRUNK"], equipment: ["BARBELL"], difficulty: "BEGINNER", complexity: "MODERATE", loading: "VERY_HIGH", hypertrophy: "HIGH", strength: "VERY_HIGH", foundation: "GOOD", fatigue: "HIGH", setup: "MODERATE", env: GYM }),
  kb({ slug: "barbell_rdl", name: "Romanian Deadlift", movement: "HINGE", qualities: ["LOWER_BODY_STRENGTH", "HIP_EXTENSOR_STRENGTH", "HYPERTROPHY", "MAXIMAL_STRENGTH"], primary: ["HAMSTRINGS", "GLUTES"], secondary: ["TRUNK"], equipment: ["BARBELL"], optional: ["DUMBBELL"], difficulty: "BEGINNER", complexity: "MODERATE", hip: "MODERATE", loading: "VERY_HIGH", hypertrophy: "VERY_HIGH", strength: "HIGH", foundation: "GOOD", fatigue: "HIGH", env: GYM }),
  kb({ slug: "db_rdl", name: "Dumbbell RDL", movement: "HINGE", qualities: ["LOWER_BODY_STRENGTH", "HIP_EXTENSOR_STRENGTH", "HYPERTROPHY"], primary: ["HAMSTRINGS", "GLUTES"], secondary: ["TRUNK"], equipment: ["DUMBBELL"], complexity: "MODERATE", hip: "MODERATE", loading: "HIGH", hypertrophy: "HIGH", strength: "HIGH", foundation: "EXCELLENT", env: HOME }),
  kb({ slug: "sl_rdl", name: "Single-leg RDL", movement: "HINGE", qualities: ["HIP_EXTENSOR_STRENGTH", "UNILATERAL_CONTROL", "BALANCE"], primary: ["HAMSTRINGS", "GLUTES"], laterality: "UNILATERAL", equipment: ["DUMBBELL"], difficulty: "INTERMEDIATE", complexity: "HIGH", stability: "VERY_HIGH", hip: "MODERATE", loading: "MODERATE", hypertrophy: "MODERATE", foundation: "POSSIBLE", env: HOME }),
  kb({ slug: "hip_thrust", name: "Hip Thrust", movement: "HIP_EXTENSION", qualities: ["HIP_EXTENSOR_STRENGTH", "HYPERTROPHY", "LOWER_BODY_STRENGTH"], primary: ["GLUTES"], secondary: ["HAMSTRINGS"], equipment: ["BENCH"], optional: ["BARBELL", "DUMBBELL"], complexity: "LOW", stability: "LOW", loading: "VERY_HIGH", hypertrophy: "VERY_HIGH", strength: "HIGH", foundation: "EXCELLENT", env: HOME }),
  kb({ slug: "leg_curl", name: "Leg Curl", movement: "KNEE_FLEXION", qualities: ["KNEE_FLEXOR_STRENGTH", "HYPERTROPHY"], primary: ["HAMSTRINGS"], equipment: ["LEG_CURL"], complexity: "LOW", stability: "LOW", loading: "HIGH", hypertrophy: "VERY_HIGH", strength: "MODERATE", foundation: "EXCELLENT", fatigue: "LOW", local: "HIGH", env: GYM }),
  kb({ slug: "hip_abduction", name: "Side-lying Hip Abduction", movement: "HIP_ABDUCTION", qualities: ["HIP_ABDUCTION_STRENGTH", "UNILATERAL_CONTROL"], primary: ["HIP_ABDUCTORS"], laterality: "UNILATERAL", equipment: ["BODYWEIGHT"], optional: ["BAND"], difficulty: "FOUNDATION", stability: "LOW", loading: "LOW", hypertrophy: "MODERATE", foundation: "EXCELLENT", fatigue: "LOW", env: ANY }),
  kb({ slug: "calf_raise", name: "Calf Raise", movement: "CALF_PLANTARFLEXION", qualities: ["HYPERTROPHY", "GENERAL_STRENGTH"], primary: ["CALVES"], equipment: ["BODYWEIGHT"], optional: ["DUMBBELL", "MACHINE"], stability: "LOW", loading: "HIGH", hypertrophy: "HIGH", foundation: "EXCELLENT", fatigue: "LOW", env: ANY }),
  kb({ slug: "machine_chest_press", name: "Machine Chest Press", movement: "HORIZONTAL_PUSH", qualities: ["UPPER_BODY_STRENGTH", "HYPERTROPHY"], primary: ["CHEST", "SHOULDERS"], secondary: ["TRICEPS"], equipment: ["MACHINE"], complexity: "LOW", stability: "LOW", loading: "HIGH", hypertrophy: "HIGH", strength: "HIGH", foundation: "EXCELLENT", fatigue: "LOW", env: GYM, supersets: ["UPPER_PULL"] }),
  kb({ slug: "db_bench", name: "Dumbbell Bench Press", movement: "HORIZONTAL_PUSH", qualities: ["UPPER_BODY_STRENGTH", "HYPERTROPHY"], primary: ["CHEST", "SHOULDERS"], secondary: ["TRICEPS"], equipment: ["DUMBBELL", "BENCH"], complexity: "LOW", loading: "HIGH", hypertrophy: "HIGH", strength: "HIGH", foundation: "EXCELLENT", env: HOME, supersets: ["UPPER_PULL"] }),
  kb({ slug: "push_up", name: "Push-up", movement: "HORIZONTAL_PUSH", qualities: ["UPPER_BODY_STRENGTH", "GENERAL_STRENGTH"], primary: ["CHEST", "SHOULDERS"], secondary: ["TRICEPS", "TRUNK"], equipment: ["BODYWEIGHT"], loading: "LOW", hypertrophy: "MODERATE", strength: "MODERATE", foundation: "GOOD", env: ANY }),
  kb({ slug: "incline_push_up", name: "Incline Push-up", movement: "HORIZONTAL_PUSH", qualities: ["UPPER_BODY_STRENGTH"], primary: ["CHEST", "SHOULDERS"], equipment: ["BODYWEIGHT", "BENCH"], optional: ["BOX"], difficulty: "FOUNDATION", loading: "LOW", foundation: "EXCELLENT", env: HOME }),
  kb({ slug: "db_ohp", name: "Dumbbell Overhead Press", movement: "VERTICAL_PUSH", qualities: ["UPPER_BODY_STRENGTH", "HYPERTROPHY"], primary: ["SHOULDERS"], secondary: ["TRICEPS"], equipment: ["DUMBBELL"], complexity: "MODERATE", shoulder: "MODERATE", loading: "HIGH", hypertrophy: "HIGH", strength: "HIGH", foundation: "GOOD", env: HOME, supersets: ["UPPER_PULL"] }),
  kb({ slug: "cable_row", name: "Cable Row", movement: "HORIZONTAL_PULL", qualities: ["UPPER_BODY_STRENGTH", "HYPERTROPHY"], primary: ["UPPER_BACK", "LATS"], secondary: ["BICEPS"], equipment: ["CABLE"], complexity: "LOW", stability: "LOW", loading: "HIGH", hypertrophy: "HIGH", strength: "HIGH", foundation: "EXCELLENT", env: GYM, supersets: ["UPPER_PUSH"] }),
  kb({ slug: "db_row", name: "Dumbbell Row", movement: "HORIZONTAL_PULL", qualities: ["UPPER_BODY_STRENGTH", "HYPERTROPHY"], primary: ["UPPER_BACK", "LATS"], secondary: ["BICEPS"], laterality: "UNILATERAL", equipment: ["DUMBBELL"], optional: ["BENCH"], complexity: "LOW", loading: "HIGH", hypertrophy: "HIGH", strength: "HIGH", foundation: "EXCELLENT", env: HOME, supersets: ["UPPER_PUSH"] }),
  kb({ slug: "lat_pulldown", name: "Lat Pulldown", movement: "VERTICAL_PULL", qualities: ["UPPER_BODY_STRENGTH", "HYPERTROPHY"], primary: ["LATS", "UPPER_BACK"], secondary: ["BICEPS"], equipment: ["CABLE"], optional: ["MACHINE"], complexity: "LOW", shoulder: "MODERATE", loading: "HIGH", hypertrophy: "HIGH", strength: "HIGH", foundation: "EXCELLENT", env: GYM }),
  kb({ slug: "band_row", name: "Band Row", movement: "HORIZONTAL_PULL", qualities: ["UPPER_BODY_STRENGTH", "GENERAL_STRENGTH"], primary: ["UPPER_BACK"], equipment: ["BAND"], loading: "LOW", hypertrophy: "LOW", strength: "MODERATE", foundation: "EXCELLENT", fatigue: "LOW", env: ANY }),
  kb({ slug: "farmer_carry", name: "Farmer Carry", category: "CARRY", movement: "CARRY", qualities: ["GRIP_STRENGTH", "TRUNK_CAPACITY", "GENERAL_STRENGTH"], primary: ["FOREARMS_GRIP", "TRUNK"], equipment: ["DUMBBELL"], optional: ["KETTLEBELL"], complexity: "LOW", loading: "HIGH", hypertrophy: "LOW", strength: "HIGH", foundation: "EXCELLENT", time: "HIGH", env: HOME }),
  kb({ slug: "suitcase_carry", name: "Suitcase Carry", category: "CARRY", movement: "CARRY", qualities: ["GRIP_STRENGTH", "TRUNK_CAPACITY", "UNILATERAL_CONTROL"], primary: ["FOREARMS_GRIP", "TRUNK"], laterality: "ASYMMETRIC_LOAD", equipment: ["DUMBBELL"], foundation: "EXCELLENT", env: HOME }),
  kb({ slug: "pallof_press", name: "Pallof Press", category: "CORE_TRUNK", movement: "ANTI_ROTATION", qualities: ["TRUNK_CAPACITY"], primary: ["TRUNK"], laterality: "UNILATERAL", equipment: ["BAND"], optional: ["CABLE"], complexity: "LOW", loading: "LOW", hypertrophy: "LOW", foundation: "EXCELLENT", fatigue: "LOW", env: HOME }),
  kb({ slug: "dead_bug", name: "Dead Bug", category: "CORE_TRUNK", movement: "ANTI_EXTENSION", qualities: ["TRUNK_CAPACITY"], primary: ["TRUNK"], equipment: ["BODYWEIGHT"], difficulty: "FOUNDATION", stability: "LOW", loading: "LOW", foundation: "EXCELLENT", fatigue: "LOW", env: ANY }),
  kb({ slug: "mb_chest_throw", name: "Medicine Ball Chest Throw", category: "POWER", movement: "THROW", qualities: ["POWER", "RAPID_FORCE_PRODUCTION"], primary: ["CHEST", "SHOULDERS"], equipment: ["MEDICINE_BALL"], difficulty: "BEGINNER", complexity: "LOW", power: "HIGH", hypertrophy: "LOW", loading: "LOW", foundation: "EXCELLENT", impact: "LOW", fatigue: "LOW", env: GYM, cues: "Throw hard, step to retrieve. Not a burnout." }),
  kb({ slug: "mb_slam", name: "Medicine Ball Slam", category: "POWER", movement: "THROW", qualities: ["POWER", "RAPID_FORCE_PRODUCTION"], primary: ["LATS", "TRUNK"], equipment: ["MEDICINE_BALL"], complexity: "LOW", power: "HIGH", foundation: "GOOD", impact: "LOW", env: GYM }),
  kb({ slug: "box_jump_step_down", name: "Box Jump (step down)", category: "PLYOMETRIC", movement: "JUMP", qualities: ["POWER", "RAPID_FORCE_PRODUCTION"], primary: ["QUADRICEPS", "GLUTES"], equipment: ["BOX"], difficulty: "BEGINNER", complexity: "MODERATE", stability: "MODERATE", power: "HIGH", foundation: "GOOD", impact: "MODERATE", landing: "LOW", env: GYM, caution: ["landing"] }),
  kb({ slug: "kb_swing", name: "Kettlebell Swing", category: "POWER", movement: "HINGE", qualities: ["POWER", "HIP_EXTENSOR_STRENGTH", "RAPID_FORCE_PRODUCTION"], primary: ["GLUTES", "HAMSTRINGS"], equipment: ["KETTLEBELL"], difficulty: "INTERMEDIATE", complexity: "MODERATE", hip: "MODERATE", power: "VERY_HIGH", hypertrophy: "MODERATE", foundation: "POSSIBLE", fatigue: "HIGH", env: HOME }),
  kb({ slug: "incline_walk", name: "Incline Walk", category: "AEROBIC", movement: "WALK", qualities: ["AEROBIC_CAPACITY", "GAIT_FUNCTION"], primary: ["CALVES", "GLUTES"], equipment: ["TREADMILL"], optional: ["BODYWEIGHT"], difficulty: "FOUNDATION", complexity: "LOW", stability: "LOW", loading: "LOW", hypertrophy: "LOW", power: "LOW", foundation: "EXCELLENT", fatigue: "LOW", time: "MODERATE", env: GYM }),
  kb({ slug: "outdoor_walk", name: "Brisk Walk", category: "AEROBIC", movement: "WALK", qualities: ["AEROBIC_CAPACITY", "GAIT_FUNCTION", "GENERAL_STRENGTH"], primary: ["CALVES", "GLUTES"], equipment: ["BODYWEIGHT"], difficulty: "FOUNDATION", loading: "LOW", foundation: "EXCELLENT", fatigue: "LOW", env: ANY }),
  kb({ slug: "bike_steady", name: "Bike — Steady", category: "AEROBIC", movement: "CYCLE", qualities: ["AEROBIC_CAPACITY"], primary: ["QUADRICEPS"], equipment: ["BIKE"], difficulty: "FOUNDATION", complexity: "LOW", stability: "LOW", loading: "LOW", foundation: "EXCELLENT", fatigue: "LOW", env: GYM }),
  kb({ slug: "bike_intervals", name: "Bike Intervals", category: "AEROBIC", movement: "CYCLE", qualities: ["AEROBIC_CAPACITY", "ANAEROBIC_CAPACITY"], primary: ["QUADRICEPS"], equipment: ["BIKE"], difficulty: "BEGINNER", loading: "LOW", foundation: "GOOD", fatigue: "HIGH", env: GYM }),
  kb({ slug: "rower_steady", name: "Rower — Steady", category: "AEROBIC", movement: "ROW", qualities: ["AEROBIC_CAPACITY"], primary: ["LATS", "QUADRICEPS"], equipment: ["ROWER"], difficulty: "BEGINNER", foundation: "GOOD", env: GYM }),
  kb({ slug: "ankle_rock", name: "Ankle Dorsiflexion Rock", category: "MOBILITY", movement: "OTHER", qualities: ["ANKLE_MOBILITY"], primary: ["CALVES"], laterality: "UNILATERAL", equipment: ["BODYWEIGHT"], optional: ["SUPPORT_OBJECT"], difficulty: "FOUNDATION", loading: "LOW", hypertrophy: "LOW", strength: "LOW", foundation: "EXCELLENT", fatigue: "LOW", env: ANY }),
  kb({ slug: "hip_90_90", name: "90/90 Hip Switch", category: "MOBILITY", movement: "OTHER", qualities: ["HIP_MOBILITY"], primary: ["HIP_ABDUCTORS", "GLUTES"], equipment: ["BODYWEIGHT"], difficulty: "FOUNDATION", loading: "LOW", foundation: "EXCELLENT", fatigue: "LOW", env: ANY }),
  kb({ slug: "wall_slide", name: "Wall Slide", category: "MOBILITY", movement: "OTHER", qualities: ["SHOULDER_MOBILITY"], primary: ["SHOULDERS"], equipment: ["BODYWEIGHT"], difficulty: "FOUNDATION", loading: "LOW", foundation: "EXCELLENT", fatigue: "LOW", env: ANY }),
  kb({ slug: "aslr_hold", name: "Supported Straight-Leg Raise Hold", category: "MOBILITY", movement: "OTHER", qualities: ["POSTERIOR_CHAIN_MOBILITY"], primary: ["HAMSTRINGS"], laterality: "UNILATERAL", equipment: ["BODYWEIGHT"], difficulty: "FOUNDATION", loading: "LOW", foundation: "EXCELLENT", fatigue: "LOW", env: ANY }),
  kb({ slug: "tandem_stand", name: "Tandem Stand", category: "BALANCE", movement: "OTHER", qualities: ["BALANCE"], primary: ["CALVES"], equipment: ["BODYWEIGHT"], optional: ["SUPPORT_OBJECT"], difficulty: "FOUNDATION", loading: "LOW", foundation: "EXCELLENT", fatigue: "LOW", env: ANY }),
];

export const RELATIONSHIPS: ExerciseRel[] = [
  { from_slug: "goblet_squat", to_slug: "goblet_box_squat", type: "REGRESSION" },
  { from_slug: "goblet_squat", to_slug: "sit_to_stand", type: "REGRESSION" },
  { from_slug: "goblet_squat", to_slug: "back_squat", type: "PROGRESSION" },
  { from_slug: "goblet_squat", to_slug: "leg_press", type: "ALTERNATIVE" },
  { from_slug: "goblet_box_squat", to_slug: "sit_to_stand", type: "REGRESSION" },
  { from_slug: "goblet_box_squat", to_slug: "goblet_squat", type: "PROGRESSION" },
  { from_slug: "back_squat", to_slug: "box_squat", type: "REGRESSION" },
  { from_slug: "back_squat", to_slug: "goblet_squat", type: "REGRESSION" },
  { from_slug: "back_squat", to_slug: "leg_press", type: "ALTERNATIVE" },
  { from_slug: "supported_db_split_squat", to_slug: "supported_bw_split_squat", type: "REGRESSION" },
  { from_slug: "supported_db_split_squat", to_slug: "db_split_squat", type: "PROGRESSION" },
  { from_slug: "db_split_squat", to_slug: "rfe_split_squat", type: "PROGRESSION" },
  { from_slug: "db_split_squat", to_slug: "supported_db_split_squat", type: "REGRESSION" },
  { from_slug: "db_split_squat", to_slug: "step_up", type: "ALTERNATIVE" },
  { from_slug: "db_split_squat", to_slug: "leg_extension", type: "ALTERNATIVE" },
  { from_slug: "leg_press", to_slug: "hack_squat", type: "ALTERNATIVE" },
  { from_slug: "leg_press", to_slug: "goblet_squat", type: "ALTERNATIVE" },
  { from_slug: "leg_extension", to_slug: "supported_db_split_squat", type: "ALTERNATIVE" },
  { from_slug: "db_rdl", to_slug: "barbell_rdl", type: "PROGRESSION" },
  { from_slug: "db_rdl", to_slug: "hip_thrust", type: "ALTERNATIVE" },
  { from_slug: "barbell_rdl", to_slug: "db_rdl", type: "REGRESSION" },
  { from_slug: "db_bench", to_slug: "incline_push_up", type: "REGRESSION" },
  { from_slug: "db_bench", to_slug: "machine_chest_press", type: "ALTERNATIVE" },
  { from_slug: "db_bench", to_slug: "db_ohp", type: "ALTERNATIVE" },
  { from_slug: "push_up", to_slug: "incline_push_up", type: "REGRESSION" },
  { from_slug: "cable_row", to_slug: "db_row", type: "ALTERNATIVE" },
  { from_slug: "db_row", to_slug: "band_row", type: "REGRESSION" },
  { from_slug: "mb_chest_throw", to_slug: "sit_to_stand_fast", type: "REGRESSION" },
  { from_slug: "box_jump_step_down", to_slug: "sit_to_stand_fast", type: "REGRESSION" },
  { from_slug: "bike_intervals", to_slug: "bike_steady", type: "REGRESSION" },
  { from_slug: "incline_walk", to_slug: "outdoor_walk", type: "ALTERNATIVE" },
];
