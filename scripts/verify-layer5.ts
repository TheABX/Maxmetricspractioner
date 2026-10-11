import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOG } from "../lib/exercise-kb/catalog";
import { selectWeek } from "../lib/exercise-kb/engine";
import type { ExerciseRecord, SelectedExercise, SelectionResult, SlotIntent } from "../lib/exercise-kb/types";
import type { RankedPriority, PriorityLevel, Quality, Severity } from "../lib/priority-engine/types";
import { emptyProfile, type EffectiveClassification, type Equipment, type Goal, type ProfileInput } from "../lib/programming-profile/types";
import { runStructureEngine } from "../lib/structure-engine/engine";
import type { StructureResult } from "../lib/structure-engine/types";
import { prescribeWeek } from "../lib/dosage-engine/engine";

const library: ExerciseRecord[] = CATALOG.map((kb, i) => ({
  ...kb,
  id: `ex-${i}`,
  practitioner_id: null,
  family_id: null,
  updated_at: null,
  used_count: 0,
}));

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

function fail(msg: string): never {
  console.error("FAIL", msg);
  process.exit(1);
}

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

function selected(slug: string, intent: SlotIntent, priority = "P1_PRIMARY"): SelectedExercise {
  const ex = library.find((e) => e.slug === slug);
  if (!ex) fail(`missing catalog ${slug}`);
  return {
    slot_id: `${intent}-${slug}`,
    intent,
    quality: ex.training_qualities[0] ?? "GENERAL_STRENGTH",
    priority,
    exercise_id: ex.id,
    slug: ex.slug,
    name: ex.name,
    laterality: ex.laterality,
    equipment_used: ex.equipment_required,
    selection_reason: [],
    client_reason: "",
    eligible_alternatives: [],
    regression_options: [],
    progression_options: [],
    constraint_flags: [],
    practitioner_locked: false,
    order: 1,
  };
}

function dose(
  profile: ProfileInput,
  eff: EffectiveClassification,
  priorities: RankedPriority[],
  exercises: SelectedExercise[],
  extras: { minutes?: number; sport?: StructureResult["weekly_schedule"][0]["sport_load"]; week?: number; structure?: StructureResult } = {},
) {
  const structure =
    extras.structure ??
    runStructureEngine({
      profile,
      effective: eff,
      priorities,
    });
  const selection: SelectionResult = {
    sessions: [
      {
        day: structure.weekly_schedule.find((s) => s.kind === "PRESCRIBED")?.day ?? "mon",
        session_type: "FULL_BODY_STRENGTH",
        label: "Test",
        duration_minutes: extras.minutes ?? 60,
        exercises,
      },
    ],
    unused_priorities: [],
    rationale: [],
    weights_id: "test",
  };
  if (extras.sport) {
    structure.weekly_schedule = structure.weekly_schedule.map((s) =>
      s.day === selection.sessions[0].day ? { ...s, sport_load: extras.sport! } : s,
    );
  }
  return prescribeWeek({
    selection,
    library,
    profile,
    effective: eff,
    priorities,
    structure,
    weekNumber: extras.week ?? 6,
  });
}

function first(result: ReturnType<typeof prescribeWeek>, slug: string) {
  const hit = result.sessions.flatMap((s) => s.exercises).find((e) => e.slug === slug);
  if (!hit) fail(`no prescription for ${slug}`);
  return hit;
}

const foundationProfile: ProfileInput = {
  ...emptyProfile(),
  program_mode: "GENERAL_WELLNESS",
  primary_goal: "GENERAL_HEALTH_LONGEVITY",
  training_experience: "BEGINNER",
  preferred_sessions_per_week: 3,
  preferred_session_minutes: 45,
  training_locations: ["COMMERCIAL_GYM"],
  equipment: GYM,
};
const foundationPri = [rp("LOWER_BODY_STRENGTH", "P1_PRIMARY", "HIGH")];
const goblet = first(
  dose(foundationProfile, effective(), foundationPri, [selected("goblet_squat", "KNEE_DOMINANT")]),
  "goblet_squat",
);
if (goblet.sets !== 2 || goblet.reps_min !== 8 || goblet.reps_max !== 10) fail(`foundation goblet ${goblet.sets}×${goblet.reps_min}–${goblet.reps_max}`);
if (goblet.rir_min !== 3) fail(`foundation goblet RIR ${goblet.rir_min}`);
if (goblet.rest_seconds_min < 90 || goblet.rest_seconds_max > 120) fail(`foundation goblet rest ${goblet.rest_seconds_min}–${goblet.rest_seconds_max}`);
if (goblet.progression_method !== "DOUBLE_PROGRESSION") fail("foundation should use double progression");

