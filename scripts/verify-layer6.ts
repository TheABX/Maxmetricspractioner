import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adaptWeek, groupExposures, painFromScore } from "../lib/adaptation-engine/engine";
import { extractNotes } from "../lib/adaptation-engine/notes";
import type { AdaptInput, Exposure } from "../lib/adaptation-engine/types";
import type { Prescription } from "../lib/dosage-engine/types";

function fail(msg: string): never {
  console.error("FAIL", msg);
  process.exit(1);
}

function rx(partial: Partial<Prescription> = {}): Prescription {
  return {
    slot_id: "s1",
    exercise_id: "ex1",
    slug: "db_split_squat",
    name: "DB Split Squat",
    intent: "UNILATERAL_LOWER",
    training_quality: "LOWER_BODY_STRENGTH",
    priority_level: "P1_PRIMARY",
    laterality: "UNILATERAL",
    sets: 3,
    extra_weak_side_sets: 0,
    weaker_side_first: true,
    rep_scheme_type: "REP_RANGE",
    reps_min: 8,
    reps_max: 12,
    target_load_type: "RIR",
    target_load_value: "2 RIR",
    rir_min: 2,
    rir_max: 2,
    rpe_min: null,
    rpe_max: null,
    rest_seconds_min: 90,
    rest_seconds_max: 120,
    tempo: null,
    hold_duration_seconds: null,
    duration_seconds: null,
    distance: null,
    power_reps_per_set: null,
    interval_work_seconds: null,
    interval_rest_seconds: null,
    interval_repeats: null,
    weekly_target_sets: 6,
    weekly_frequency: 2,
    progression_method: "DOUBLE_PROGRESSION",
    progression_criteria: "",
    stop_rule: null,
    notes: "",
    client_line: "",
    rationale: [],
    constraint_flags: [],
    practitioner_overridden: false,
    order: 1,
    ...partial,
  };
}

function exp(date: string, reps: number[], load: number, rir: number, pain: number | null = 0, notes: string[] = []): Exposure {
  return {
    date,
    reps,
    loads: reps.map(() => load),
    rirs: reps.map(() => rir),
    rpes: [],
    max_pain: pain,
    notes,
    completed_sets: reps.length,
  };
}

function run(p: Prescription, series: Exposure[], extra: Partial<AdaptInput> = {}) {
  return adaptWeek({
    prescriptions: [p],
    exposures: { [p.slug]: series, [p.slot_id]: series },
    sessions: extra.sessions ?? series.map((e) => ({
      date: e.date,
      completed: true,
      skipped: false,
      session_rpe: 6,
      duration_minutes: 45,
      prescribed_minutes: 45,
      energy: null,
      motivation: null,
      sleep: null,
      soreness: null,
      fatigue: null,
      notes: null,
    })),
    mastery: extra.mastery ?? { [p.slug]: "COMPETENT" },
    progressions: extra.progressions ?? { [p.slug]: [{ slug: "rfe_split_squat", name: "RFESS" }] },
    regressions: extra.regressions ?? { [p.slug]: [{ slug: "supported_db_split_squat", name: "Supported Split Squat" }] },
    first_name: extra.first_name ?? "Sam",
    training_stage: extra.training_stage ?? "DEVELOPMENT",
    training_experience: extra.training_experience ?? "INTERMEDIATE",
    program_week: extra.program_week ?? 5,
    program_weeks: extra.program_weeks ?? 12,
    sessions_per_week: extra.sessions_per_week ?? 3,
    as_of: extra.as_of ?? "2026-09-14",
    automation_level: extra.automation_level ?? "LEVEL_1_SUGGEST",
    override: extra.override ?? null,
  });
}

