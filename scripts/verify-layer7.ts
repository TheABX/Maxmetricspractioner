import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adaptWeek } from "../lib/adaptation-engine/engine";
import { encourage, missedSessions, painFollowup, strongProgress } from "../lib/adaptation-engine/messages";
import type { AdaptationResult, ClientAdaptation } from "../lib/adaptation-engine/types";
import type { Prescription } from "../lib/dosage-engine/types";
import { answerCoach } from "../lib/comms-engine/coach";
import { canAutoSend, parseReply, planCommunications, requiresApproval } from "../lib/comms-engine/engine";
import { DEFAULT_PRACTITIONER, DEFAULT_PREFS, type CommsInput, type PractitionerComms } from "../lib/comms-engine/types";

function fail(msg: string): never {
  console.error("FAIL", msg);
  process.exit(1);
}

function client(partial: Partial<ClientAdaptation> = {}): ClientAdaptation {
  return {
    window_days: 14,
    sessions_prescribed: 6,
    sessions_completed: 5,
    sessions_skipped: 1,
    adherence_percent: 83,
    adherence_band: "GOOD",
    pain_status: "NONE",
    recovery_trend: "STABLE",
    strength_trend: "IMPROVING",
    duration_mismatch: false,
    retest_due: false,
    traffic: "GREEN",
    fortnightly_outcome: "NO_ACTION",
    summary: "",
    messages: [],
    queue: [],
    possible_adherence_reasons: [],
    ...partial,
  };
}

function result(c: Partial<ClientAdaptation> = {}, extra: Partial<AdaptationResult> = {}): AdaptationResult {
  return {
    exercises: extra.exercises ?? [],
    client: client(c),
    rationale: extra.rationale ?? [],
    flags: extra.flags ?? [],
    automation_level: extra.automation_level ?? "LEVEL_1_SUGGEST",
    weights_id: extra.weights_id ?? "v1",
  };
}

function plan(adaptation: AdaptationResult, extra: Partial<CommsInput> = {}, prac: Partial<PractitionerComms> = {}) {
  return planCommunications({
    adaptation,
    prefs: { ...DEFAULT_PREFS, preferred_name: "Sam", ...extra.prefs },
    practitioner: { ...DEFAULT_PRACTITIONER, ...prac },
    recent: extra.recent ?? [],
    first_name: extra.first_name ?? "Sam",
    last_training_date: extra.last_training_date ?? "2026-09-12",
    as_of: extra.as_of ?? "2026-09-14",
  });
}

const progressBody = strongProgress("Sam", "leg press", "80 kg", "90 kg").body;
const progress = plan(
  result({
    fortnightly_outcome: "ENCOURAGE",
    messages: [strongProgress("Sam", "leg press", "80 kg", "90 kg"), encourage("Sam", ["You've been really consistent and your leg press has progressed from 80 kg to 90 kg."])],
  }),
);
if (!progress.messages.some((m) => m.body.includes("90 kg"))) fail("progress message must use the logged 90 kg");
if (progress.messages.some((m) => /100 kg|smashing it/i.test(m.body))) fail("must not invent load or hype");
if (!progress.messages.some((m) => m.event_type === "PROGRESS_POSITIVE" || m.event_type === "GENERAL_ENCOURAGEMENT")) {
  fail("real progress should produce a positive message");
}

const oneMiss = plan(result({ sessions_skipped: 1, sessions_completed: 5, fortnightly_outcome: "NO_ACTION", messages: [] }));
if (oneMiss.messages.some((m) => m.event_type === "MISSED_SESSIONS")) fail("one missed session must not invent a check-in");

const twoMiss = plan(
  result({
    sessions_skipped: 2,
    sessions_completed: 4,
    adherence_band: "MODERATE",
    traffic: "AMBER",
    fortnightly_outcome: "ASK_QUESTION",
    messages: [missedSessions("Sam", 2)],
  }),
);
if (!twoMiss.messages.some((m) => m.event_type === "MISSED_SESSIONS" && /couple of sessions|2 sessions/i.test(m.body))) {
  fail("two missed sessions should produce a check-in from Layer 6 data");
}

const hard = parseReply("Yeah they're just hard, no pain.");
if (hard.pain || hard.escalate || hard.issue_type !== "training_difficulty") fail("just hard / no pain must not escalate");

const sore = parseReply("My knee has been sore every time.");
if (!sore.pain || !sore.repeated || !sore.escalate) fail("repeated knee pain should escalate");

const weird = parseReply("It feels weird.");
if (!weird.clarify || weird.pain) fail("unclear 'weird' should ask, not infer pain");

const painPlan = plan(
  result({
    pain_status: "SEVERE",
    traffic: "RED",
    fortnightly_outcome: "PRACTITIONER_REVIEW",
    messages: [painFollowup("Sam", "split squats", "right_knee")],
  }),
);
const painMsg = painPlan.messages.find((m) => m.event_type === "PAIN_REPORTED" || m.event_type === "PAIN_WORSENING");
if (!painMsg) fail("severe pain must draft a pain message");
if (painMsg.auto_send) fail("pain must not auto-send");
if (!painMsg.requires_approval) fail("pain requires practitioner approval");
if (/diagnos|meniscus|ACL|tendonitis|arthritis/i.test(painMsg.body)) fail("pain draft must not diagnose");
if (!/health professional/i.test(painPlan.messages.map((m) => m.body).join(" "))) fail("severe pain should mention a qualified health professional");

