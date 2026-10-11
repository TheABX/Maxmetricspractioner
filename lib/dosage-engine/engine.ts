/**
 * Layer 5 — prescribe dose around Layer 4 selections.
 * Does not pick exercises. Chronological age is not an input.
 */

import type { ExerciseHistorySummary, ExerciseRecord, SelectedExercise, SelectionResult, SlotIntent } from "@/lib/exercise-kb/types";
import type { RankedPriority } from "@/lib/priority-engine/types";
import type { EffectiveClassification, Goal, ProfileInput } from "@/lib/programming-profile/types";
import type { ScheduledSession, StructureResult } from "@/lib/structure-engine/types";
import {
  AEROBIC_RPE,
  CURRENT_VOLUME_SETS,
  EXTRA_WEAK_SIDE_DEFAULT,
  MOBILITY_EXPOSURES,
  RAPID_VOLUME_FACTOR,
  RAPID_VOLUME_MIN_JUMP,
  REGION_CREDIT,
  STAGE_DOSE,
  type Band,
} from "./weights";
import {
  WEIGHTS_ID,
  type DosageFlag,
  type DosageResult,
  type DoseOverride,
  type LoadType,
  type PrescribedSession,
  type Prescription,
  type ProgressionMethod,
  type RepScheme,
  type Tempo,
  type VolumeRegion,
} from "./types";

const ISOLATION = new Set([
  "KNEE_EXTENSION",
  "KNEE_FLEXION",
  "HIP_ABDUCTION",
  "HIP_ADDUCTION",
  "CALF_PLANTARFLEXION",
  "SHOULDER_ISOLATION",
  "ELBOW_FLEXION",
  "ELBOW_EXTENSION",
]);

export type PrescribeInput = {
  selection: SelectionResult;
  library: ExerciseRecord[];
  profile: ProfileInput;
  effective: EffectiveClassification;
  priorities: RankedPriority[];
  structure: StructureResult;
  history?: ExerciseHistorySummary[];
  override?: DoseOverride | null;
  weekNumber?: number;
};

export function prescribeWeek(input: PrescribeInput): DosageResult {
  const lib = new Map(input.library.map((e) => [e.slug, e]));
  const byId = new Map(input.library.map((e) => [e.id, e]));
  const freq = frequencyBySlug(input.selection);
  const schedule = new Map(input.structure.weekly_schedule.map((s) => [s.day, s]));
  const phase = activePhase(input.structure, input.weekNumber ?? 1);
  const learning = Boolean(phase?.intent.toLowerCase().includes("learn") || (phase && phase.week_start <= 4 && (input.weekNumber ?? 1) <= 4));
  const extraWeak = extraWeakSide(input);
  const hasUnilateral = input.selection.sessions.some((s) => s.exercises.some((e) => e.intent === "UNILATERAL_LOWER" || e.laterality === "UNILATERAL"));
  const flags: DosageFlag[] = [];
  const rationale: string[] = [
    `Dose uses ${WEIGHTS_ID}. Ranges are starting templates, not a single “strength rep range.”`,
    `Stage ${input.effective.training_stage}, goal ${input.profile.primary_goal ?? "unset"}, current volume ${input.effective.current_training_volume_category}.`,
  ];
  if (input.profile.program_mode === "GENERAL_WELLNESS") {
    rationale.push("General wellness: enough volume to improve or maintain required qualities — not bodybuilding volume on every muscle.");
  }
  if (input.profile.recent_consistency === "SPORADIC" || input.profile.recent_consistency === "NONE") {
    rationale.push("Consistency looks uneven. Session length and exercise count stay as selected rather than cutting stimulus first.");
  }

  const sessions: PrescribedSession[] = input.selection.sessions.map((session) => {
    const scheduled = schedule.get(session.day as ScheduledSession["day"]);
    const sport = scheduled?.sport_load ?? "NONE";
    const sessionFlags: DosageFlag[] = [];
    const highFatigue = session.exercises.filter((e) => {
      const ex = lib.get(e.slug) ?? byId.get(e.exercise_id);
      return ex && (ex.systemic_fatigue_cost === "HIGH" || ex.systemic_fatigue_cost === "VERY_HIGH");
    }).length;
    if (highFatigue >= 3) sessionFlags.push("SESSION_FATIGUE_OVERLOAD");
    if (session.duration_minutes > 0 && session.duration_minutes <= 30 && session.exercises.filter((e) => resistanceLike(e.intent)).length >= 6) {
      sessionFlags.push("INSUFFICIENT_SESSION_TIME");
    }

    let heavySeen = 0;
    const exercises = session.exercises.map((sel) => {
      const ex = lib.get(sel.slug) ?? byId.get(sel.exercise_id) ?? null;
      const hist = (input.history ?? []).find((h) => h.slug === sel.slug || h.exercise_id === sel.exercise_id);
      const dose = prescribeOne({
        sel,
        ex,
        hist,
        profile: input.profile,
        effective: input.effective,
        priorities: input.priorities,
        structure: input.structure,
        sessionMinutes: session.duration_minutes,
        sportLoad: sport,
        frequency: freq.get(sel.slug) ?? 1,
        learning,
        extraWeak,
        hasUnilateral,
        fatigueOverload: sessionFlags.includes("SESSION_FATIGUE_OVERLOAD") && heavySeen >= 2,
      });
      if (ex && (ex.systemic_fatigue_cost === "HIGH" || ex.systemic_fatigue_cost === "VERY_HIGH")) heavySeen += 1;
      return dose;
    });

    for (const e of exercises) {
      for (const f of e.constraint_flags) {
        if (!sessionFlags.includes(f)) sessionFlags.push(f);
      }
    }
    return {
      day: session.day,
      session_type: session.session_type,
      label: session.label,
      duration_minutes: session.duration_minutes,
      exercises,
      flags: sessionFlags,
    };
  });

  applyRapidVolumeCap(sessions, input.effective, flags, rationale);
  applyOverrides(sessions, input.override);

  const weekly = summarise(sessions, input.effective, input.structure);
  if (input.profile.pain_present && (input.profile.pain_severity ?? 0) >= 5 && !flags.includes("REVIEW_REQUIRED")) {
    flags.push("REVIEW_REQUIRED");
    rationale.push("Significant pain is recorded. Dose is held — do not progress load until reviewed.");
  }
  for (const s of sessions) {
    for (const f of s.flags) if (!flags.includes(f)) flags.push(f);
  }

  return { sessions, weekly, flags, rationale, weights_id: WEIGHTS_ID };
}

