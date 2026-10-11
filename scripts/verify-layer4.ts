import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOG } from "../lib/exercise-kb/catalog";
import { hardFail, availableEquipment, selectWeek } from "../lib/exercise-kb/engine";
import type { ExerciseRecord } from "../lib/exercise-kb/types";
import type { RankedPriority, PriorityLevel, Quality, Severity } from "../lib/priority-engine/types";
import { emptyProfile, type EffectiveClassification, type Equipment, type ProfileInput } from "../lib/programming-profile/types";
import { runStructureEngine } from "../lib/structure-engine/engine";

const library: ExerciseRecord[] = CATALOG.map((kb, i) => ({ ...kb, id: `ex-${i}`, practitioner_id: null, family_id: null, updated_at: null, used_count: 0 }));

const GYM: Equipment[] = [
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
  "MEDICINE_BALL",
  "TREADMILL",
  "BIKE",
  "ROWER",
  "BOX",
  "STEP",
];

function effective(partial: Partial<EffectiveClassification> = {}): EffectiveClassification {
  return {
    training_experience: "BEGINNER",
    current_training_volume_category: "LOW",
    movement_competency: "MODERATE",
    tolerance_to_training: "MODERATE",
    foundation_phase_recommended: true,
    training_stage: "FOUNDATION",
    overridden: [],
    ...partial,
  };
}

function rp(quality: Quality, level: PriorityLevel, severity: Severity = "MODERATE"): RankedPriority {
  return {
    quality,
    parent_quality: null,
    laterality: null,
    automatic_priority: level,
    practitioner_priority: null,
    effective_priority: level,
    override_reason: "",
    override_date: null,
    overridden_by: null,
    priority_score: 0,
    severity,
    confidence: "MODERATE",
    goal_relevance: "HIGH",
    functional_relevance: "HIGH",
    trend: "UNKNOWN",
    multi_test_support: "NONE",
    cluster: null,
    action: level === "MAINTAIN" ? "maintain" : level === "P3_MONITOR" ? "monitor" : "improve",
    why: [],
    recommended_quality_work: "",
    client_line: "",
    finding_ids: [],
  };
}

function slugs(result: ReturnType<typeof selectWeek>) {
  return result.sessions.flatMap((s) => s.exercises.map((e) => e.slug));
}

function fail(msg: string): never {
  console.error("FAIL", msg);
  process.exit(1);
}

const wellnessProfile: ProfileInput = {
  ...emptyProfile(),
  program_mode: "GENERAL_WELLNESS",
  primary_goal: "GENERAL_HEALTH_LONGEVITY",
  training_experience: "BEGINNER",
  available_training_days_per_week: 3,
  preferred_sessions_per_week: 3,
  preferred_session_minutes: 45,
  training_locations: ["COMMERCIAL_GYM"],
  equipment: GYM,
};

const wellnessPri = [
  rp("LOWER_BODY_STRENGTH", "P1_PRIMARY", "HIGH"),
  rp("AEROBIC_CAPACITY", "P1_PRIMARY", "HIGH"),
  rp("POWER", "P2_SECONDARY", "MODERATE"),
  rp("GRIP_STRENGTH", "MAINTAIN", "NONE"),
  rp("HIP_ABDUCTION_STRENGTH", "P3_MONITOR", "MILD"),
  rp("LEFT_RIGHT_SYMMETRY", "P3_MONITOR", "MILD"),
];

const wellnessStructure = runStructureEngine({
  profile: wellnessProfile,
  effective: effective(),
  priorities: wellnessPri,
});

const wellness = selectWeek({
  library,
  profile: wellnessProfile,
  effective: effective(),
  priorities: wellnessPri,
  schedule: wellnessStructure.weekly_schedule,
});

const wellnessSlugs = slugs(wellness);
const strengthDays = wellness.sessions.filter((s) => s.exercises.some((e) => e.intent === "KNEE_DOMINANT"));
const squatFamily = new Set(["back_squat", "front_squat", "hack_squat", "leg_press", "goblet_squat", "goblet_box_squat", "box_squat", "sit_to_stand"]);
for (const day of strengthDays) {
  const squats = day.exercises.filter((e) => squatFamily.has(e.slug));
  if (squats.length > 1) fail(`${day.day} stacked squat variants: ${squats.map((s) => s.slug).join(", ")}`);
}
if (!wellnessSlugs.some((s) => ["sit_to_stand_fast", "mb_chest_throw", "box_jump_step_down"].includes(s))) {
  fail(`wellness missing a low-level power tool: ${wellnessSlugs.join(", ")}`);
}
if (!wellnessSlugs.some((s) => ["goblet_squat", "goblet_box_squat", "leg_press", "sit_to_stand", "supported_db_split_squat"].includes(s))) {
  fail(`wellness missing a foundation knee-dominant: ${wellnessSlugs.join(", ")}`);
}
const hipAbdCount = wellnessSlugs.filter((s) => s === "hip_abduction").length;
if (hipAbdCount > 1) fail("P3 hip abduction consumed the week");
if (wellnessSlugs.filter((s) => s.includes("split") || s === "step_up").length > 2) fail("too much unilateral work for a mild P3 asymmetry");