const hyperProfile: ProfileInput = {
  ...emptyProfile(),
  program_mode: "PERFORMANCE",
  primary_goal: "HYPERTROPHY" satisfies Goal,
  training_experience: "INTERMEDIATE",
  preferred_sessions_per_week: 4,
  preferred_session_minutes: 60,
  training_locations: ["COMMERCIAL_GYM"],
  equipment: GYM,
};
const hyperEff = effective({
  training_experience: "INTERMEDIATE",
  training_stage: "DEVELOPMENT",
  current_training_volume_category: "MODERATE",
  foundation_phase_recommended: false,
});
const press = first(
  dose(hyperProfile, hyperEff, [rp("HYPERTROPHY", "P1_PRIMARY", "HIGH"), rp("KNEE_EXTENSOR_STRENGTH", "P1_PRIMARY")], [selected("leg_press", "KNEE_DOMINANT")], { week: 6 }),
  "leg_press",
);
if (press.sets !== 3 || press.reps_min !== 8 || press.reps_max !== 12) fail(`hypertrophy press ${press.sets}×${press.reps_min}–${press.reps_max}`);
if (press.rir_min !== 1 || press.rir_max !== 2) fail(`hypertrophy press RIR ${press.rir_min}–${press.rir_max}`);
if (press.rest_seconds_min < 120 || press.rest_seconds_max > 180) fail(`hypertrophy rest ${press.rest_seconds_min}–${press.rest_seconds_max}`);
if (press.progression_method !== "DOUBLE_PROGRESSION") fail("hypertrophy should double-progress");

const strengthProfile: ProfileInput = {
  ...emptyProfile(),
  program_mode: "PERFORMANCE",
  primary_goal: "MAXIMAL_STRENGTH",
  training_experience: "ADVANCED",
  preferred_sessions_per_week: 4,
  preferred_session_minutes: 75,
  training_locations: ["COMMERCIAL_GYM"],
  equipment: GYM,
};
const squat = first(
  dose(
    strengthProfile,
    effective({
      training_experience: "ADVANCED",
      training_stage: "ADVANCED",
      current_training_volume_category: "HIGH",
      movement_competency: "HIGH",
      foundation_phase_recommended: false,
    }),
    [rp("MAXIMAL_STRENGTH", "P1_PRIMARY", "HIGH"), rp("LOWER_BODY_STRENGTH", "P1_PRIMARY")],
    [selected("back_squat", "KNEE_DOMINANT")],
    { week: 6, minutes: 75 },
  ),
  "back_squat",
);
if (squat.sets !== 4 || squat.reps_min !== 4 || squat.reps_max !== 6) fail(`strength squat ${squat.sets}×${squat.reps_min}–${squat.reps_max}`);
if (squat.rir_min !== 1 || squat.rir_max !== 2) fail(`strength squat RIR ${squat.rir_min}–${squat.rir_max}`);
if (squat.rest_seconds_min < 180 || squat.rest_seconds_max > 300) fail(`strength rest ${squat.rest_seconds_min}–${squat.rest_seconds_max}`);
if (squat.progression_method !== "LOAD_PROGRESSION") fail("advanced strength should load-progress");

const jump = first(
  dose(
    strengthProfile,
    effective({ training_stage: "ADVANCED", training_experience: "ADVANCED", foundation_phase_recommended: false, current_training_volume_category: "HIGH" }),
    [rp("POWER", "P1_PRIMARY")],
    [selected("box_jump_step_down", "POWER")],
    { week: 6 },
  ),
  "box_jump_step_down",
);
if (jump.sets !== 4 || jump.reps_min !== 3 || jump.reps_max !== 3) fail(`power ${jump.sets}×${jump.reps_min}`);
if (jump.rest_seconds_min < 120) fail("power rest too short");
if (!jump.stop_rule?.toLowerCase().includes("quality")) fail("power missing quality stop rule");

const walk = first(
  dose(foundationProfile, effective(), [rp("AEROBIC_CAPACITY", "P1_PRIMARY")], [selected("outdoor_walk", "AEROBIC")]),
  "outdoor_walk",
);
if (walk.rep_scheme_type !== "TIME_BASED" || !walk.duration_seconds) fail("aerobic should be time-based");
if (walk.rpe_min == null || walk.rpe_max == null) fail("aerobic needs RPE, not required HR");
if (walk.progression_method !== "DURATION_PROGRESSION") fail("aerobic should progress duration first");

const ankle = first(
  dose(foundationProfile, effective(), [rp("ANKLE_MOBILITY", "P2_SECONDARY")], [selected("ankle_rock", "MOBILITY", "P2_SECONDARY")], { week: 1 }),
  "ankle_rock",
);
if (ankle.sets > 3 || (ankle.reps_max ?? 99) > 12) fail("P2 mobility over-dosed");
if (ankle.weekly_frequency > 4) fail("P2 mobility too frequent");