function prescribeOne(ctx: {
  sel: SelectedExercise;
  ex: ExerciseRecord | null;
  hist?: ExerciseHistorySummary;
  profile: ProfileInput;
  effective: EffectiveClassification;
  priorities: RankedPriority[];
  structure: StructureResult;
  sessionMinutes: number;
  sportLoad: string;
  frequency: number;
  learning: boolean;
  extraWeak: boolean;
  hasUnilateral: boolean;
  fatigueOverload: boolean;
}): Prescription {
  const { sel, ex, profile, effective } = ctx;
  const goal = profile.primary_goal;
  const stage = effective.training_stage;
  const priority = (sel.priority as Prescription["priority_level"]) || "MAINTAIN";
  const flags: DosageFlag[] = [];
  const why: string[] = [];
  const mode = doseMode(sel.intent, ex, goal, profile.program_mode);

  if (ctx.hist && ctx.hist.pain_reports > 0) {
    flags.push("REVIEW_REQUIRED");
    why.push("This exercise has prior pain reports — dose is held, not progressed.");
  }
  if (profile.pain_present && (profile.pain_severity ?? 0) >= 5) flags.push("REVIEW_REQUIRED");

  const base: Omit<Prescription, "sets" | "rep_scheme_type" | "reps_min" | "reps_max" | "target_load_type" | "target_load_value" | "rir_min" | "rir_max" | "rpe_min" | "rpe_max" | "rest_seconds_min" | "rest_seconds_max" | "tempo" | "hold_duration_seconds" | "duration_seconds" | "distance" | "power_reps_per_set" | "interval_work_seconds" | "interval_rest_seconds" | "interval_repeats" | "weekly_target_sets" | "progression_method" | "progression_criteria" | "stop_rule" | "notes" | "client_line" | "rationale"> = {
    slot_id: sel.slot_id,
    exercise_id: sel.exercise_id,
    slug: sel.slug,
    name: sel.name,
    intent: sel.intent,
    training_quality: sel.quality,
    priority_level: priority,
    laterality: sel.laterality,
    extra_weak_side_sets: 0,
    weaker_side_first: sel.laterality === "UNILATERAL" || sel.laterality === "ALTERNATING",
    weekly_frequency: ctx.frequency,
    constraint_flags: flags,
    practitioner_overridden: false,
    order: sel.order,
  };

  if (mode === "power") {
    const band = STAGE_DOSE[stage].power;
    const reps = stage === "ADVANCED" ? 3 : stage === "DEVELOPMENT" ? 3 : 4;
    let sets = band.sets[0];
    if (stage === "ADVANCED") sets = 4;
    if (stage === "DEVELOPMENT" && priority === "P1_PRIMARY") sets = 4;
    if (ex?.impact_level === "HIGH" && (effective.movement_competency === "LOW" || effective.tolerance_to_training === "LOW")) {
      sets = Math.min(sets, 2);
      why.push("Impact or landing demand is high relative to competency/tolerance — power volume stays low.");
    }
    why.push("Power is quality work: low reps, high intent, full recovery. Not conditioning.");
    if (stage === "FOUNDATION") why.push("Foundation power uses lower-risk intent (fast concentric / low amplitude), not exclusion for age or inexperience.");
    return finish({
      ...base,
      sets,
      extra_weak_side_sets: 0,
      weaker_side_first: base.weaker_side_first,
      weekly_frequency: ctx.frequency,
      constraint_flags: flags,
      practitioner_overridden: false,
      order: sel.order,
      rep_scheme_type: "FIXED_REPS",
      reps_min: reps,
      reps_max: reps,
      target_load_type: "NONE",
      target_load_value: "Maximum intent each rep",
      rir_min: band.rir[0],
      rir_max: band.rir[1],
      rpe_min: null,
      rpe_max: null,
      rest_seconds_min: band.rest[0],
      rest_seconds_max: band.rest[1],
      tempo: null,
      hold_duration_seconds: null,
      duration_seconds: null,
      distance: null,
      power_reps_per_set: reps,
      interval_work_seconds: null,
      interval_rest_seconds: null,
      interval_repeats: null,
      weekly_target_sets: sets * ctx.frequency,
      progression_method: "EXERCISE_PROGRESSION",
      progression_criteria: "Keep reps crisp. Progress height, load, or variation only after quality is stable across sessions.",
      stop_rule: "Stop the set or session if jump/throw speed or landing quality clearly deteriorates.",
      notes: "Maximum intent. Stop when quality drops.",
      client_line: clientPower(sel.name, sets, reps, band.rest),
      rationale: why,
    }, ctx);
  }

  if (mode === "aerobic") {
    const interval = sel.slug.includes("interval") || ctx.structure.cardio_session_type === "INTERVAL" && sel.slug.includes("bike");
    const kind = interval ? "INTERVAL" : ctx.structure.cardio_session_type === "MODERATE_CONTINUOUS" ? "MODERATE_CONTINUOUS" : "LOW_INTENSITY_STEADY_STATE";
    const rpe = AEROBIC_RPE[kind] ?? [3, 4];
    const sessions = Math.max(1, ctx.structure.cardio_sessions_per_week || 1);
    const budget = Math.round((ctx.structure.cardio_minutes_per_week || 30) / sessions);
    const minutes = clamp(budget, 15, Math.max(15, ctx.sessionMinutes || budget));
    why.push(interval ? "Interval dose follows current conditioning and cardio priority — not a default HIIT block." : "Progress aerobic work one variable at a time. Duration first.");
    if (interval) {
      const repeats = stage === "FOUNDATION" ? 4 : 6;
      return finish({
        ...base,
        sets: 1,
        extra_weak_side_sets: 0,
        weaker_side_first: false,
        weekly_frequency: ctx.frequency,
        constraint_flags: flags,
        practitioner_overridden: false,
        order: sel.order,
        rep_scheme_type: "INTERVAL_BASED",
        reps_min: null,
        reps_max: null,
        target_load_type: "RPE",
        target_load_value: `RPE ${rpe[0]}–${rpe[1]} / 10`,
        rir_min: null,
        rir_max: null,
        rpe_min: rpe[0],
        rpe_max: rpe[1],
        rest_seconds_min: 120,
        rest_seconds_max: 120,
        tempo: null,
        hold_duration_seconds: null,
        duration_seconds: repeats * 120,
        distance: null,
        power_reps_per_set: null,
        interval_work_seconds: 120,
        interval_rest_seconds: 120,
        interval_repeats: repeats,
        weekly_target_sets: repeats,
        progression_method: "DURATION_PROGRESSION",
        progression_criteria: "Add a repeat or 15–30s work only after the current set is completed at target RPE. Do not raise duration, frequency and intensity together.",
        stop_rule: null,
        notes: `${repeats} × 2 min @ RPE ${rpe[1]}, 2 min easy recovery.`,
        client_line: `${repeats} repeats of 2 minutes harder work, 2 minutes easy. Effort around ${rpe[1]} out of 10.`,
        rationale: why,
      }, ctx);
    }
    return finish({
      ...base,
      sets: 1,
      extra_weak_side_sets: 0,
      weaker_side_first: false,
      weekly_frequency: ctx.frequency,
      constraint_flags: flags,
      practitioner_overridden: false,
      order: sel.order,
      rep_scheme_type: "TIME_BASED",
      reps_min: null,
      reps_max: null,
      target_load_type: "RPE",
      target_load_value: `RPE ${rpe[0]}–${rpe[1]} / 10 · talk test`,
      rir_min: null,
      rir_max: null,
      rpe_min: rpe[0],
      rpe_max: rpe[1],
      rest_seconds_min: 0,
      rest_seconds_max: 0,
      tempo: null,
      hold_duration_seconds: null,
      duration_seconds: minutes * 60,
      distance: null,
      power_reps_per_set: null,
      interval_work_seconds: null,
      interval_rest_seconds: null,
      interval_repeats: null,
      weekly_target_sets: 1,
      progression_method: "DURATION_PROGRESSION",
      progression_criteria: "Add about 5 minutes when the session is completed comfortably at the same RPE for two weeks. Do not raise intensity in the same week.",
      stop_rule: null,
      notes: `${minutes} min ${kind.replaceAll("_", " ").toLowerCase()}. Heart-rate zone optional.`,
      client_line: `${minutes} minutes at a comfortable conversational pace (about ${rpe[0]}–${rpe[1]} out of 10).`,
      rationale: why,
    }, ctx);
  }

  if (mode === "mobility") {
    const exposures = MOBILITY_EXPOSURES[priority] ?? [1, 2];
    const p1 = priority === "P1_PRIMARY";
    why.push("Mobility dose follows priority and function — not extra volume just because a joint tested below average.");
    return finish({
      ...base,
      sets: p1 ? 3 : 2,
      extra_weak_side_sets: 0,
      weaker_side_first: sel.laterality === "UNILATERAL",
      weekly_frequency: exposures[0],
      constraint_flags: flags,
      practitioner_overridden: false,
      order: sel.order,
      rep_scheme_type: "REP_RANGE",
      reps_min: 8,
      reps_max: 10,
      target_load_type: "NONE",
      target_load_value: "Controlled range",
      rir_min: 4,
      rir_max: 5,
      rpe_min: null,
      rpe_max: null,
      rest_seconds_min: 30,
      rest_seconds_max: 45,
      tempo: { eccentric: 2, pause_bottom: 1, concentric: 2, pause_top: 0 },
      hold_duration_seconds: priority === "P3_MONITOR" || priority === "MAINTAIN" ? 20 : null,
      duration_seconds: null,
      distance: null,
      power_reps_per_set: null,
      interval_work_seconds: null,
      interval_rest_seconds: null,
      interval_repeats: null,
      weekly_target_sets: (p1 ? 3 : 2) * exposures[0],
      progression_method: "REP_PROGRESSION",
      progression_criteria: "Add a little range or 1–2 reps when the current dose is symptom-free. Pair with strength through the available range.",
      stop_rule: null,
      notes: `${exposures[0]}–${exposures[1]} exposures/week.`,
      client_line: p1
        ? `2–3 sets of 8–10 slow controlled reps. Short daily dose is fine.`
        : `2 sets of 8–10 controlled reps, ${exposures[0]}–${exposures[1]} days this week.`,
      rationale: why,
    }, ctx);
  }

  if (mode === "balance") {
    const dedicated = ctx.hasUnilateral ? 2 : 3;
    why.push(ctx.hasUnilateral ? "Unilateral strength already trains balance — dedicated balance stays brief." : "Direct balance work: short holds or controlled reps.");
    return finish({
      ...base,
      sets: dedicated,
      extra_weak_side_sets: 0,
      weaker_side_first: true,
      weekly_frequency: ctx.frequency,
      constraint_flags: flags,
      practitioner_overridden: false,
      order: sel.order,
      rep_scheme_type: "HOLD_BASED",
      reps_min: null,
      reps_max: null,
      target_load_type: "NONE",
      target_load_value: null,
      rir_min: null,
      rir_max: null,
      rpe_min: 2,
      rpe_max: 4,
      rest_seconds_min: 30,
      rest_seconds_max: 45,
      tempo: null,
      hold_duration_seconds: ctx.hasUnilateral ? 20 : 30,
      duration_seconds: null,
      distance: null,
      power_reps_per_set: null,
      interval_work_seconds: null,
      interval_rest_seconds: null,
      interval_repeats: null,
      weekly_target_sets: dedicated * ctx.frequency,
      progression_method: "DURATION_PROGRESSION",
      progression_criteria: "Add 5–10 seconds or a less stable surface when holds are steady.",
      stop_rule: null,
      notes: "Same time each side. Weaker side first.",
      client_line: `${dedicated} sets of ${ctx.hasUnilateral ? 20 : 30} second holds. Weaker side first.`,
      rationale: why,
    }, ctx);
  }

  if (mode === "carry" || mode === "trunk") {
    const sets = stage === "FOUNDATION" ? 2 : 3;
    const hold = mode === "carry" ? (stage === "FOUNDATION" ? 20 : 30) : 20;
    why.push(mode === "carry" ? "Carry: time under load, not failure." : "Trunk: anti-movement quality, not high-rep crunch volume.");
    return finish({
      ...base,
      sets,
      extra_weak_side_sets: 0,
      weaker_side_first: sel.laterality === "UNILATERAL" || sel.laterality === "ASYMMETRIC_LOAD",
      weekly_frequency: ctx.frequency,
      constraint_flags: flags,
      practitioner_overridden: false,
      order: sel.order,
      rep_scheme_type: mode === "carry" ? "TIME_BASED" : "REP_RANGE",
      reps_min: mode === "carry" ? null : 8,
      reps_max: mode === "carry" ? null : 10,
      target_load_type: "RIR",
      target_load_value: "2–3 RIR",
      rir_min: 2,
      rir_max: 3,
      rpe_min: null,
      rpe_max: null,
      rest_seconds_min: 60,
      rest_seconds_max: 90,
      tempo: null,
      hold_duration_seconds: mode === "carry" ? hold : null,
      duration_seconds: mode === "carry" ? hold : null,
      distance: mode === "carry" ? "20–40 m or timed walk" : null,
      power_reps_per_set: null,
      interval_work_seconds: null,
      interval_rest_seconds: null,
      interval_repeats: null,
      weekly_target_sets: sets * ctx.frequency,
      progression_method: mode === "carry" ? "DURATION_PROGRESSION" : "DOUBLE_PROGRESSION",
      progression_criteria: mode === "carry" ? "Add 5–10 seconds or a small load once the walk is steady." : "Add reps to 10, then a small load.",
      stop_rule: null,
      notes: mode === "carry" ? `${sets} × ${hold}s or a short walk.` : `${sets} × 8–10.`,
      client_line: mode === "carry" ? `${sets} carries of about ${hold} seconds.` : `${sets} sets of 8–10. Leave a couple of reps in reserve.`,
      rationale: why,
    }, ctx);
  }

  const band = pickBand(mode, stage, ex);
  let sets = startingSets(band, priority, stage, goal, profile, effective, ctx.sessionMinutes);
  let [repsMin, repsMax] = band.reps;
  let [rirMin, rirMax] = band.rir;
  let [restMin, restMax] = band.rest;
  let scheme: RepScheme = repsMin === repsMax ? "FIXED_REPS" : "REP_RANGE";
  let loadType: LoadType = "RIR";
  let progression: ProgressionMethod = mode === "strength" && stage !== "FOUNDATION" && goal === "MAXIMAL_STRENGTH" ? "LOAD_PROGRESSION" : "DOUBLE_PROGRESSION";

  if (profile.program_mode === "GENERAL_WELLNESS" && stage === "FOUNDATION") {
    sets = Math.min(sets, 2);
    repsMin = 8;
    repsMax = 10;
    rirMin = 3;
    rirMax = 3;
    restMin = 90;
    restMax = 120;
    why.push("Foundation wellness: 2 × 8–10 at about 3 RIR — competency and usable strength, not failure.");
  } else if (goal === "HYPERTROPHY") {
    why.push("Hypertrophy is primary: moderate-to-high weekly volume, 1–3 RIR, not every set forced into 8–12 if the exercise suits another range.");
  } else if (goal === "MAXIMAL_STRENGTH" && stage !== "FOUNDATION") {
    why.push("Maximal strength bias: lower reps, longer rest, fewer extra isolation sets. Foundation clients are not given advanced loading.");
  } else {
    why.push("General strength development within the stage template.");
  }

  why.push(`${sel.priority.replaceAll("_", " ")} ${sel.quality.replaceAll("_", " ").toLowerCase()} — ${priorityShare(priority)}.`);

  if (ctx.learning && !(profile.program_mode === "GENERAL_WELLNESS" && stage === "FOUNDATION")) {
    rirMin = Math.min(4, rirMin + 1);
    rirMax = Math.min(5, rirMax + 1);
    why.push("Early phase: slightly higher RIR so technique can settle.");
  }
  if (effective.tolerance_to_training === "LOW" && ex && (ex.systemic_fatigue_cost === "HIGH" || ex.systemic_fatigue_cost === "VERY_HIGH")) {
    sets = Math.max(2, sets - 1);
    rirMin = Math.max(rirMin, 2);
    why.push("Low training tolerance: fewer hard sets and more reserve on high-fatigue work.");
  }
  if (ctx.sessionMinutes > 0 && ctx.sessionMinutes <= 30) {
    sets = Math.min(sets, isolationLike(sel, ex) ? 2 : 3);
    why.push("Short session: fewer sets on high-value exercises rather than eight movements × four sets.");
  }
  if (ctx.fatigueOverload) {
    sets = Math.max(2, sets - 1);
    flags.push("SESSION_FATIGUE_OVERLOAD");
    why.push("This session already has several high-fatigue lifts — later compounds drop a set.");
  }
  if ((ctx.sportLoad === "HIGH" || ctx.sportLoad === "MODERATE") && ex && (ex.systemic_fatigue_cost === "HIGH" || ex.systemic_fatigue_cost === "VERY_HIGH")) {
    sets = Math.max(2, sets - 1);
    flags.push("FATIGUE_CONFLICT");
    why.push(`Same-day sport load is ${ctx.sportLoad.toLowerCase()}. Volume on this lift is reduced rather than swapping the exercise.`);
  }
  if (ctx.extraWeak && (sel.laterality === "UNILATERAL" || sel.intent === "UNILATERAL_LOWER")) {
    base.extra_weak_side_sets = 1;
    why.push("Configurable extra weak-side set (+1). Same planned reps. Bilateral work stays in the week.");
  } else if (sel.laterality === "UNILATERAL") {
    why.push("Weaker side first. Same planned reps — not double volume on the lower side.");
  }

  if (stage === "FOUNDATION") {
    rirMin = Math.max(rirMin, 2);
    rirMax = Math.max(rirMax, 3);
  }
  const highSkill = Boolean(ex && (ex.technical_complexity === "HIGH" || ex.systemic_fatigue_cost === "VERY_HIGH"));
  if (highSkill || stage === "FOUNDATION") {
    if (rirMin < 1) flags.push("HIGH_FAILURE_RISK");
    rirMin = Math.max(rirMin, stage === "FOUNDATION" ? 2 : 1);
  }
  if (isolationLike(sel, ex) && goal === "HYPERTROPHY" && stage !== "FOUNDATION") {
    rirMin = Math.min(rirMin, 1);
    restMin = Math.min(restMin, 60);
    restMax = Math.min(restMax, 90);
    why.push("Lower-risk isolation may sit closer to failure than a compound.");
  }

  const tempo = usefulTempo(stage, effective, ex, sel);
  if (tempo) why.push("Tempo is here for control, not decoration.");

  const criteria =
    progression === "DOUBLE_PROGRESSION"
      ? `When every set hits ${repsMax} at ≥${rirMin} RIR with solid technique, add load next session. Reps may drop back toward ${repsMin}.`
      : progression === "LOAD_PROGRESSION"
        ? `Add a small load increment when the set stays inside ${repsMin}–${repsMax} at the target RIR. Increment size follows the equipment, not a universal kilo rule.`
        : `Progress reps first, then load.`;

  const tooHard = `If sets miss ${repsMin} with very high effort, reduce load or hold — do not auto-label failure.`;
  const tooEasy = `If reps sit above ${repsMax} with ≥4 RIR, the load is too light.`;

  return finish({
    ...base,
    extra_weak_side_sets: base.extra_weak_side_sets,
    weaker_side_first: base.weaker_side_first,
    weekly_frequency: ctx.frequency,
    constraint_flags: flags,
    practitioner_overridden: false,
    order: sel.order,
    sets,
    rep_scheme_type: scheme,
    reps_min: repsMin,
    reps_max: repsMax,
    target_load_type: loadType,
    target_load_value: `${rirMin === rirMax ? rirMin : `${rirMin}–${rirMax}`} RIR`,
    rir_min: rirMin,
    rir_max: rirMax,
    rpe_min: null,
    rpe_max: null,
    rest_seconds_min: restMin,
    rest_seconds_max: restMax,
    tempo,
    hold_duration_seconds: null,
    duration_seconds: null,
    distance: null,
    power_reps_per_set: null,
    interval_work_seconds: null,
    interval_rest_seconds: null,
    interval_repeats: null,
    weekly_target_sets: (sets + base.extra_weak_side_sets) * ctx.frequency,
    progression_method: progression,
    progression_criteria: `${criteria} ${tooHard} ${tooEasy}`,
    stop_rule: null,
    notes: `${sets} × ${repsMin}–${repsMax} @ ${rirMin === rirMax ? rirMin : `${rirMin}–${rirMax}`} RIR. Rest ${fmtRest(restMin, restMax)}.`,
    client_line: clientResistance(sel.name, sets, repsMin, repsMax, rirMin, rirMax, restMin, restMax),
    rationale: why,
  }, ctx);
}

