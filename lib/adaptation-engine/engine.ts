/**
 * Layer 6 — progress only on evidence. One bad session is not a trend.
 */

import type { Prescription } from "@/lib/dosage-engine/types";
import type { MasteryLevel } from "@/lib/exercise-kb/types";
import {
  adjustmentNotice,
  encourage,
  missedReps,
  missedSessions,
  painFollowup,
  retestReminder,
  strongProgress,
} from "./messages";
import { extractNotes } from "./notes";
import {
  ADHERENCE,
  LIMITS,
  LOW_RISK_ACTIONS,
  PAIN,
  PROGRESS,
  WINDOWS,
  loadIncrement,
  rirFromRpe,
} from "./weights";
import {
  WEIGHTS_ID,
  type AdaptAction,
  type AdaptInput,
  type AdaptTrend,
  type AdaptationOverride,
  type AdaptationResult,
  type AdherenceBand,
  type AdherenceReason,
  type ClientAdaptation,
  type DraftMessage,
  type ExerciseDecision,
  type Exposure,
  type PainCourse,
  type PainLevel,
  type ProposedChange,
  type QueueItem,
  type ReviewOutcome,
  type Traffic,
} from "./types";

export function adaptWeek(input: AdaptInput): AdaptationResult {
  const level = input.override?.automation_level ?? input.automation_level ?? "LEVEL_1_SUGGEST";
  const asOf = input.as_of ? new Date(input.as_of) : new Date();
  const rationale = [
    `Decisions use ${WEIGHTS_ID}. Time passing is not enough to progress.`,
    `Automation ${level.replaceAll("_", " ")}. Default is suggest-only unless a low-risk rule is explicitly enabled.`,
  ];
  const exercises = input.prescriptions.map((p) =>
    decideExercise(p, input, asOf),
  );
  applyOverrides(exercises, input.override);
  const client = summariseClient(exercises, input, asOf);
  if (input.override?.suppress_messages) {
    client.messages = [];
    for (const e of exercises) e.client_message = null;
  }
  const flags = [
    ...new Set([
      ...exercises.filter((e) => e.practitioner_flag).map((e) => `${e.slug}:${e.state}`),
      ...(client.duration_mismatch ? ["SESSION_DURATION_MISMATCH"] : []),
      ...(client.retest_due ? ["RETEST_DUE"] : []),
      ...(client.traffic === "RED" ? ["CLIENT_REVIEW"] : []),
    ]),
  ];
  return { exercises, client, rationale, flags, automation_level: level, weights_id: WEIGHTS_ID };
}

