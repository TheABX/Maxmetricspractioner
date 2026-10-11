import type { EffectiveClassification, Equipment, ProfileInput } from "@/lib/programming-profile/types";
import type { PriorityLevel, Quality, RankedPriority } from "@/lib/priority-engine/types";
import type { ScheduledSession, SessionComponent } from "@/lib/structure-engine/types";
import { RELATIONSHIPS } from "./catalog";
import type { ExerciseRel } from "./types";
import {
  SCORE_W,
  WEIGHTS_ID,
  type Candidate,
  type ExerciseHistorySummary,
  type ExerciseRecord,
  type ExQuality,
  type KbEquipment,
  type SelectedExercise,
  type SelectedSession,
  type SelectionOverride,
  type SelectionResult,
  type SessionSlot,
  type SlotIntent,
} from "./types";

const ORD = ["LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;
const rank = (v: string | undefined) => Math.max(0, ORD.indexOf((v as (typeof ORD)[number]) ?? "LOW"));

export const PROFILE_TO_KB: Record<Equipment, KbEquipment | null> = {
  BARBELL: "BARBELL",
  SQUAT_RACK: "SQUAT_RACK",
  BENCH: "BENCH",
  DUMBBELLS: "DUMBBELL",
  KETTLEBELLS: "KETTLEBELL",
  CABLE_MACHINE: "CABLE",
  SELECTORISED_MACHINES: "MACHINE",
  LEG_PRESS: "LEG_PRESS",
  LEG_EXTENSION: "LEG_EXTENSION",
  LEG_CURL: "LEG_CURL",
  PULLUP_BAR: "PULLUP_BAR",
  RESISTANCE_BANDS: "BAND",
  TRX_SUSPENSION: "TRX",
  SLED: "SLED",
  MEDICINE_BALL: "MEDICINE_BALL",
  TREADMILL: "TREADMILL",
  BIKE: "BIKE",
  ROWER: "ROWER",
  SKIERG: "SKIERG",
  STAIR_MACHINE: null,
  BOX: "BOX",
  STEP: "STEP",
  OTHER: null,
};

export function availableEquipment(profile: ProfileInput): Set<KbEquipment> {
  const set = new Set<KbEquipment>(["BODYWEIGHT", "SUPPORT_OBJECT"]);
  for (const e of profile.equipment) {
    const mapped = PROFILE_TO_KB[e];
    if (mapped) set.add(mapped);
  }
  if (profile.training_locations.includes("TRACK")) set.add("TRACK");
  if (profile.training_locations.includes("POOL")) set.add("POOL");
  if (profile.training_locations.includes("OUTDOORS")) set.add("TRACK");
  return set;
}

function pri(priorities: RankedPriority[], q: Quality | Quality[]): PriorityLevel | "MAINTAIN" {
  const want = Array.isArray(q) ? q : [q];
  const hits = priorities.filter((p) => want.includes(p.quality));
  if (!hits.length) return "MAINTAIN";
  const order: PriorityLevel[] = ["P1_PRIMARY", "P2_SECONDARY", "P3_MONITOR", "REVIEW_REQUIRED", "MAINTAIN", "NOT_RELEVANT"];
  hits.sort((a, b) => order.indexOf(a.effective_priority) - order.indexOf(b.effective_priority));
  return hits[0].effective_priority;
}

function slotCount(minutes: number) {
  if (minutes <= 30) return 4;
  if (minutes <= 45) return 6;
  if (minutes <= 60) return 7;
  return 8;
}

const MOBILITY_QS: Quality[] = ["ANKLE_MOBILITY", "HIP_MOBILITY", "SHOULDER_MOBILITY", "POSTERIOR_CHAIN_MOBILITY"];

function topMobility(priorities: RankedPriority[]): Quality {
  const order: PriorityLevel[] = ["P1_PRIMARY", "P2_SECONDARY", "P3_MONITOR", "MAINTAIN", "NOT_RELEVANT", "REVIEW_REQUIRED"];
  const hits = priorities.filter((p) => MOBILITY_QS.includes(p.quality));
  hits.sort((a, b) => order.indexOf(a.effective_priority) - order.indexOf(b.effective_priority));
  return hits[0]?.quality ?? "ANKLE_MOBILITY";
}

export function isLowerStrengthSession(session: ScheduledSession) {
  if (session.kind !== "PRESCRIBED") return false;
  if (String(session.session_type).includes("AEROBIC") || String(session.primary_session_type).includes("AEROBIC")) return false;
  return (
    String(session.session_type).includes("LOWER") ||
    String(session.session_type).includes("FULL") ||
    session.session_type === "STRENGTH" ||
    session.session_type === "HYPERTROPHY" ||
    session.session_type === "MIXED"
  );
}

export function buildSlots(
  session: ScheduledSession,
  priorities: RankedPriority[],
  profile: ProfileInput,
  ctx: { lowerIndex: number; lowerCount: number } = { lowerIndex: 0, lowerCount: 1 },
): SessionSlot[] {
  if (session.kind !== "PRESCRIBED") return [];
  const n = slotCount(session.duration_minutes);
  const p1Knee = pri(priorities, "KNEE_EXTENSOR_STRENGTH");
  const p1Lower = pri(priorities, ["LOWER_BODY_STRENGTH", "MAXIMAL_STRENGTH"]);
  const pSym = pri(priorities, "LEFT_RIGHT_SYMMETRY");
  const pPower = pri(priorities, ["POWER", "RAPID_FORCE_PRODUCTION"]);
  const pAero = pri(priorities, "AEROBIC_CAPACITY");
  const pMob = pri(priorities, MOBILITY_QS);
  const mobQuality = topMobility(priorities);
  const hypertrophy = profile.primary_goal === "HYPERTROPHY" || session.session_type === "HYPERTROPHY";
  const has = (c: SessionComponent) => session.components.some((x) => x.name === c) || session.secondary_components.includes(c);
  const slots: SessionSlot[] = [];
  const add = (intent: SlotIntent, quality: Quality | ExQuality, priority: PriorityLevel | "MAINTAIN", label: string, extra: Partial<SessionSlot> = {}) => {
    if (slots.length >= n) return;
    slots.push({
      slot_id: `${session.day}:${intent}:${slots.length}`,
      intent,
      quality,
      priority,
      pattern_hint: extra.pattern_hint ?? null,
      laterality_hint: extra.laterality_hint ?? null,
      label,
    });
  };

  if (String(session.session_type).includes("AEROBIC") || String(session.primary_session_type).includes("AEROBIC")) {
    add("AEROBIC", "AEROBIC_CAPACITY", pAero, "Aerobic work");
    if (pMob === "P1_PRIMARY" || pMob === "P2_SECONDARY") add("MOBILITY", mobQuality, pMob, "Targeted mobility");
    if (n >= 5) add("TRUNK", "TRUNK_CAPACITY", "MAINTAIN", "Trunk / easy accessory");
    return slots;
  }

  if (pPower === "P1_PRIMARY" || pPower === "P2_SECONDARY" || has("POWER")) {
    add("POWER", "POWER", pPower, "Power / rapid force");
  }

  const lowerDay = isLowerStrengthSession(session);
  const upperDay =
    String(session.session_type).includes("UPPER") ||
    String(session.session_type).includes("FULL") ||
    session.session_type === "STRENGTH" ||
    session.session_type === "HYPERTROPHY" ||
    session.session_type === "MIXED";

  if (lowerDay) {
    const laterCoverage = ctx.lowerCount >= 2 && ctx.lowerIndex >= 1 && !hypertrophy;
    if (laterCoverage) {
      add("UNILATERAL_LOWER", "KNEE_EXTENSOR_STRENGTH", pSym === "NOT_RELEVANT" ? "MAINTAIN" : pSym, "Unilateral lower-body", { laterality_hint: "UNILATERAL" });
    } else {
      add("KNEE_DOMINANT", "LOWER_BODY_STRENGTH", p1Lower === "NOT_RELEVANT" ? "MAINTAIN" : p1Lower, "Knee-dominant strength");
      if (hypertrophy && n >= 6) add("KNEE_ISOLATION", "KNEE_EXTENSOR_STRENGTH", p1Knee === "NOT_RELEVANT" ? "P2_SECONDARY" : p1Knee, "Knee-extensor isolation");
    }
    add("HIP_DOMINANT", "LOWER_BODY_STRENGTH", p1Lower === "NOT_RELEVANT" ? "MAINTAIN" : p1Lower, "Hip-dominant strength");
    const targetedUni = has("UNILATERAL") || pSym === "P1_PRIMARY" || pSym === "P2_SECONDARY";
    if (!laterCoverage && targetedUni) {
      add("UNILATERAL_LOWER", "KNEE_EXTENSOR_STRENGTH", pSym === "NOT_RELEVANT" ? "MAINTAIN" : pSym, "Unilateral lower-body", { laterality_hint: "UNILATERAL" });
    }
  }

  if (upperDay && !session.session_type.includes("LOWER")) {
    add("UPPER_PULL", "UPPER_BODY_STRENGTH", "MAINTAIN", "Upper-body pull");
    add("UPPER_PUSH", "UPPER_BODY_STRENGTH", "MAINTAIN", "Upper-body push");
    if (n >= 6 && hypertrophy) add("UPPER_PULL", "UPPER_BODY_STRENGTH", "MAINTAIN", "Second pull");
    if (n >= 7 && hypertrophy) add("UPPER_PUSH", "UPPER_BODY_STRENGTH", "MAINTAIN", "Second push");
  } else if (upperDay) {
    add("UPPER_PULL", "UPPER_BODY_STRENGTH", "MAINTAIN", "Upper-body pull");
    add("UPPER_PUSH", "UPPER_BODY_STRENGTH", "MAINTAIN", "Upper-body push");
  }

  if (slots.length < n && lowerDay) add("CARRY", "GRIP_STRENGTH", pri(priorities, "GRIP_STRENGTH"), "Carry / trunk");
  if (slots.length < n) add("TRUNK", "TRUNK_CAPACITY", "MAINTAIN", "Trunk");
  if ((pMob === "P1_PRIMARY" || (pMob === "P2_SECONDARY" && session.duration_minutes >= 45)) && slots.length < n) {
    add("MOBILITY", mobQuality, pMob, "Mobility");
  }
  if (hypertrophy && lowerDay && ctx.lowerIndex >= 1 && slots.length < n) {
    add("UNILATERAL_LOWER", "KNEE_EXTENSOR_STRENGTH", p1Knee === "NOT_RELEVANT" ? "MAINTAIN" : p1Knee, "Unilateral lower-body", { laterality_hint: "UNILATERAL" });
  }
  return slots;
}

function matchesIntent(ex: ExerciseRecord, slot: SessionSlot): boolean {
  const q = slot.quality as string;
  if (slot.intent === "POWER") return ex.category === "POWER" || ex.category === "PLYOMETRIC" || ex.training_qualities.includes("POWER") || ex.training_qualities.includes("RAPID_FORCE_PRODUCTION");
  if (slot.intent === "AEROBIC") return ex.category === "AEROBIC" || ex.training_qualities.includes("AEROBIC_CAPACITY");
  if (slot.intent === "MOBILITY") {
    return ex.category === "MOBILITY" && (ex.training_qualities.includes(slot.quality as ExQuality) || ex.training_qualities.some((x) => x.endsWith("MOBILITY")));
  }
  if (slot.intent === "BALANCE") return ex.category === "BALANCE" || ex.training_qualities.includes("BALANCE");
  if (slot.intent === "TRUNK") return ex.category === "CORE_TRUNK";
  if (slot.intent === "CARRY") return ex.category === "CARRY" || ex.movement_pattern === "CARRY";
  if (slot.intent === "UPPER_PUSH") return ex.movement_pattern === "HORIZONTAL_PUSH" || ex.movement_pattern === "VERTICAL_PUSH";
  if (slot.intent === "UPPER_PULL") return ex.movement_pattern === "HORIZONTAL_PULL" || ex.movement_pattern === "VERTICAL_PULL";
  if (slot.intent === "HIP_DOMINANT") return ex.movement_pattern === "HINGE" || ex.movement_pattern === "HIP_EXTENSION" || ex.movement_pattern === "KNEE_FLEXION";
  if (slot.intent === "KNEE_ISOLATION") return ex.movement_pattern === "KNEE_EXTENSION";
  if (slot.intent === "HIP_ISOLATION") return ex.movement_pattern === "HIP_ABDUCTION";
  if (slot.intent === "UNILATERAL_LOWER") {
    return (ex.laterality === "UNILATERAL" || ex.laterality === "ALTERNATING") && (ex.movement_pattern === "LUNGE_SPLIT_SQUAT" || ex.movement_pattern === "STEP" || ex.movement_pattern === "KNEE_EXTENSION" || ex.training_qualities.includes("UNILATERAL_CONTROL"));
  }
  if (slot.intent === "KNEE_DOMINANT") {
    return ex.movement_pattern === "SQUAT" && ex.category === "RESISTANCE";
  }
  return ex.training_qualities.includes(q as ExQuality);
}

export function hardFail(ex: ExerciseRecord, profile: ProfileInput, kit: Set<KbEquipment>, effective: EffectiveClassification): string | null {
  if (!ex.active) return "Inactive";
  if (ex.practitioner_approved === false) return "Not practitioner-approved";
  if (ex.ai_selection_enabled === false) return "AI selection disabled";
  const missing = ex.equipment_required.filter((e) => e !== "BODYWEIGHT" && e !== "SUPPORT_OBJECT" && !kit.has(e));
  if (missing.length) return `Needs ${missing.join(", ")}`;
  const loc = profile.training_locations;
  if (loc.length && !loc.includes("COMMERCIAL_GYM") && ex.exercise_environment.includes("COMMERCIAL_GYM") && !ex.exercise_environment.some((e) => e === "HOME_GYM" || e === "HOME_MINIMAL_EQUIPMENT" || e === "CLINIC" || e === "OUTDOORS")) {
    if (!ex.equipment_required.every((e) => kit.has(e) || e === "BODYWEIGHT" || e === "SUPPORT_OBJECT")) return "Environment mismatch";
  }
  const excluded = profile.excluded_exercises.find((x) => x.exercise && ex.name.toLowerCase().includes(x.exercise.toLowerCase()) && x.reason !== "OTHER");
  if (excluded) return "Explicitly excluded";
  if (effective.training_stage === "FOUNDATION" && ex.foundation_suitability === "NOT_SUITABLE") return "Not suitable for foundation";
  if ((effective.training_experience === "NONE" || effective.training_experience === "BEGINNER") && ex.technical_complexity === "HIGH" && effective.movement_competency === "LOW") {
    return "Technical demand far beyond current stage";
  }
  if (profile.pain_present && (profile.pain_severity ?? 0) >= 7 && ex.impact_level === "HIGH") return "High-impact with significant pain — review";
  return null;
}

function historyFor(ex: ExerciseRecord, history: ExerciseHistorySummary[]) {
  return history.find((h) => h.exercise_id === ex.id || h.name.toLowerCase() === ex.name.toLowerCase() || h.slug === ex.slug);
}

export function scoreExercise(opts: {
  ex: ExerciseRecord;
  slot: SessionSlot;
  profile: ProfileInput;
  effective: EffectiveClassification;
  kit: Set<KbEquipment>;
  history: ExerciseHistorySummary[];
  selected: ExerciseRecord[];
  weekPatterns: string[];
  weekMoves: string[];
  priorities: RankedPriority[];
}): Candidate {
  const { ex, slot, profile, effective, kit, history, selected, weekPatterns, weekMoves, priorities } = opts;
  const fail = hardFail(ex, profile, kit, effective);
  if (fail) return { exercise: ex, score: -999, reasons: [], penalties: [], hard_fail: fail };
  if (!matchesIntent(ex, slot)) return { exercise: ex, score: -500, reasons: [], penalties: ["Does not match slot"], hard_fail: "Wrong slot" };

  let score = 0;
  const reasons: string[] = [];
  const penalties: string[] = [];

  if (ex.training_qualities.includes(slot.quality as ExQuality) || matchesIntent(ex, slot)) {
    score += SCORE_W.quality_match;
    reasons.push(`Trains ${slot.label.toLowerCase()}`);
  }

  const goal = profile.primary_goal;
  if (goal === "HYPERTROPHY") {
    score += rank(ex.hypertrophy_suitability);
    if (rank(ex.hypertrophy_suitability) >= 2) reasons.push("High hypertrophy suitability");
  } else if (goal === "MAXIMAL_STRENGTH") {
    score += rank(ex.strength_suitability);
    if (rank(ex.loading_potential) >= 3) reasons.push("High loading potential for strength");
  } else if (goal === "POWER") {
    score += rank(ex.power_suitability);
  } else {
    score += rank(ex.general_wellness_suitability);
    if (ex.time_efficiency === "HIGH") score += SCORE_W.time_efficiency;
  }
  score += SCORE_W.goal_suitability * (rank(goal === "HYPERTROPHY" ? ex.hypertrophy_suitability : ex.general_wellness_suitability) / 3);

  if (effective.training_stage === "FOUNDATION") {
    score += ex.foundation_suitability === "EXCELLENT" ? SCORE_W.stage_match : ex.foundation_suitability === "GOOD" ? 2 : ex.foundation_suitability === "POSSIBLE" ? 0 : -SCORE_W.stage_match;
    if (ex.foundation_suitability === "EXCELLENT") reasons.push("Excellent foundation suitability");
  }
  if (effective.movement_competency === "LOW") {
    if (ex.technical_complexity === "LOW" && (ex.stability_requirement === "LOW" || ex.stability_requirement === "MODERATE")) {
      score += SCORE_W.competency_match;
      reasons.push("Simple, stable, easy to coach");
    } else {
      score -= SCORE_W.complexity_penalty;
      penalties.push("Higher complexity than current competency prefers");
    }
  }

  if (effective.movement_competency === "LOW" && rank(ex.stability_requirement) >= 3) {
    score -= SCORE_W.stability_fit;
    penalties.push("Stability demand is high");
  } else if (slot.laterality_hint === "UNILATERAL" && ex.laterality === "UNILATERAL" && ex.stability_requirement === "MODERATE") {
    score += SCORE_W.stability_fit;
    reasons.push("Unilateral with manageable balance demand");
  }

  const limited = (q: Quality) =>
    priorities.some(
      (p) =>
        p.quality === q &&
        (p.effective_priority === "P1_PRIMARY" || p.effective_priority === "P2_SECONDARY") &&
        (p.severity === "MODERATE" || p.severity === "HIGH" || p.severity === "VERY_HIGH"),
    );
  const ankleLimited = limited("ANKLE_MOBILITY") || profile.pain_locations.some((x) => x.includes("ANKLE"));
  const hipLimited = limited("HIP_MOBILITY") || profile.pain_locations.some((x) => x.includes("HIP"));
  const shoulderLimited = limited("SHOULDER_MOBILITY") || profile.pain_locations.some((x) => x.includes("SHOULDER"));
  if (ex.ankle_mobility_requirement === "HIGH" && ankleLimited) {
    score -= SCORE_W.mobility_fit;
    penalties.push("High ankle demand with a known ankle limitation — prefer a box, machine, or shorter-ROM option");
  }
  if (ex.hip_mobility_requirement === "HIGH" && hipLimited) {
    score -= SCORE_W.mobility_fit;
    penalties.push("High hip-mobility demand with a current hip limitation");
  }
  if (ex.shoulder_mobility_requirement === "HIGH" && shoulderLimited) {
    score -= SCORE_W.mobility_fit;
    penalties.push("High shoulder-mobility demand with a current shoulder limitation");
  }
  if (slot.intent === "KNEE_DOMINANT" && (ex.laterality === "UNILATERAL" || ex.laterality === "ALTERNATING")) {
    score -= 2;
    penalties.push("Save unilateral work for the dedicated slot so this session stays a whole-person program");
  }
  if (profile.training_style_preferences.includes("MACHINE_BASED") && (ex.equipment_required.includes("MACHINE") || ex.stability_requirement === "LOW")) {
    score += 1;
  }
  if (profile.training_style_preferences.includes("FREE_WEIGHTS") && (ex.equipment_required.includes("DUMBBELL") || ex.equipment_required.includes("BARBELL") || ex.equipment_required.includes("KETTLEBELL"))) {
    score += 1;
  }
  if (profile.training_style_preferences.includes("SIMPLE_REPETITIVE") && ex.technical_complexity === "LOW") {
    score += 1;
  }
  if (profile.training_style_preferences.includes("SHORT_EFFICIENT") && ex.time_efficiency === "HIGH") {
    score += SCORE_W.time_efficiency;
  }

  if (sessionShort(profile) && ex.time_efficiency === "HIGH") {
    score += SCORE_W.time_efficiency;
    reasons.push("Time-efficient for a short session");
  }

  const pref = profile.preferred_exercises.find((p) => ex.name.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(ex.name.toLowerCase()));
  if (pref) {
    score += SCORE_W.preference;
    reasons.push("Matches a stated preference");
  }
  const dislike = profile.disliked_exercises.find((p) => p && ex.name.toLowerCase().includes(p.toLowerCase()));
  if (dislike) {
    score -= SCORE_W.dislike_penalty;
    penalties.push("Client dislike (ranking only, not a hard block)");
  }

  const hist = historyFor(ex, history);
  if (hist) {
    if (hist.sessions_completed >= 2 && (hist.pain_reports ?? 0) === 0) {
      score += SCORE_W.previous_success;
      reasons.push("Previously used and tolerated");
    }
    if (hist.pain_reports >= 2) {
      score -= SCORE_W.previous_success;
      penalties.push("Repeated pain reports on this exercise — flag for review");
    }
  }

  if (slot.laterality_hint === "UNILATERAL" && (ex.laterality === "UNILATERAL" || ex.laterality === "ALTERNATING")) {
    score += SCORE_W.unilateral_for_asym;
    reasons.push("Each side can be trained independently");
  }

  if (profile.program_mode === "PERFORMANCE" && rank(ex.systemic_fatigue_cost) >= 3) {
    score -= SCORE_W.fatigue_penalty;
    penalties.push("High systemic fatigue against sport load");
  }
  if (effective.tolerance_to_training === "LOW" && rank(ex.systemic_fatigue_cost) >= 3) {
    score -= SCORE_W.fatigue_penalty;
    penalties.push("Fatigue cost is high for current tolerance");
  }

  const samePattern = selected.filter((s) => s.category === ex.category && s.movement_pattern === ex.movement_pattern).length;
  if (selected.some((s) => s.slug === ex.slug)) {
    score -= SCORE_W.redundancy_penalty * 2;
    penalties.push("Already selected in this session");
  }
  if (slot.intent === "UPPER_PULL" && selected.some((s) => s.movement_pattern === "HORIZONTAL_PULL") && ex.movement_pattern === "VERTICAL_PULL") {
    score += 3;
    reasons.push("Complements the horizontal pull already in the session");
  }
  if (slot.intent === "UPPER_PUSH" && selected.some((s) => s.movement_pattern === "HORIZONTAL_PUSH") && ex.movement_pattern === "VERTICAL_PUSH") {
    score += 3;
    reasons.push("Complements the horizontal push already in the session");
  }
  if (samePattern >= 1 && (ex.movement_pattern === "SQUAT" || ex.movement_pattern === "KNEE_EXTENSION" || ex.movement_pattern === "LUNGE_SPLIT_SQUAT")) {
    score -= SCORE_W.redundancy_penalty;
    penalties.push("Same pattern already in this session");
  }
  if (weekPatterns.includes(ex.slug) && (slot.intent === "KNEE_DOMINANT" || slot.intent === "UNILATERAL_LOWER")) {
    score -= 2;
    penalties.push("Identical stimulus already used this week — a variation or the other side of the week may serve better");
  }
  if (slot.intent === "KNEE_DOMINANT" && weekMoves.includes("SQUAT") && ex.movement_pattern === "SQUAT" && ex.category === "RESISTANCE") {
    score -= 3;
    penalties.push("Bilateral squat pattern already appears this week");
  }

  if (ex.technical_complexity === "HIGH" && effective.training_stage !== "ADVANCED") {
    score -= SCORE_W.complexity_penalty;
    penalties.push("Complexity has not earned its place yet");
  }

  return { exercise: ex, score, reasons, penalties, hard_fail: null };
}

function sessionShort(profile: ProfileInput) {
  return (profile.preferred_session_minutes ?? 45) <= 35;
}

function clientLine(ex: ExerciseRecord, slot: SessionSlot): string {
  if (slot.intent === "POWER") return `${ex.display_name} is included to practise producing force quickly, not to exhaust you.`;
  if (slot.intent === "UNILATERAL_LOWER") return `${ex.display_name} lets each leg work independently while still building lower-body strength.`;
  if (slot.intent === "AEROBIC") return `${ex.display_name} is your aerobic work for this session.`;
  if (slot.intent === "MOBILITY") return `${ex.display_name} is a small targeted mobility piece so you can train the main lifts well.`;
  if (slot.intent === "UPPER_PULL" || slot.intent === "UPPER_PUSH") return `${ex.display_name} keeps upper-body strength in the program.`;
  return `${ex.display_name} is here to train ${slot.label.toLowerCase()}.`;
}

function related(slug: string, type: "REGRESSION" | "PROGRESSION", library: ExerciseRecord[], graph: ExerciseRel[]) {
  return graph
    .filter((r) => r.from_slug === slug && r.type === type)
    .map((r) => library.find((e) => e.slug === r.to_slug))
    .filter((e): e is ExerciseRecord => Boolean(e))
    .map((e) => ({ id: e.id, name: e.name }));
}

export function selectWeek(opts: {
  library: ExerciseRecord[];
  profile: ProfileInput;
  effective: EffectiveClassification;
  priorities: RankedPriority[];
  schedule: ScheduledSession[];
  history?: ExerciseHistorySummary[];
  override?: SelectionOverride | null;
  relationships?: ExerciseRel[];
}): SelectionResult {
  const kit = availableEquipment(opts.profile);
  const graph = opts.relationships?.length ? opts.relationships : RELATIONSHIPS;
  const history = opts.history ?? [];
  const override = opts.override;
  const weekPatterns: string[] = [];
  const weekMoves: string[] = [];
  const rationale: string[] = [];
  const sessions: SelectedSession[] = [];
  const lowerDays = opts.schedule.filter(isLowerStrengthSession);

  rationale.push("Exercises are tools for the Layer 2 qualities inside the Layer 3 week. Age is not a filter.");
  rationale.push(`Equipment filter uses the client's inventory (${[...kit].slice(0, 8).join(", ")}). Missing kit is a hard exclusion.`);
  if (opts.effective.training_stage === "FOUNDATION") rationale.push("Foundation stage biases toward stable, simple, repeatable options. Complexity must earn its place.");
  if (opts.profile.primary_goal === "HYPERTROPHY") rationale.push("Hypertrophy ranking favours loading potential and regional stimulus, not 'functional' novelty.");

  for (const day of opts.schedule) {
    if (day.kind === "REST") continue;
    if (day.kind === "OPTIONAL") {
      sessions.push({ day: day.day, session_type: day.session_type, label: day.label, duration_minutes: day.duration_minutes, exercises: [] });
      continue;
    }
    const slots = buildSlots(day, opts.priorities, opts.profile, {
      lowerIndex: Math.max(0, lowerDays.findIndex((d) => d.day === day.day)),
      lowerCount: lowerDays.length,
    });
    const picked: ExerciseRecord[] = [];
    const exercises: SelectedExercise[] = [];

    slots.forEach((slot, i) => {
      if (override?.removed_slot_ids.includes(slot.slot_id)) return;
      const forcedSlug = override?.locks[slot.slot_id] ?? override?.replacements[slot.slot_id];
      const ranked = opts.library
        .map((ex) =>
          scoreExercise({
            ex,
            slot,
            profile: opts.profile,
            effective: opts.effective,
            kit,
            history,
            selected: picked,
            weekPatterns,
            weekMoves,
            priorities: opts.priorities,
          }),
        )
        .filter((c) => !c.hard_fail && !picked.some((p) => p.slug === c.exercise.slug))
        .sort((a, b) => b.score - a.score);

      let chosen = ranked[0];
      if (forcedSlug) {
        const forced =
          ranked.find((c) => c.exercise.slug === forcedSlug) ??
          opts.library
            .filter((e) => e.slug === forcedSlug)
            .map((ex) =>
              scoreExercise({
                ex,
                slot,
                profile: opts.profile,
                effective: opts.effective,
                kit,
                history,
                selected: picked,
                weekPatterns,
                weekMoves,
                priorities: opts.priorities,
              }),
            )[0];
        if (forced && !forced.hard_fail) chosen = forced;
      }
      if (!chosen) return;
      picked.push(chosen.exercise);
      weekPatterns.push(chosen.exercise.slug);
      if (chosen.exercise.category === "RESISTANCE") weekMoves.push(chosen.exercise.movement_pattern);
      const alts = ranked
        .filter((c) => c.exercise.slug !== chosen.exercise.slug)
        .slice(0, 4)
        .map((c) => ({ id: c.exercise.id, slug: c.exercise.slug, name: c.exercise.name, score: c.score, why: c.reasons.slice(0, 2) }));
      for (const r of graph.filter((x) => x.from_slug === chosen.exercise.slug && x.type === "ALTERNATIVE")) {
        if (alts.some((a) => a.slug === r.to_slug)) continue;
        const hit = ranked.find((c) => c.exercise.slug === r.to_slug);
        if (hit) alts.push({ id: hit.exercise.id, slug: hit.exercise.slug, name: hit.exercise.name, score: hit.score, why: ["Tagged alternative"] });
      }
      const flags: string[] = [];
      if (chosen.penalties.some((p) => p.includes("pain"))) flags.push("REVIEW_REQUIRED");
      exercises.push({
        slot_id: slot.slot_id,
        intent: slot.intent,
        quality: String(slot.quality),
        priority: String(slot.priority),
        exercise_id: chosen.exercise.id,
        slug: chosen.exercise.slug,
        name: chosen.exercise.name,
        laterality: chosen.exercise.laterality,
        equipment_used: chosen.exercise.equipment_required,
        selection_reason: [...chosen.reasons, ...chosen.penalties.map((p) => `Note: ${p}`)],
        client_reason: clientLine(chosen.exercise, slot),
        eligible_alternatives: alts,
        regression_options: related(chosen.exercise.slug, "REGRESSION", opts.library, graph),
        progression_options: related(chosen.exercise.slug, "PROGRESSION", opts.library, graph),
        constraint_flags: flags,
        practitioner_locked: Boolean(override?.locks[slot.slot_id]),
        order: i + 1,
      });
    });

    // Power first, then compounds, then accessories — already roughly slot order.
    sessions.push({
      day: day.day,
      session_type: day.session_type,
      label: day.label,
      duration_minutes: day.duration_minutes,
      exercises,
    });
  }

  return {
    sessions,
    unused_priorities: opts.priorities.filter((p) => p.effective_priority === "P1_PRIMARY").map((p) => p.quality),
    rationale,
    weights_id: WEIGHTS_ID,
  };
}

export function applySelectionOverride(_auto: SelectionResult, _override: SelectionOverride | null | undefined): SelectionResult {
  // Locks and replacements are applied inside selectWeek so hard filters still win.
  return _auto;
}