function finish(p: Prescription, ctx: { sessionMinutes: number; sportLoad: string }): Prescription {
  void ctx;
  return p;
}

function doseMode(intent: SlotIntent, ex: ExerciseRecord | null, goal: Goal | null, programMode: ProfileInput["program_mode"]): "strength" | "hypertrophy" | "power" | "aerobic" | "mobility" | "balance" | "trunk" | "carry" | "isolation" {
  if (intent === "POWER" || ex?.category === "POWER" || ex?.category === "PLYOMETRIC") return "power";
  if (intent === "AEROBIC" || ex?.category === "AEROBIC") return "aerobic";
  if (intent === "MOBILITY" || ex?.category === "MOBILITY") return "mobility";
  if (intent === "BALANCE" || ex?.category === "BALANCE") return "balance";
  if (intent === "TRUNK" || ex?.category === "CORE_TRUNK") return "trunk";
  if (intent === "CARRY" || ex?.category === "CARRY") return "carry";
  if (intent === "KNEE_ISOLATION" || intent === "HIP_ISOLATION" || (ex && ISOLATION.has(ex.movement_pattern))) return "isolation";
  if (goal === "HYPERTROPHY") return "hypertrophy";
  if (goal === "MAXIMAL_STRENGTH") return "strength";
  if (programMode === "GENERAL_WELLNESS") return "strength";
  if (goal === "POWER") return "strength";
  return "strength";
}