const conflict = dose(
  strengthProfile,
  effective({ training_stage: "ADVANCED", training_experience: "ADVANCED", current_training_volume_category: "HIGH", foundation_phase_recommended: false }),
  [rp("MAXIMAL_STRENGTH", "P1_PRIMARY")],
  [selected("barbell_rdl", "HIP_DOMINANT")],
  { sport: "HIGH", minutes: 60, week: 6 },
);
if (!conflict.flags.includes("FATIGUE_CONFLICT")) fail("high sport load + heavy hinge should flag FATIGUE_CONFLICT");
if (first(conflict, "barbell_rdl").slug !== "barbell_rdl") fail("Layer 5 must not swap the selected exercise");

const many = ["goblet_squat", "db_rdl", "machine_chest_press", "cable_row", "farmer_carry", "leg_press", "leg_extension", "leg_curl"].map((slug, i) => {
  const intent: SlotIntent = slug.includes("rdl") ? "HIP_DOMINANT" : slug.includes("press") || slug.includes("chest") ? "UPPER_PUSH" : slug.includes("row") ? "UPPER_PULL" : slug.includes("carry") ? "CARRY" : slug.includes("curl") ? "HIP_DOMINANT" : slug.includes("extension") ? "KNEE_ISOLATION" : "KNEE_DOMINANT";
  return { ...selected(slug, intent), order: i + 1, slot_id: `x-${slug}` };
});
const rapid = dose(foundationProfile, effective({ current_training_volume_category: "LOW" }), foundationPri, many, { minutes: 90 });
if (!rapid.flags.includes("RAPID_VOLUME_INCREASE")) fail(`expected RAPID_VOLUME_INCREASE, got ${rapid.flags.join(",")}`);

const short = dose(foundationProfile, effective(), foundationPri, [selected("goblet_squat", "KNEE_DOMINANT"), selected("leg_extension", "KNEE_ISOLATION")], { minutes: 30 });
if (first(short, "leg_extension").sets > 2) fail("short session isolation should stay at 2 sets");

const uni = first(
  dose(foundationProfile, effective(), [rp("LEFT_RIGHT_SYMMETRY", "P3_MONITOR", "MILD")], [selected("supported_db_split_squat", "UNILATERAL_LOWER")]),
  "supported_db_split_squat",
);
if (uni.extra_weak_side_sets !== 0) fail("mild P3 asymmetry must not auto-double the weak side");
if (!uni.weaker_side_first) fail("unilateral should start weaker side first");

const wellnessPri = [
  rp("LOWER_BODY_STRENGTH", "P1_PRIMARY", "HIGH"),
  rp("AEROBIC_CAPACITY", "P1_PRIMARY"),
  rp("POWER", "P2_SECONDARY"),
];
const wellness = prescribeWeek({
  selection: selectWeek({
    library,
    profile: foundationProfile,
    effective: effective(),
    priorities: wellnessPri,
    schedule: runStructureEngine({ profile: foundationProfile, effective: effective(), priorities: wellnessPri }).weekly_schedule,
  }),
  library,
  profile: foundationProfile,
  effective: effective(),
  priorities: wellnessPri,
  structure: runStructureEngine({ profile: foundationProfile, effective: effective(), priorities: wellnessPri }),
});
if (wellness.weekly.region_sets.HAMSTRINGS > wellness.weekly.region_sets.QUADRICEPS + 4) fail("squat work counted as full hamstring sets");
if (wellness.weekly.power_exposures < 1) fail("wellness week should still expose power");
if (!wellness.sessions.some((s) => s.exercises.some((e) => e.client_line.includes("reps left in reserve") || e.client_line.includes("conversational") || e.client_line.includes("quality")))) {
  fail("client lines missing");
}

const src = readFileSync(join(__dirname, "../lib/dosage-engine/engine.ts"), "utf8") + readFileSync(join(__dirname, "../lib/dosage-engine/weights.ts"), "utf8");
if (/chronological|years_old|\bdob\b|ageYears|client\.age/.test(src)) fail("age leaked into the dosage engine");

console.log("Layer 5 examples OK");
console.log("foundation goblet", `${goblet.sets}×${goblet.reps_min}–${goblet.reps_max} @ ${goblet.rir_min} RIR rest ${goblet.rest_seconds_min}–${goblet.rest_seconds_max}`);
console.log("hypertrophy press", `${press.sets}×${press.reps_min}–${press.reps_max} @ ${press.rir_min}–${press.rir_max} RIR`);
console.log("strength squat", `${squat.sets}×${squat.reps_min}–${squat.reps_max} @ ${squat.rir_min}–${squat.rir_max} RIR rest ${squat.rest_seconds_min}–${squat.rest_seconds_max}`);
console.log("power", `${jump.sets}×${jump.reps_min} rest ${jump.rest_seconds_min}–${jump.rest_seconds_max}`);
console.log("weekly wellness", wellness.weekly);