const top = [
  exp("2026-09-01", [12, 12, 12], 12, 2),
  exp("2026-09-08", [12, 12, 12], 12, 2),
];
const progressed = run(rx(), top);
const d1 = progressed.exercises[0];
if (d1.state !== "PROGRESS" || d1.action !== "INCREASE_LOAD") fail(`12/12/12 should progress load, got ${d1.state} ${d1.action}`);
if (!d1.proposed?.proposed.includes("14")) fail(`expected +2 kg on DB split squat, got ${d1.proposed?.proposed}`);

const hold = run(rx(), [exp("2026-09-01", [10, 10, 9], 12, 2), exp("2026-09-08", [10, 10, 9], 12, 2)]);
if (hold.exercises[0].state !== "HOLD") fail(`10/10/9 should HOLD, got ${hold.exercises[0].state}`);

const oneBad = run(rx(), [exp("2026-09-01", [10, 10, 9], 12, 2), exp("2026-09-08", [8, 6, 5], 12, 0)]);
if (oneBad.exercises[0].state !== "HOLD") fail(`one missed-rep session should HOLD, got ${oneBad.exercises[0].state}`);

const trend = run(rx(), [
  exp("2026-08-25", [9, 8, 7], 12, 1),
  exp("2026-09-01", [8, 7, 6], 12, 0),
  exp("2026-09-08", [8, 6, 5], 12, 0),
]);
if (!["REGRESS", "REVIEW"].includes(trend.exercises[0].state)) fail(`missed-rep trend should REVIEW/REGRESS, got ${trend.exercises[0].state}`);
if (!trend.exercises[0].client_message?.body.toLowerCase().includes("split squat")) fail("missed-rep message should name the exercise");

const easier = run(rx({ slug: "back_squat", name: "Back Squat", intent: "KNEE_DOMINANT" }), [
  exp("2026-08-25", [10], 50, 2),
  exp("2026-09-01", [10], 50, 3),
  exp("2026-09-08", [10], 50, 4),
]);
if (easier.exercises[0].state !== "PROGRESS") fail(`easier RIR trend should PROGRESS, got ${easier.exercises[0].state}`);

const pain = run(rx(), [exp("2026-09-08", [8, 8, 8], 12, 2, 8, ["Severe discomfort in my right knee doing split squats."])]);
if (pain.exercises[0].state !== "PAUSE") fail(`severe pain should PAUSE, got ${pain.exercises[0].state}`);
if (pain.client.traffic !== "RED") fail("severe pain should be RED");
if (pain.exercises[0].reasons.some((r) => /diagnos/i.test(r) && !/not a diagnosis/i.test(r))) fail("must not diagnose");

const extracted = extractNotes("Severe discomfort in my right knee doing split squats.");
if (!extracted.pain_present || extracted.severity !== "SEVERE" || extracted.location !== "RIGHT_KNEE") fail(`note extract ${JSON.stringify(extracted)}`);
if (!extractNotes("Yes, just hard.").just_hard) fail("just hard should not be treated as pain");

const learning = run(
  rx({ progression_method: "EXERCISE_PROGRESSION" }),
  top,
  { mastery: { db_split_squat: "LEARNING" } },
);
if (learning.exercises[0].action === "PROGRESS_EXERCISE") fail("LEARNING must not jump to RFESS");

const cardio = run(
  rx({
    slug: "outdoor_walk",
    name: "Brisk Walk",
    intent: "AEROBIC",
    rep_scheme_type: "TIME_BASED",
    duration_seconds: 30 * 60,
    rpe_min: 3,
    rpe_max: 4,
    progression_method: "DURATION_PROGRESSION",
    reps_min: null,
    reps_max: null,
  }),
  [
    { date: "2026-09-01", reps: [], loads: [], rirs: [], rpes: [3], max_pain: 0, notes: [], completed_sets: 1 },
    { date: "2026-09-08", reps: [], loads: [], rirs: [], rpes: [3], max_pain: 0, notes: [], completed_sets: 1 },
  ],
);
if (cardio.exercises[0].action !== "INCREASE_DURATION" || !cardio.exercises[0].proposed?.proposed.includes("35")) {
  fail(`cardio should add 5 min, got ${cardio.exercises[0].action} ${cardio.exercises[0].proposed?.proposed}`);
}