function pickBand(mode: "strength" | "hypertrophy" | "isolation", stage: EffectiveClassification["training_stage"], ex: ExerciseRecord | null): Band {
  if (mode === "isolation") return STAGE_DOSE[stage].isolation;
  if (mode === "hypertrophy") return STAGE_DOSE[stage].hypertrophy;
  if (ex && ex.hypertrophy_suitability === "VERY_HIGH") return STAGE_DOSE[stage].hypertrophy;
  return STAGE_DOSE[stage].strength;
}

function startingSets(
  band: Band,
  _priority: Prescription["priority_level"],
  stage: EffectiveClassification["training_stage"],
  _goal: Goal | null,
  profile: ProfileInput,
  effective: EffectiveClassification,
  _sessionMinutes: number,
): number {
  let sets = band.sets[0];
  if (profile.program_mode === "GENERAL_WELLNESS") sets = Math.min(sets, stage === "FOUNDATION" ? 2 : 3);
  if (effective.current_training_volume_category === "NONE" || effective.current_training_volume_category === "LOW") {
    sets = Math.min(sets, band.sets[0]);
  }
  return Math.max(1, sets);
}

function extraWeakSide(input: PrescribeInput): boolean {
  if (input.override?.extra_weak_side_sets === true) return true;
  if (input.override?.extra_weak_side_sets === false) return false;
  if (EXTRA_WEAK_SIDE_DEFAULT) return true;
  const sym = input.priorities.find((p) => p.quality === "LEFT_RIGHT_SYMMETRY");
  return Boolean(sym && (sym.effective_priority === "P1_PRIMARY" || sym.effective_priority === "P2_SECONDARY") && (sym.severity === "HIGH" || sym.severity === "VERY_HIGH"));
}