function decideExercise(p: Prescription, input: AdaptInput, asOf: Date): ExerciseDecision {
  const series = (input.exposures[p.slug] ?? input.exposures[p.slot_id] ?? []).filter((e) => within(e.date, asOf, WINDOWS.month));
  const recent = series.slice(-6);
  const mastery = input.mastery[p.slug] ?? input.mastery[p.exercise_id] ?? "NOT_ATTEMPTED";
  const increment = loadIncrement(p.slug, p.name);
  const notesBits = recent.flatMap((e) => e.notes);
  const extracted = notesBits.map(extractNotes);
  const painLevel = classifyPain(recent, extracted);
  const painCourse = painTrend(recent);
  const effortTrend = effortOverLoad(recent);
  const incrementSafe = increment;

  const base = {
    slot_id: p.slot_id,
    exercise_id: p.exercise_id,
    slug: p.slug,
    name: p.name,
    intent: p.intent,
    mastery,
    mastery_suggested: null as MasteryLevel | null,
    pain_level: painLevel,
    pain_course: painCourse,
    effort_trend: effortTrend,
    load_increment: incrementSafe,
    suggested_exercise: null as ExerciseDecision["suggested_exercise"],
    client_message: null as DraftMessage | null,
    practitioner_flag: false,
  };

  if (painLevel === "SEVERE" || extracted.some((x) => x.red_flag)) {
    return finish({
      ...base,
      state: "PAUSE",
      status: "PAUSED",
      action: "PAUSE_EXERCISE",
      confidence: "HIGH",
      reasons: [
        extracted.some((x) => x.red_flag)
          ? "Note language looks concerning (swelling, instability, neurological, or function). Not a diagnosis — practitioner review."
          : "Severe pain was logged. Do not progress. Pause this movement and review.",
      ],
      proposed: change(p, "Pause this exercise", "Do not auto-progress through pain."),
      practitioner_flag: true,
      traffic: "RED",
      client_message: painFollowup(input.first_name, p.name, extracted.find((x) => x.location)?.location),
    });
  }

  if (painLevel === "MODERATE" && (painCourse === "REPEATED" || painCourse === "WORSENING")) {
    const regress = (input.regressions[p.slug] ?? [])[0];
    return finish({
      ...base,
      state: "REVIEW",
      status: "REVIEW_REQUIRED",
      action: regress ? "REGRESS_EXERCISE" : "PRACTITIONER_REVIEW",
      confidence: "MODERATE",
      reasons: ["Moderate discomfort has shown up more than once. Ask first — do not assume the cause."],
      proposed: regress
        ? { current: p.name, proposed: `Consider ${regress.name}`, reason: "Repeated discomfort on this variation.", auto_eligible: false }
        : change(p, "Modify or pause pending review", "Repeated moderate discomfort."),
      suggested_exercise: regress ? { ...regress, kind: "REGRESSION" } : null,
      practitioner_flag: true,
      traffic: "RED",
      client_message: painFollowup(input.first_name, p.name, extracted.find((x) => x.location)?.location),
    });
  }

  if (painLevel === "MILD" && painCourse === "NEW") {
    return finish({
      ...base,
      state: "HOLD",
      status: "STABLE",
      action: "ASK_CLIENT",
      confidence: "LOW",
      reasons: ["Mild isolated discomfort — monitor and ask. One report is not a regression."],
      proposed: null,
      traffic: "AMBER",
      client_message: painFollowup(input.first_name, p.name),
    });
  }

  if (recent.length < 2) {
    return finish({
      ...base,
      state: "HOLD",
      status: mastery === "NOT_ATTEMPTED" || mastery === "LEARNING" ? "LEARNING" : "STABLE",
      action: "HOLD_PRESCRIPTION",
      confidence: "LOW",
      reasons: ["Fewer than two logged exposures. Hold until there is a pattern."],
      proposed: null,
      traffic: "GREEN",
    });
  }

  if (p.intent === "AEROBIC" || p.rep_scheme_type === "TIME_BASED" || p.rep_scheme_type === "INTERVAL_BASED") {
    return decideCardio(p, recent, input, base);
  }
  if (p.intent === "POWER") {
    return decidePower(p, recent, input, base);
  }
  if (p.intent === "MOBILITY") {
    return decideMobility(p, recent, base);
  }

  const last = recent[recent.length - 1];
  const prev = recent[recent.length - 2];
  const targetRir = p.rir_min ?? 2;
  const minReps = p.reps_min ?? 0;
  const maxReps = p.reps_max ?? p.reps_min ?? 0;
  const hitTop = (e: Exposure) =>
    e.reps.length >= p.sets && e.reps.every((r) => r >= maxReps) && effortOk(e, targetRir);
  const missedMin = (e: Exposure) => e.reps.length > 0 && e.reps.some((r) => r < minReps);
  const hard = (e: Exposure) => mean(effectiveRir(e)) != null && mean(effectiveRir(e))! <= 1;
  const missedTrend = recent.slice(-PROGRESS.missed_rep_sessions).length >= PROGRESS.missed_rep_sessions && recent.slice(-PROGRESS.missed_rep_sessions).every(missedMin);

  if (missedTrend && hard(last)) {
    return finish({
      ...base,
      state: recent.slice(-PROGRESS.missed_rep_sessions).every(hard) ? "REGRESS" : "REVIEW",
      status: "STALLED",
      action: recent.slice(-PROGRESS.missed_rep_sessions).every(hard) ? "REDUCE_LOAD" : "ASK_CLIENT",
      confidence: "MODERATE",
      reasons: [
        `Missed the ${minReps}-rep floor across ${PROGRESS.missed_rep_sessions} sessions. This is a trend — ask whether it feels okay or simply hard before changing much.`,
      ],
      proposed: {
        current: labelDose(p, last),
        proposed: `Reduce load by about ${incrementSafe} and keep ${minReps}–${maxReps}`,
        reason: "Repeated minimum-rep failure at high effort.",
        auto_eligible: false,
      },
      traffic: "AMBER",
      client_message: missedReps(input.first_name, p.name),
      practitioner_flag: false,
    });
  }

  if (missedMin(last) && hard(last) && !missedMin(prev)) {
    return finish({
      ...base,
      state: "HOLD",
      status: "STABLE",
      action: "HOLD_PRESCRIPTION",
      confidence: "LOW",
      reasons: ["One tough session under the rep floor. Not a trend — hold and watch the next one."],
      proposed: null,
      traffic: "GREEN",
    });
  }

  const topCount = recent.filter(hitTop).length;
  const lastTwoTop = recent.slice(-PROGRESS.top_range_sessions).every(hitTop);
  const method = p.progression_method;

  if (lastTwoTop && painLevel === "NONE") {
    if (mastery === "LEARNING" && method === "EXERCISE_PROGRESSION") {
      return finish({
        ...base,
        state: "HOLD",
        status: "LEARNING",
        action: "HOLD_PRESCRIPTION",
        confidence: "MODERATE",
        reasons: ["Reps look easy enough for load, but mastery is still LEARNING. Do not jump variation off one good week."],
        proposed: null,
        traffic: "GREEN",
      });
    }
    if (method === "DOUBLE_PROGRESSION" || method === "LOAD_PROGRESSION") {
      const from = lastLoad(last);
      const to = from != null ? from + incrementSafe : null;
      const msg =
        from != null && to != null && from < to - 0.1
          ? strongProgress(input.first_name, p.name, `${from} kg`, `${to} kg`)
          : null;
      return finish({
        ...base,
        state: "PROGRESS",
        status: "PROGRESSING",
        action: "INCREASE_LOAD",
        confidence: topCount >= 3 ? "HIGH" : "MODERATE",
        reasons: [
          `Top of the ${minReps}–${maxReps} range hit across ${PROGRESS.top_range_sessions} sessions at ≥${targetRir} RIR, no concerning pain.`,
          method === "DOUBLE_PROGRESSION" ? "Double progression: reps are done — next step is load. Reps may drop back toward the low end." : "Load progression within the defined range.",
        ],
        proposed: {
          current: labelDose(p, last),
          proposed: to != null ? `${p.sets} × ${minReps}–${maxReps} @ ${to} kg` : `${p.sets} × ${minReps}–${maxReps}, add ${incrementSafe}`,
          reason: "Top of range achieved with target reserve.",
          auto_eligible: true,
        },
        traffic: "GREEN",
        client_message: msg,
        mastery_suggested: suggestMastery(mastery, recent, painLevel),
      });
    }
    if (method === "REP_PROGRESSION") {
      return finish({
        ...base,
        state: "PROGRESS",
        status: "PROGRESSING",
        action: "INCREASE_REPS",
        confidence: "MODERATE",
        reasons: ["Rep-first rule: add reps before load while still inside a sensible ceiling."],
        proposed: {
          current: labelDose(p, last),
          proposed: `${p.sets} × ${minReps}–${maxReps + 1}`,
          reason: "Comfortable at the top of the current range.",
          auto_eligible: true,
        },
        traffic: "GREEN",
      });
    }
  }

  if (effortTrend === "IMPROVING" && sameLoad(recent.slice(-3)) && !missedMin(last) && painLevel === "NONE") {
    return finish({
      ...base,
      state: "PROGRESS",
      status: "PROGRESSING",
      action: method === "REP_PROGRESSION" || !allAtTop(last, maxReps) ? "INCREASE_REPS" : "INCREASE_LOAD",
      confidence: "MODERATE",
      reasons: ["Same load is leaving more reserve across recent sessions — the work is getting easier."],
      proposed: {
        current: labelDose(p, last),
        proposed: allAtTop(last, maxReps) ? `Add about ${incrementSafe}` : "Add a rep or two inside the range",
        reason: "RIR/RPE trend at the same load.",
        auto_eligible: true,
      },
      traffic: "GREEN",
    });
  }

  if (effortTrend === "DECLINING" && missedMin(last)) {
    return finish({
      ...base,
      state: "REVIEW",
      status: "REGRESSING",
      action: "ASK_CLIENT",
      confidence: "LOW",
      reasons: ["Reserve is shrinking and reps are dropping. Check recovery, sleep, and how the movement feels — do not auto-deload from one reading."],
      proposed: null,
      traffic: "AMBER",
      practitioner_flag: false,
    });
  }

  const stallN = input.training_experience === "ADVANCED" || input.training_stage === "ADVANCED" ? PROGRESS.stall_exposures_advanced : PROGRESS.stall_exposures_default;
  if (recent.length >= stallN && !loadMoved(recent) && !repsMoved(recent) && recent.every((e) => !missedMin(e) || !hard(e))) {
    if (input.training_experience === "ADVANCED" && recent.length < stallN + 2) {
      return finish({
        ...base,
        state: "HOLD",
        status: "STABLE",
        action: "HOLD_PRESCRIPTION",
        confidence: "MODERATE",
        reasons: ["A short plateau is normal at this training age. Not a stall yet."],
        proposed: null,
        traffic: "GREEN",
      });
    }
    return finish({
      ...base,
      state: "HOLD",
      status: "STALLED",
      action: "HOLD_PRESCRIPTION",
      confidence: "MODERATE",
      reasons: [`No rep or load change across ${recent.length} exposures with decent adherence. Hold first — changing the exercise is last, not first.`],
      proposed: null,
      traffic: "AMBER",
    });
  }

  if (hitTop(last) && mastery === "PROFICIENT") {
    const next = (input.progressions[p.slug] ?? [])[0];
    if (next && method === "EXERCISE_PROGRESSION") {
      return finish({
        ...base,
        state: "PROGRESS",
        status: "PROGRESSING",
        action: "PROGRESS_EXERCISE",
        confidence: "LOW",
        reasons: ["Current variation looks mastered and a progression exists. Suggest only — do not swap just because a harder option is on file."],
        proposed: { current: p.name, proposed: next.name, reason: "Loading potential or complexity may now be the limiter.", auto_eligible: false },
        suggested_exercise: { ...next, kind: "PROGRESSION" },
        traffic: "GREEN",
        practitioner_flag: true,
      });
    }
  }

  const climbing = repsMoved(recent.slice(-3)) && !missedMin(last);
  return finish({
    ...base,
    state: "HOLD",
    status: climbing ? "PROGRESSING" : "STABLE",
    action: "HOLD_PRESCRIPTION",
    confidence: recent.length >= 3 ? "MODERATE" : "LOW",
    reasons: climbing
      ? ["Reps are moving inside the range at an appropriate effort. Hold the load."]
      : ["Current prescription still fits. Unnecessary change is worse than a quiet week."],
    proposed: null,
    traffic: "GREEN",
    mastery_suggested: suggestMastery(mastery, recent, painLevel),
  });
}