const power = run(
  rx({ slug: "box_jump_step_down", name: "Box Jump", intent: "POWER", sets: 4, reps_min: 3, reps_max: 3, progression_method: "EXERCISE_PROGRESSION" }),
  [exp("2026-09-01", [3, 3, 3, 3], 0, 4), exp("2026-09-08", [3, 3, 3, 3], 0, 4)],
);
if (power.exercises[0].action !== "HOLD_PRESCRIPTION") fail("power must not progress by adding reps");

const advanced = run(
  rx({ slug: "back_squat", name: "Back Squat", intent: "KNEE_DOMINANT", progression_method: "LOAD_PROGRESSION" }),
  [exp("2026-08-25", [5, 5, 5], 100, 2), exp("2026-09-01", [5, 5, 5], 100, 2), exp("2026-09-08", [5, 5, 5], 100, 2)],
  { training_stage: "ADVANCED", training_experience: "ADVANCED" },
);
if (advanced.exercises[0].status === "STALLED") fail("2–3 week plateau is normal for advanced — not a stall");

const sess = (date: string, completed: boolean, skipped = false) => ({
  date,
  completed,
  skipped,
  session_rpe: 6,
  duration_minutes: 45,
  prescribed_minutes: 45,
  energy: null,
  motivation: null,
  sleep: null,
  soreness: null,
  fatigue: null,
  notes: null,
});
const oneMiss = run(rx(), top, {
  sessions: [sess("2026-09-01", true), sess("2026-09-03", true), sess("2026-09-05", true), sess("2026-09-08", true), sess("2026-09-10", true), sess("2026-09-12", false, true)],
  sessions_per_week: 3,
});
if (oneMiss.client.messages.some((m) => m.type === "ADHERENCE_CHECK")) fail("one missed session must not trigger adherence check");

const twoMiss = run(rx(), top, {
  sessions: [sess("2026-09-01", true), sess("2026-09-08", false, true), sess("2026-09-10", false, true)],
  sessions_per_week: 3,
});
if (!twoMiss.client.messages.some((m) => m.type === "ADHERENCE_CHECK")) fail("two missed sessions in 14 days should check in");

const grouped = groupExposures([
  { date: "2026-09-01T10:00:00Z", reps: 12, load: 12, rir: 2, rpe: null, pain: 0, notes: null },
  { date: "2026-09-01T10:05:00Z", reps: 12, load: 12, rir: 2, rpe: null, pain: 0, notes: null },
  { date: "2026-09-01T10:10:00Z", reps: 12, load: 12, rir: 2, rpe: null, pain: 0, notes: null },
]);
if (grouped.length !== 1 || grouped[0].reps.join("/") !== "12/12/12") fail("groupExposures should collapse a session");

if (painFromScore(0) !== "NONE" || painFromScore(3) !== "MILD" || painFromScore(5) !== "MODERATE" || painFromScore(8) !== "SEVERE") {
  fail("pain bands");
}

const src = readFileSync(join(__dirname, "../lib/adaptation-engine/engine.ts"), "utf8") + readFileSync(join(__dirname, "../lib/adaptation-engine/weights.ts"), "utf8");
if (/chronological|years_old|\bdob\b|ageYears|client\.age/.test(src)) fail("age leaked into the adaptation engine");

console.log("Layer 6 examples OK");
console.log("12/12/12", d1.state, d1.action, d1.proposed?.proposed);
console.log("missed-rep trend", trend.exercises[0].state, trend.exercises[0].action);
console.log("pain", pain.exercises[0].state, pain.client.traffic);
console.log("cardio", cardio.exercises[0].action, cardio.exercises[0].proposed?.proposed);
console.log("fortnightly", progressed.client.fortnightly_outcome, progressed.client.adherence_band);