function usefulTempo(stage: EffectiveClassification["training_stage"], effective: EffectiveClassification, ex: ExerciseRecord | null, sel: SelectedExercise): Tempo | null {
  if (!ex) return null;
  if (stage !== "FOUNDATION" && effective.movement_competency !== "LOW") return null;
  if (sel.intent !== "KNEE_DOMINANT" && sel.intent !== "HIP_DOMINANT") return null;
  if (ex.category !== "RESISTANCE") return null;
  return { eccentric: 3, pause_bottom: 1, concentric: 1, pause_top: 0 };
}

function applyRapidVolumeCap(sessions: PrescribedSession[], effective: EffectiveClassification, flags: DosageFlag[], rationale: string[]) {
  const current = CURRENT_VOLUME_SETS[effective.current_training_volume_category];
  const proposed = countWorkingSets(sessions);
  if (current <= 0) return;
  if (proposed > current * RAPID_VOLUME_FACTOR && proposed - current >= RAPID_VOLUME_MIN_JUMP) {
    flags.push("RAPID_VOLUME_INCREASE");
    const cap = Math.max(current + 4, Math.round(current * 1.6));
    const scale = cap / proposed;
    rationale.push(`Current hard-set estimate is ~${current}/week. A jump to ${proposed} would be too fast — start near ${cap} and ramp.`);
    for (const s of sessions) {
      for (const e of s.exercises) {
        if (!resistanceLike(e.intent)) continue;
        const floor = e.intent === "KNEE_ISOLATION" || e.intent === "HIP_ISOLATION" || e.intent === "TRUNK" || e.intent === "CARRY" || e.priority_level === "P3_MONITOR" || e.priority_level === "MAINTAIN" ? 1 : 2;
        e.sets = Math.max(floor, Math.round(e.sets * scale));
        e.weekly_target_sets = (e.sets + e.extra_weak_side_sets) * e.weekly_frequency;
        e.notes = `${e.sets} × ${e.reps_min ?? ""}–${e.reps_max ?? ""} (ramped from a larger automatic target).`;
        e.rationale = [...e.rationale, "Starting dose is ramped because weekly volume would have jumped too quickly."];
      }
    }
  }
}