function decideCardio(p: Prescription, recent: Exposure[], input: AdaptInput, base: Omit<ExerciseDecision, "state" | "status" | "action" | "confidence" | "reasons" | "proposed" | "traffic">): ExerciseDecision {
  const completed = recent.filter((e) => e.completed_sets > 0);
  if (completed.length < 2) {
    return finish({ ...base, state: "HOLD", status: "STABLE", action: "HOLD_DURATION", confidence: "LOW", reasons: ["Need two completed aerobic sessions before changing duration."], proposed: null, traffic: "GREEN" });
  }
  const easy = completed.slice(-2).every((e) => {
    const rpe = mean(e.rpes);
    return rpe == null || rpe <= (p.rpe_max ?? 4) + 0.5;
  });
  if (easy && base.pain_level === "NONE") {
    const mins = Math.round((p.duration_seconds ?? 30 * 60) / 60);
    const next = mins + LIMITS.max_cardio_minutes_increase;
    return finish({
      ...base,
      state: "PROGRESS",
      status: "PROGRESSING",
      action: "INCREASE_DURATION",
      confidence: "MODERATE",
      reasons: [`Completed about ${mins} min at the target effort across two sessions. Progress duration, not intensity, this step.`],
      proposed: {
        current: `${mins} min`,
        proposed: `${next} min at the same RPE`,
        reason: "Do not raise duration and intensity together.",
        auto_eligible: true,
      },
      traffic: "GREEN",
    });
  }
  return finish({ ...base, state: "HOLD", status: "STABLE", action: "HOLD_DURATION", confidence: "MODERATE", reasons: ["Aerobic dose is being completed. Hold rather than stacking intensity on top."], proposed: null, traffic: "GREEN" });
}