const push = answerCoach("My knee hurts but can I just push through?", { first_name: "Sam", adaptation: result() });
if (!push.escalate || !push.requires_approval) fail("push-through pain must escalate");
if (/yes|go for it|push through it/i.test(push.body)) fail("must not encourage training through pain");

const justHardReply = answerCoach("Yeah they're just hard, no pain.", { first_name: "Sam", adaptation: result() });
if (justHardReply.escalate) fail("just hard should not escalate");
if (justHardReply.event !== "COACH_REPLY") fail("just hard stays a coach reply");

const clarify = answerCoach("It feels weird.", { first_name: "Sam", adaptation: result() });
if (!/pain, tightness, instability/i.test(clarify.body)) fail("unclear feeling should ask a clarification question");

const repeat = plan(
  result({ messages: [encourage("Sam", ["You've been really consistent."])] }),
  {
    recent: [
      {
        id: "1",
        event_type: "GENERAL_ENCOURAGEMENT",
        body: encourage("Sam", ["You've been really consistent."]).body,
        status: "SENT",
        created_at: "2026-09-13T00:00:00Z",
        sent_at: "2026-09-13T00:00:00Z",
        direction: "OUT",
      },
    ],
  },
);
if (repeat.messages.some((m) => m.event_type === "GENERAL_ENCOURAGEMENT")) {
  fail("do not repeat the same encouragement within 3 days");
}

const level0 = plan(
  result({ messages: [encourage("Sam", ["You've completed 6 of 6 sessions."])] }),
  {},
  { automation: "LEVEL_0_MANUAL" },
);
if (level0.messages.some((m) => m.auto_send)) fail("LEVEL_0 must never auto-send");

const level1 = plan(result({ messages: [encourage("Sam", ["You've completed 6 of 6 sessions."])] }));
const enc = level1.messages.find((m) => m.event_type === "GENERAL_ENCOURAGEMENT");
if (!enc?.auto_send) fail("LEVEL_1 should auto-send routine encouragement when green and no pain");
if (!canAutoSend("GENERAL_ENCOURAGEMENT", "LOW", false, "LEVEL_1_ROUTINE_AUTO", result())) fail("encouragement is auto-eligible at LEVEL_1");
if (canAutoSend("PAIN_REPORTED", "HIGH", true, "LEVEL_1_ROUTINE_AUTO", result({ pain_status: "MILD" }))) fail("pain is never auto at LEVEL_1");
if (!requiresApproval("PAIN_REPORTED", "HIGH")) fail("pain requires approval");

const holiday = plan(result(), { last_training_date: "2026-09-01", prefs: { ...DEFAULT_PREFS, preferred_name: "Sam", explained_absence: true, absence_note: "holiday" } });
if (holiday.messages.some((m) => m.event_type === "INACTIVITY")) fail("explained absence must skip inactivity nag");

const inactive = plan(result({ messages: [] }), { last_training_date: "2026-08-20" });
if (!inactive.messages.some((m) => m.event_type === "INACTIVITY")) fail("14 days silent without explanation should check in");

void adaptWeek;
void progressBody;

const rx = (): Prescription => ({
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
});

const fromL6 = adaptWeek({
  prescriptions: [rx()],
  exposures: {},
  sessions: [
    { date: "2026-09-01", completed: true, skipped: false, session_rpe: 6, duration_minutes: 45, prescribed_minutes: 45, energy: null, motivation: null, sleep: null, soreness: null, fatigue: null, notes: null },
    { date: "2026-09-08", completed: false, skipped: true, session_rpe: null, duration_minutes: null, prescribed_minutes: 45, energy: null, motivation: null, sleep: null, soreness: null, fatigue: null, notes: null },
    { date: "2026-09-10", completed: false, skipped: true, session_rpe: null, duration_minutes: null, prescribed_minutes: 45, energy: null, motivation: null, sleep: null, soreness: null, fatigue: null, notes: null },
  ],
  mastery: {},
  progressions: {},
  regressions: {},
  first_name: "Sam",
  training_stage: "DEVELOPMENT",
  training_experience: "INTERMEDIATE",
  program_week: 4,
  program_weeks: 12,
  sessions_per_week: 3,
  as_of: "2026-09-14",
});
const fromL6Plan = plan(fromL6);
if (!fromL6.client.messages.some((m) => m.type === "ADHERENCE_CHECK")) fail("Layer 6 two-miss fixture drifted");
if (!fromL6Plan.messages.some((m) => m.event_type === "MISSED_SESSIONS")) fail("Layer 7 should surface Layer 6 missed-session check-in");

const src =
  readFileSync(join(__dirname, "../lib/comms-engine/engine.ts"), "utf8") +
  readFileSync(join(__dirname, "../lib/comms-engine/types.ts"), "utf8") +
  readFileSync(join(__dirname, "../lib/comms-engine/coach.ts"), "utf8") +
  readFileSync(join(__dirname, "../lib/comms-engine/load.ts"), "utf8");
if (/chronological|years_old|\bdob\b|ageYears|client\.age/.test(src)) fail("age leaked into the comms engine");

console.log("Layer 7 examples OK");
console.log("progress", progress.messages.map((m) => m.event_type).join(","), progress.fortnightly);
console.log("two-miss", twoMiss.messages[0]?.event_type, twoMiss.messages[0]?.auto_send);
console.log("pain approval", painMsg.status, painMsg.auto_send);
console.log("level0/1", level0.messages[0]?.auto_send, enc?.auto_send);