function applyOverrides(sessions: PrescribedSession[], override?: DoseOverride | null) {
  if (!override?.slots) return;
  for (const s of sessions) {
    for (const e of s.exercises) {
      const o = override.slots[e.slot_id];
      if (!o) continue;
      Object.assign(e, o);
      e.practitioner_overridden = true;
      e.weekly_target_sets = (e.sets + e.extra_weak_side_sets) * e.weekly_frequency;
      e.client_line = e.reps_min != null
        ? clientResistance(e.name, e.sets, e.reps_min, e.reps_max ?? e.reps_min, e.rir_min ?? 2, e.rir_max ?? e.rir_min ?? 2, e.rest_seconds_min, e.rest_seconds_max)
        : e.client_line;
    }
  }
}

function summarise(sessions: PrescribedSession[], effective: EffectiveClassification, structure: StructureResult) {
  const region_sets = emptyRegions();
  let total = 0;
  let power = 0;
  let aerobic = 0;
  let mobility = 0;
  let balance = 0;
  const resistanceDays = new Set<string>();
  const aerobicDays = new Set<string>();
  const libCredit = (e: Prescription) => regionCreditFor(e);
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (e.intent === "POWER") power += 1;
      if (e.intent === "AEROBIC") {
        aerobic += (e.duration_seconds ?? 0) / 60;
        aerobicDays.add(s.day);
      }
      if (e.intent === "MOBILITY") mobility += 1;
      if (e.intent === "BALANCE") balance += 1;
      if (resistanceLike(e.intent)) {
        total += e.sets + e.extra_weak_side_sets;
        resistanceDays.add(s.day);
        const credit = libCredit(e);
        for (const [region, frac] of Object.entries(credit)) {
          region_sets[region as VolumeRegion] += (e.sets + e.extra_weak_side_sets) * (frac ?? 0);
        }
      }
    }
  }
  if (aerobic === 0) aerobic = structure.cardio_minutes_per_week;
  for (const key of Object.keys(region_sets) as VolumeRegion[]) {
    region_sets[key] = round1(region_sets[key]);
  }
  return {
    resistance_sessions: resistanceDays.size,
    total_working_sets: total,
    region_sets,
    power_exposures: power,
    aerobic_minutes: Math.round(aerobic),
    aerobic_sessions: aerobicDays.size || structure.cardio_sessions_per_week,
    mobility_exposures: mobility,
    balance_exposures: balance,
    estimated_current_hard_sets: CURRENT_VOLUME_SETS[effective.current_training_volume_category],
  };
}