function decidePower(p: Prescription, recent: Exposure[], _input: AdaptInput, base: Omit<ExerciseDecision, "state" | "status" | "action" | "confidence" | "reasons" | "proposed" | "traffic">): ExerciseDecision {
  const last = recent[recent.length - 1];
  if (last && last.max_pain && last.max_pain >= PAIN.mild_max) {
    return finish({ ...base, state: "HOLD", status: "STABLE", action: "HOLD_PRESCRIPTION", confidence: "LOW", reasons: ["Power quality first. Discomfort on landing or intent — hold volume, do not add reps."], proposed: null, traffic: "AMBER" });
  }
  return finish({
    ...base,
    state: "HOLD",
    status: "STABLE",
    action: "HOLD_PRESCRIPTION",
    confidence: "MODERATE",
    reasons: ["Power progresses by quality and intent, not extra reps. Keep the current set/rep cap."],
    proposed: null,
    traffic: "GREEN",
  });
}

function decideMobility(p: Prescription, recent: Exposure[], base: Omit<ExerciseDecision, "state" | "status" | "action" | "confidence" | "reasons" | "proposed" | "traffic">): ExerciseDecision {
  if (p.priority_level === "MAINTAIN" || p.priority_level === "P3_MONITOR") {
    return finish({ ...base, state: "HOLD", status: "STABLE", action: "HOLD_PRESCRIPTION", confidence: "MODERATE", reasons: ["Mobility at maintain/monitor — do not keep adding time."], proposed: null, traffic: "GREEN" });
  }
  const last = recent[recent.length - 1];
  if (last && (last.max_pain ?? 0) === 0 && last.completed_sets >= p.sets) {
    return finish({
      ...base,
      state: "HOLD",
      status: "PROGRESSING",
      action: "HOLD_PRESCRIPTION",
      confidence: "LOW",
      reasons: ["Mobility is being done. Progress range or control, not endless duration."],
      proposed: null,
      traffic: "GREEN",
    });
  }
  return finish({ ...base, state: "HOLD", status: "STABLE", action: "HOLD_PRESCRIPTION", confidence: "LOW", reasons: ["Keep the current mobility dose."], proposed: null, traffic: "GREEN" });
}