const homeProfile: ProfileInput = {
  ...wellnessProfile,
  training_locations: ["HOME_GYM"],
  equipment: ["DUMBBELLS", "RESISTANCE_BANDS", "BENCH"],
};
const homeKit = availableEquipment(homeProfile);
const home = selectWeek({
  library,
  profile: homeProfile,
  effective: effective(),
  priorities: wellnessPri,
  schedule: runStructureEngine({ profile: homeProfile, effective: effective(), priorities: wellnessPri }).weekly_schedule,
});
const homeSlugs = slugs(home);
for (const blocked of ["back_squat", "cable_row", "leg_press", "hack_squat", "leg_extension"]) {
  if (homeSlugs.includes(blocked)) fail(`home selected gym-only ${blocked}`);
}
const backSquat = library.find((e) => e.slug === "back_squat")!;
if (!hardFail(backSquat, homeProfile, homeKit, effective())) fail("home should hard-fail barbell back squat");
if (!homeSlugs.includes("goblet_squat") && !homeSlugs.includes("goblet_box_squat")) fail(`home missing goblet squat family: ${homeSlugs.join(", ")}`);
if (!homeSlugs.some((s) => ["db_rdl", "hip_thrust"].includes(s))) fail(`home missing hinge: ${homeSlugs.join(", ")}`);
if (!homeSlugs.some((s) => ["db_row", "band_row"].includes(s))) fail(`home missing row: ${homeSlugs.join(", ")}`);
if (!homeSlugs.some((s) => ["db_bench", "incline_push_up", "push_up"].includes(s))) fail(`home missing push: ${homeSlugs.join(", ")}`);

const hyperProfile: ProfileInput = {
  ...emptyProfile(),
  program_mode: "GENERAL_WELLNESS",
  primary_goal: "HYPERTROPHY",
  training_experience: "INTERMEDIATE",
  available_training_days_per_week: 4,
  preferred_sessions_per_week: 4,
  preferred_session_minutes: 60,
  training_locations: ["COMMERCIAL_GYM"],
  equipment: GYM,
};
const hyperPri = [rp("HYPERTROPHY", "P1_PRIMARY", "HIGH"), rp("LOWER_BODY_STRENGTH", "P2_SECONDARY"), rp("AEROBIC_CAPACITY", "P3_MONITOR", "MILD")];
const hyper = selectWeek({
  library,
  profile: hyperProfile,
  effective: effective({ training_experience: "INTERMEDIATE", training_stage: "DEVELOPMENT", movement_competency: "MODERATE", foundation_phase_recommended: false }),
  priorities: hyperPri,
  schedule: runStructureEngine({
    profile: hyperProfile,
    effective: effective({ training_experience: "INTERMEDIATE", training_stage: "DEVELOPMENT", movement_competency: "MODERATE", foundation_phase_recommended: false }),
    priorities: hyperPri,
  }).weekly_schedule,
});
const hyperSlugs = slugs(hyper);
const hyperHits = ["hack_squat", "leg_press", "barbell_rdl", "db_rdl", "leg_extension", "leg_curl", "db_split_squat", "supported_db_split_squat", "rfe_split_squat", "calf_raise"];
if (hyperHits.filter((s) => hyperSlugs.includes(s)).length < 3) fail(`hypertrophy pool too 'functional': ${hyperSlugs.join(", ")}`);
if (hyperSlugs.includes("sit_to_stand") && !hyperSlugs.includes("leg_press") && !hyperSlugs.includes("hack_squat")) {
  fail("hypertrophy over-preferred sit-to-stand over loading machines");
}

const src = readFileSync(join(__dirname, "../lib/exercise-kb/engine.ts"), "utf8");
if (/chronological|years_old|\bdob\b|ageYears/.test(src)) fail("age leaked into the selection engine");

console.log("Layer 4 examples OK");
console.log("wellness", wellness.sessions.map((s) => `${s.day}:${s.exercises.map((e) => e.slug).join(",")}`).join(" | "));
console.log("home", home.sessions.map((s) => `${s.day}:${s.exercises.map((e) => e.slug).join(",")}`).join(" | "));
console.log("hypertrophy", hyper.sessions.map((s) => `${s.day}:${s.exercises.map((e) => e.slug).join(",")}`).join(" | "));