export function regionCreditFor(e: Pick<Prescription, "slug" | "intent">, movement?: string): Partial<Record<VolumeRegion, number>> {
  const move = movement ?? inferMovement(e.slug, e.intent);
  const mapped = REGION_CREDIT[move];
  if (mapped) return mapped;
  if (e.intent === "UPPER_PUSH") return { CHEST: 1, SHOULDERS: 0.4, TRICEPS: 0.5 };
  if (e.intent === "UPPER_PULL") return { BACK: 1, BICEPS: 0.4 };
  if (e.intent === "KNEE_DOMINANT" || e.intent === "UNILATERAL_LOWER") return { QUADRICEPS: 1, GLUTES: 0.7, HAMSTRINGS: 0.2 };
  if (e.intent === "HIP_DOMINANT") return { HAMSTRINGS: 1, GLUTES: 0.8, QUADRICEPS: 0.15 };
  if (e.intent === "KNEE_ISOLATION") return { QUADRICEPS: 1 };
  if (e.intent === "TRUNK") return { TRUNK: 0.8 };
  return {};
}

function inferMovement(slug: string, intent: SlotIntent): string {
  if (slug.includes("leg_curl")) return "KNEE_FLEXION";
  if (slug.includes("extension")) return "KNEE_EXTENSION";
  if (slug.includes("rdl") || slug.includes("deadlift") || slug.includes("hinge") || slug.includes("swing")) return "HINGE";
  if (slug.includes("split") || slug.includes("lunge") || slug.includes("step")) return "LUNGE_SPLIT_SQUAT";
  if (slug.includes("press") && (slug.includes("chest") || slug.includes("bench"))) return "HORIZONTAL_PUSH";
  if (slug.includes("ohp") || slug.includes("overhead") || slug.includes("shoulder_press")) return "VERTICAL_PUSH";
  if (slug.includes("row")) return "HORIZONTAL_PULL";
  if (slug.includes("pulldown") || slug.includes("pullup") || slug.includes("chin")) return "VERTICAL_PULL";
  if (slug.includes("squat") || slug.includes("leg_press") || slug.includes("hack")) return "SQUAT";
  if (intent === "HIP_DOMINANT") return "HINGE";
  if (intent === "KNEE_DOMINANT") return "SQUAT";
  return "";
}