function summariseClient(exercises: ExerciseDecision[], input: AdaptInput, asOf: Date): ClientAdaptation {
  const window = input.sessions.filter((s) => s.date && within(s.date, asOf, WINDOWS.fortnight));
  const completed = window.filter((s) => s.completed && !s.skipped);
  const skipped = window.filter((s) => s.skipped);
  const done = completed.length;
  const missed = skipped.length;
  const prescribed = window.length || Math.round((input.sessions_per_week * WINDOWS.fortnight) / 7);
  const pct = prescribed ? done / prescribed : 1;
  const band = adherenceBand(pct);
  const worstPain = worst(exercises.map((e) => e.pain_level));
  const recovery = recoveryTrend(window);
  const strength = strengthTrend(exercises);
  const duration_mismatch = window.filter((s) => s.completed && s.duration_minutes && s.prescribed_minutes && s.duration_minutes >= s.prescribed_minutes * 1.4).length >= 2;
  const retest_due = input.program_week >= 10 && input.program_week <= input.program_weeks + 2;
  const red = exercises.some((e) => e.traffic === "RED") || worstPain === "SEVERE" || missed >= 3;
  const amber = exercises.some((e) => e.traffic === "AMBER") || band === "LOW" || band === "MODERATE" || duration_mismatch;
  const traffic: Traffic = red ? "RED" : amber ? "AMBER" : "GREEN";

  const messages: DraftMessage[] = [];
  const seen = new Set<string>();
  for (const e of exercises) {
    if (e.client_message && !seen.has(e.client_message.body)) {
      seen.add(e.client_message.body);
      messages.push(e.client_message);
    }
  }
  if (missed >= ADHERENCE.missed_check_in) {
    messages.unshift(missedSessions(input.first_name, missed));
  } else if (traffic === "GREEN" && band !== "LOW" && exercises.some((e) => e.state === "PROGRESS")) {
    const bits: string[] = [];
    if (prescribed) bits.push(`You've completed ${done} of ${prescribed} sessions.`);
    const load = exercises.find((e) => e.action === "INCREASE_LOAD" && e.proposed);
    if (load?.proposed) bits.push(`${load.name} is ready for a small load increase.`);
    messages.unshift(encourage(input.first_name, bits));
  }
  if (retest_due) messages.push(retestReminder(input.first_name, input.program_week));

  const fortnightly_outcome: ReviewOutcome = red
    ? "PRACTITIONER_REVIEW"
    : messages.some((m) => m.type === "CHECK_IN" || m.type === "PAIN_FOLLOWUP" || m.type === "ADHERENCE_CHECK")
      ? "ASK_QUESTION"
      : exercises.some((e) => e.state === "PROGRESS" && e.proposed?.auto_eligible)
        ? "AUTO_ADJUST"
        : messages.some((m) => m.type === "ENCOURAGEMENT")
          ? "ENCOURAGE"
          : "NO_ACTION";

  const reasons: AdherenceReason[] = [];
  if (band === "LOW" || band === "MODERATE") {
    if (duration_mismatch) reasons.push("PROGRAM_TOO_LONG");
    if (worstPain !== "NONE") reasons.push("PAIN");
    if (recovery === "DECLINING") reasons.push("RECOVERY");
    reasons.push("SCHEDULE", "TIME", "OTHER");
  }

  const queue: QueueItem[] = [];
  if (traffic !== "GREEN") {
    const issue = exercises.find((e) => e.traffic === traffic);
    queue.push({
      id: `client-${traffic.toLowerCase()}`,
      slot_id: issue?.slot_id ?? null,
      exercise_name: issue?.name ?? null,
      severity: traffic,
      trigger: fortnightly_outcome,
      issue: issue?.reasons[0] ?? (missed >= 2 ? `${missed} sessions missed in 14 days` : "Needs a look"),
      suggested_action: issue?.action ?? "ASK_CLIENT",
      draft_message: messages[0]?.body ?? null,
      date_detected: asOf.toISOString(),
      status: "NEW",
    });
  }
  for (const e of exercises.filter((x) => x.practitioner_flag)) {
    queue.push({
      id: e.slot_id,
      slot_id: e.slot_id,
      exercise_name: e.name,
      severity: e.traffic,
      trigger: e.state,
      issue: e.reasons[0] ?? e.state,
      suggested_action: e.action,
      draft_message: e.client_message?.body ?? null,
      date_detected: asOf.toISOString(),
      status: "NEW",
    });
  }

  const summary = [
    `${done}/${prescribed || "?"} sessions in ${WINDOWS.fortnight} days (${band.toLowerCase()} adherence).`,
    worstPain === "NONE" ? "No concerning pain trend." : `Pain status ${worstPain.toLowerCase()}.`,
    strength === "INSUFFICIENT_DATA" ? "Not enough lifting exposures for a strength trend." : `Strength trend ${strength.toLowerCase()}.`,
  ].join(" ");

  return {
    window_days: WINDOWS.fortnight,
    sessions_prescribed: prescribed,
    sessions_completed: done,
    sessions_skipped: skipped.length,
    adherence_percent: Math.round(pct * 100),
    adherence_band: band,
    pain_status: worstPain,
    recovery_trend: recovery,
    strength_trend: strength,
    duration_mismatch,
    retest_due,
    traffic,
    fortnightly_outcome,
    summary,
    messages: dedupeMessages(messages),
    queue,
    possible_adherence_reasons: reasons,
  };
}