function emptyRegions(): Record<VolumeRegion, number> {
  return {
    QUADRICEPS: 0,
    HAMSTRINGS: 0,
    GLUTES: 0,
    CHEST: 0,
    BACK: 0,
    SHOULDERS: 0,
    BICEPS: 0,
    TRICEPS: 0,
    CALVES: 0,
    TRUNK: 0,
  };
}

function countWorkingSets(sessions: PrescribedSession[]) {
  return sessions.reduce((n, s) => n + s.exercises.filter((e) => resistanceLike(e.intent)).reduce((m, e) => m + e.sets, 0), 0);
}

function frequencyBySlug(selection: SelectionResult) {
  const m = new Map<string, number>();
  for (const s of selection.sessions) {
    for (const e of s.exercises) m.set(e.slug, (m.get(e.slug) ?? 0) + 1);
  }
  return m;
}

function activePhase(structure: StructureResult, week: number) {
  return structure.program_phase_structure.find((p) => week >= p.week_start && week <= p.week_end) ?? structure.program_phase_structure[0] ?? null;
}

function resistanceLike(intent: SlotIntent) {
  return !["POWER", "AEROBIC", "MOBILITY", "BALANCE", "RECOVERY"].includes(intent);
}

function isolationLike(sel: SelectedExercise, ex: ExerciseRecord | null) {
  return sel.intent === "KNEE_ISOLATION" || sel.intent === "HIP_ISOLATION" || Boolean(ex && ISOLATION.has(ex.movement_pattern));
}

function priorityShare(p: string) {
  if (p.startsWith("P1")) return "high meaningful exposure";
  if (p.startsWith("P2")) return "moderate exposure";
  if (p.startsWith("P3")) return "small exposure";
  return "minimum effective dose";
}

function clientResistance(name: string, sets: number, min: number, max: number, rirMin: number, rirMax: number, restMin: number, restMax: number) {
  const reps = min === max ? `${min} reps` : `${min}–${max} reps`;
  const rir = rirMin === rirMax ? rirMin : rirMin;
  return `${name}\n${sets} sets\n${reps}\nTarget: Finish each set with around ${rir} reps left in reserve.\nRest: ${fmtRest(restMin, restMax)}.`;
}

function clientPower(name: string, sets: number, reps: number, rest: [number, number]) {
  return `${name}\n${sets} sets\n${reps} reps\nMove as fast and crisp as you can. Stop if the quality clearly drops.\nRest: ${fmtRest(rest[0], rest[1])}.`;
}

export function formatDose(p: Prescription): string {
  if (p.rep_scheme_type === "INTERVAL_BASED" && p.interval_repeats) {
    return `${p.interval_repeats} × ${Math.round((p.interval_work_seconds ?? 0) / 60)} min`;
  }
  if (p.rep_scheme_type === "TIME_BASED" && p.duration_seconds) {
    return p.sets > 1 ? `${p.sets} × ${p.duration_seconds}s` : `${Math.round(p.duration_seconds / 60)} min`;
  }
  if (p.rep_scheme_type === "HOLD_BASED") return `${p.sets} × ${p.hold_duration_seconds}s`;
  if (p.reps_min != null && p.reps_max != null && p.reps_min !== p.reps_max) return `${p.sets} × ${p.reps_min}–${p.reps_max}`;
  if (p.reps_min != null) return `${p.sets} × ${p.reps_min}`;
  return `${p.sets} sets`;
}

export function formatEffort(p: Prescription): string {
  if (p.rpe_min != null) return `RPE ${p.rpe_min}${p.rpe_max && p.rpe_max !== p.rpe_min ? `–${p.rpe_max}` : ""}`;
  if (p.rir_min != null) return `${p.rir_min}${p.rir_max && p.rir_max !== p.rir_min ? `–${p.rir_max}` : ""} RIR`;
  return p.target_load_value ?? "—";
}

function fmtRest(min: number, max: number) {
  if (!min && !max) return "as needed";
  const a = min >= 60 ? `${min / 60}` : `${min}s`;
  const b = max >= 60 ? `${max / 60}` : `${max}s`;
  if (min === max) return min >= 60 ? `${min / 60} min` : `${min} sec`;
  if (min >= 60 && max >= 60) return `${min / 60}–${max / 60} min`;
  return `${a}–${b}`;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