function applyOverrides(exercises: ExerciseDecision[], override?: AdaptationOverride | null) {
  if (!override?.exercises) return;
  for (const e of exercises) {
    const o = override.exercises[e.slot_id];
    if (!o) continue;
    if (o.state) e.state = o.state;
    if (o.action) e.action = o.action;
    if (o.mastery) e.mastery = o.mastery;
    e.reasons = [...e.reasons, `Practitioner override${override.reason ? `: ${override.reason}` : ""}.`];
  }
}

function finish(d: ExerciseDecision): ExerciseDecision {
  if (d.proposed && d.action === "INCREASE_LOAD") {
    d.client_message = d.client_message ?? adjustmentNotice(d.name, d.proposed.proposed);
  }
  return d;
}

export function groupExposures(sets: { date: string; reps: number | null; load: number | null; rir: number | null; rpe: number | null; pain: number | null; notes: string | null }[]): Exposure[] {
  const map = new Map<string, Exposure>();
  for (const s of sets) {
    const day = s.date.slice(0, 10);
    const cur = map.get(day) ?? { date: day, reps: [], loads: [], rirs: [], rpes: [], max_pain: null, notes: [], completed_sets: 0 };
    if (s.reps != null) cur.reps.push(s.reps);
    if (s.load != null) cur.loads.push(s.load);
    const rir = s.rir ?? rirFromRpe(s.rpe);
    if (rir != null) cur.rirs.push(rir);
    if (s.rpe != null) cur.rpes.push(s.rpe);
    if (s.pain != null) cur.max_pain = Math.max(cur.max_pain ?? 0, s.pain);
    if (s.notes) cur.notes.push(s.notes);
    if (s.reps != null || s.load != null) cur.completed_sets += 1;
    map.set(day, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function painFromScore(n: number | null | undefined): PainLevel {
  if (n == null || n <= 0) return "NONE";
  if (n <= PAIN.mild_max) return "MILD";
  if (n <= PAIN.moderate_max) return "MODERATE";
  return "SEVERE";
}

function classifyPain(recent: Exposure[], extracted: ReturnType<typeof extractNotes>[]): PainLevel {
  if (extracted.some((x) => x.red_flag || x.severity === "SEVERE")) return "SEVERE";
  const scores = recent.map((e) => e.max_pain ?? 0);
  const max = Math.max(0, ...scores);
  const fromNotes = extracted.find((x) => x.severity)?.severity;
  const numeric = painFromScore(max);
  const rank = (l: PainLevel) => PAIN_RANK[l];
  return fromNotes && rank(fromNotes) > rank(numeric) ? fromNotes : numeric;
}

const PAIN_RANK: Record<PainLevel, number> = { NONE: 0, MILD: 1, MODERATE: 2, SEVERE: 3 };

function painTrend(recent: Exposure[]): PainCourse {
  const vals = recent.map((e) => e.max_pain ?? 0);
  if (vals.every((v) => v <= 0)) return "NONE";
  const hits = vals.filter((v) => v > 0).length;
  if (hits === 1) return "NEW";
  const a = vals.slice(0, -1).reduce((s, v) => s + v, 0) / Math.max(1, vals.length - 1);
  const b = vals[vals.length - 1];
  if (b > a + 1) return "WORSENING";
  if (b + 1 < a) return "IMPROVING";
  return "REPEATED";
}

function effortOverLoad(recent: Exposure[]): AdaptTrend {
  const slice = recent.slice(-PROGRESS.effort_trend_sessions);
  if (slice.length < 3 || !sameLoad(slice)) return slice.length < 2 ? "INSUFFICIENT_DATA" : "STABLE";
  const rirs = slice.map((e) => mean(effectiveRir(e))).filter((n): n is number => n != null);
  if (rirs.length < 3) return "INSUFFICIENT_DATA";
  if (rirs[2] >= rirs[0] + 1.5) return "IMPROVING";
  if (rirs[2] <= rirs[0] - 1.5) return "DECLINING";
  return "STABLE";
}

function effectiveRir(e: Exposure): number[] {
  if (e.rirs.length) return e.rirs;
  return e.rpes.map((rpe) => rirFromRpe(rpe)).filter((n): n is number => n != null);
}

function effortOk(e: Exposure, targetRir: number) {
  const r = mean(effectiveRir(e));
  if (r == null) return true;
  return r + 0.25 >= targetRir;
}

function sameLoad(exps: Exposure[]) {
  const loads = exps.map(lastLoad).filter((n): n is number => n != null);
  if (loads.length < 2) return false;
  return loads.every((n) => Math.abs(n - loads[0]) < 0.2);
}

function lastLoad(e: Exposure) {
  return e.loads.length ? e.loads[e.loads.length - 1] : null;
}

function allAtTop(e: Exposure, max: number) {
  return e.reps.length > 0 && e.reps.every((r) => r >= max);
}

function loadMoved(exps: Exposure[]) {
  const loads = exps.map(lastLoad).filter((n): n is number => n != null);
  return loads.length >= 2 && Math.max(...loads) - Math.min(...loads) >= 1;
}

function repsMoved(exps: Exposure[]) {
  const means = exps.map((e) => mean(e.reps)).filter((n): n is number => n != null);
  return means.length >= 2 && means[means.length - 1] - means[0] >= 1;
}

function suggestMastery(current: MasteryLevel, recent: Exposure[], pain: PainLevel): MasteryLevel | null {
  if (pain !== "NONE") return null;
  const good = recent.slice(-3).filter((e) => e.completed_sets >= 2 && (e.max_pain ?? 0) === 0);
  if (good.length >= 3 && (current === "NOT_ATTEMPTED" || current === "LEARNING")) return "COMPETENT";
  if (good.length >= 5 && current === "COMPETENT") return "PROFICIENT";
  return null;
}

function labelDose(p: Prescription, last?: Exposure) {
  const reps = p.reps_min != null ? `${p.sets} × ${p.reps_min}${p.reps_max && p.reps_max !== p.reps_min ? `–${p.reps_max}` : ""}` : `${p.sets} sets`;
  const load = last ? lastLoad(last) : null;
  return load != null ? `${reps} @ ${load} kg` : reps;
}

function change(p: Prescription, proposed: string, reason: string): ProposedChange {
  return { current: labelDose(p), proposed, reason, auto_eligible: false };
}

function adherenceBand(pct: number): AdherenceBand {
  if (pct >= ADHERENCE.excellent) return "EXCELLENT";
  if (pct >= ADHERENCE.good) return "GOOD";
  if (pct >= ADHERENCE.moderate) return "MODERATE";
  return "LOW";
}

function recoveryTrend(sessions: { sleep: number | null; fatigue: number | null; soreness: number | null; session_rpe: number | null }[]): AdaptTrend {
  const slice = sessions.filter((s) => s.sleep != null || s.fatigue != null || s.soreness != null);
  if (slice.length < 3) return "INSUFFICIENT_DATA";
  const score = (s: (typeof slice)[0]) => (s.sleep ?? 5) - (s.fatigue ?? 5) - (s.soreness ?? 3);
  const first = mean(slice.slice(0, Math.ceil(slice.length / 2)).map(score)) ?? 0;
  const last = mean(slice.slice(-Math.ceil(slice.length / 2)).map(score)) ?? 0;
  if (last > first + 1.5) return "IMPROVING";
  if (last < first - 1.5) return "DECLINING";
  return "STABLE";
}

function strengthTrend(exercises: ExerciseDecision[]): AdaptTrend {
  const lifting = exercises.filter((e) => e.intent !== "AEROBIC" && e.intent !== "MOBILITY" && e.intent !== "POWER");
  if (!lifting.length) return "INSUFFICIENT_DATA";
  if (lifting.some((e) => e.status === "REGRESSING" || e.state === "REGRESS")) return "DECLINING";
  if (lifting.some((e) => e.state === "PROGRESS")) return "IMPROVING";
  if (lifting.every((e) => e.confidence === "LOW")) return "INSUFFICIENT_DATA";
  return "STABLE";
}

function worst(levels: PainLevel[]): PainLevel {
  return levels.reduce((a, b) => (PAIN_RANK[b] > PAIN_RANK[a] ? b : a), "NONE" as PainLevel);
}

function within(date: string, asOf: Date, days: number) {
  return daysAgo(date, asOf) <= days;
}

function daysAgo(date: string, asOf: Date) {
  const d = new Date(date);
  return Math.floor((asOf.getTime() - d.getTime()) / 86400000);
}

function mean(ns: number[]) {
  if (!ns.length) return null;
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

function dedupeMessages(msgs: DraftMessage[]) {
  const seen = new Set<string>();
  return msgs.filter((m) => {
    if (seen.has(m.body)) return false;
    seen.add(m.body);
    return true;
  });
}

export function autoEligible(action: AdaptAction, level: AdaptInput["automation_level"]) {
  if (level === "LEVEL_3_ADVANCED") return action !== "PROGRESS_EXERCISE" && action !== "PAUSE_EXERCISE";
  if (level === "LEVEL_2_LOW_RISK") return LOW_RISK_ACTIONS.has(action);
  return false;
}
