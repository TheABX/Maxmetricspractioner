import type { Day, EffectiveClassification, ProfileInput, StylePref } from "@/lib/programming-profile/types";
import { DAYS } from "@/lib/programming-profile/types";
import type { PriorityLevel, Quality, RankedPriority } from "@/lib/priority-engine/types";
import { qlabel } from "@/lib/priority-engine/types";
import {
  DAY_LABEL,
  stagePhases,
  type Allocation,
  type CardioKind,
  type ConstraintFlag,
  type MobilityPlacement,
  type ScheduledSession,
  type SessionComponent,
  type SessionType,
  type Split,
  type SportLoad,
  type StructureOverride,
  type StructureResult,
} from "./types";

export const STRUCTURE_WEIGHTS_ID = "v1_time_budget";

/** Configurable share of the weekly budget by priority level. */
export const LEVEL_SHARE: Record<PriorityLevel, number> = {
  P1_PRIMARY: 28,
  P2_SECONDARY: 14,
  P3_MONITOR: 6,
  MAINTAIN: 8,
  NOT_RELEVANT: 0,
  REVIEW_REQUIRED: 0,
};

export const EMPHASIS: Record<PriorityLevel, Allocation["emphasis"]> = {
  P1_PRIMARY: "high",
  P2_SECONDARY: "moderate",
  P3_MONITOR: "small",
  MAINTAIN: "minimum",
  NOT_RELEVANT: "minimum",
  REVIEW_REQUIRED: "minimum",
};

function num(v: number | null | undefined, fallback: number) {
  return v == null || !Number.isFinite(v) ? fallback : v;
}

function has(priorities: RankedPriority[], q: Quality | Quality[], levels: PriorityLevel[] = ["P1_PRIMARY", "P2_SECONDARY"]) {
  const set = Array.isArray(q) ? q : [q];
  return priorities.some((p) => set.includes(p.quality) && levels.includes(p.effective_priority));
}

function p1Count(priorities: RankedPriority[]) {
  return priorities.filter((p) => p.effective_priority === "P1_PRIMARY").length;
}

function currentWeeklyMinutes(profile: ProfileInput): number {
  const days = num(profile.current_training_days_per_week, profile.currently_training ? 2 : 0);
  const mins = num(profile.average_session_duration_minutes, 30);
  if (profile.currently_training === false) return 0;
  return days * mins;
}

function pickDays(preferred: Day[], n: number, avoidHighSport: Partial<Record<Day, SportLoad>>): Day[] {
  const ranked = [...DAYS].sort((a, b) => {
    const pa = preferred.includes(a) ? 0 : 1;
    const pb = preferred.includes(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const sa = avoidHighSport[a] === "HIGH" ? 1 : 0;
    const sb = avoidHighSport[b] === "HIGH" ? 1 : 0;
    return sa - sb;
  });
  // Prefer spacing: take every other day from the ranked list when possible.
  const spaced: Day[] = [];
  const used = new Set<number>();
  const idx = ranked.map((d) => DAYS.indexOf(d));
  for (const i of idx) {
    if (spaced.length >= n) break;
    if ([...used].some((u) => Math.abs(u - i) === 1 && n <= 4)) continue;
    spaced.push(DAYS[i]);
    used.add(i);
  }
  for (const i of idx) {
    if (spaced.length >= n) break;
    if (!spaced.includes(DAYS[i])) spaced.push(DAYS[i]);
  }
  return spaced.slice(0, n);
}

function chooseFrequency(opts: {
  available: number;
  preferred: number;
  maximum: number;
  minimum: number;
  stage: EffectiveClassification["training_stage"];
  tolerance: EffectiveClassification["tolerance_to_training"];
  experience: EffectiveClassification["training_experience"];
  currentDays: number;
  p1Aerobic: boolean;
  p1Strength: boolean;
  hypertrophy: boolean;
}): number {
  let n = Math.min(opts.preferred, opts.available, opts.maximum);
  n = Math.max(opts.minimum, n);
  if (opts.stage === "FOUNDATION" || opts.tolerance === "LOW" || opts.experience === "NONE" || opts.experience === "BEGINNER") {
    n = Math.min(n, 3);
  }
  if (opts.currentDays <= 1 && n > 3) n = 3;
  if (opts.hypertrophy && opts.available >= 4 && opts.stage !== "FOUNDATION" && opts.tolerance !== "LOW") n = Math.min(opts.available, Math.max(n, 4));
  if (opts.p1Aerobic && opts.p1Strength && n === 2 && opts.available >= 3) n = 3;
  return Math.max(1, Math.min(6, n));
}

function chooseSplit(opts: {
  sessions: number;
  stage: EffectiveClassification["training_stage"];
  goal: string | null;
  mode: ProfileInput["program_mode"];
  p1Aerobic: boolean;
  hypertrophy: boolean;
  style: StylePref[];
}): Split {
  if (opts.mode === "PERFORMANCE") return opts.sessions >= 4 ? "SPORT_SUPPORT" : "FULL_BODY_PLUS_CARDIO";
  if (opts.stage === "FOUNDATION") return opts.p1Aerobic ? "FULL_BODY_PLUS_CARDIO" : "FULL_BODY";
  if (opts.hypertrophy) {
    if (opts.sessions <= 2) return "FULL_BODY";
    if (opts.sessions === 3) return "FULL_BODY";
    if (opts.sessions >= 4) return "UPPER_LOWER";
  }
  if (opts.sessions <= 2) return "FULL_BODY";
  if (opts.sessions === 3) return opts.p1Aerobic ? "FULL_BODY_PLUS_CARDIO" : "FULL_BODY";
  if (opts.sessions === 4) return opts.p1Aerobic ? "STRENGTH_CARDIO_SPLIT" : "UPPER_LOWER";
  if (opts.style.includes("BODYBUILDING_STYLE") && opts.sessions >= 5 && opts.stage === "ADVANCED") return "PUSH_PULL_LEGS";
  return "STRENGTH_CARDIO_SPLIT";
}

function allocate(priorities: RankedPriority[], budget: number): Allocation[] {
  const active = priorities.filter((p) => p.effective_priority !== "NOT_RELEVANT" && p.effective_priority !== "REVIEW_REQUIRED");
  const raw = active.map((p) => ({ p, share: LEVEL_SHARE[p.effective_priority] }));
  const total = raw.reduce((s, r) => s + r.share, 0) || 1;
  let rows: Allocation[] = raw.map(({ p, share }) => {
    const percent = (share / total) * 100;
    return {
      quality: p.quality,
      priority: p.effective_priority,
      percent: Math.round(percent),
      minutes: Math.round((percent / 100) * budget),
      emphasis: EMPHASIS[p.effective_priority],
    };
  });
  // Keep a minimum-effective-dose floor so one P1 cannot eat the week.
  const p1 = rows.filter((r) => r.priority === "P1_PRIMARY");
  if (p1.length && rows.length > 1) {
    const cap = 70;
    const p1pct = p1.reduce((s, r) => s + r.percent, 0);
    if (p1pct > cap) {
      const scale = cap / p1pct;
      rows = rows.map((r) => (r.priority === "P1_PRIMARY" ? { ...r, percent: Math.round(r.percent * scale) } : r));
    }
  }
  const used = rows.reduce((s, r) => s + r.percent, 0);
  if (used !== 100 && rows.length) rows[0] = { ...rows[0], percent: rows[0].percent + (100 - used) };
  return rows.map((r) => ({ ...r, minutes: Math.round((r.percent / 100) * budget) }));
}

type Blueprint = { type: SessionType; components: SessionComponent[]; label: string; client: string };
function bp(type: SessionType, components: SessionComponent[], label: string, client = label): Blueprint {
  return { type, components, label, client };
}

function sessionBlueprint(opts: {
  split: Split;
  sessions: number;
  minutes: number;
  p1Aerobic: boolean;
  p1Strength: boolean;
  p1Hypertrophy: boolean;
  p2Power: boolean;
  mobilityDedicated: boolean;
  unilateral: boolean;
}): Blueprint[] {
  const { split, sessions, minutes, p1Aerobic, p1Hypertrophy, p2Power, mobilityDedicated, unilateral } = opts;
  const short = minutes <= 35;
  const power: SessionComponent[] = p2Power ? ["POWER"] : [];
  const mob: SessionComponent[] = mobilityDedicated ? ["MOBILITY"] : minutes >= 45 ? ["MOBILITY"] : [];
  const uni: SessionComponent[] = unilateral ? ["UNILATERAL"] : [];

  if (split === "UPPER_LOWER") {
    const lower = bp("LOWER_STRENGTH", [...power, "STRENGTH", ...uni, ...(p1Hypertrophy ? (["HYPERTROPHY"] as const) : []), ...mob], "Lower-body strength");
    const upper = bp("UPPER_STRENGTH", ["STRENGTH", ...(p1Hypertrophy ? (["HYPERTROPHY"] as const) : []), ...(p1Aerobic ? (["AEROBIC"] as const) : []), ...mob], "Upper-body strength");
    const extra = p1Aerobic
      ? bp("AEROBIC_LOW_INTENSITY", ["AEROBIC", "MOBILITY"], "Aerobic + mobility", "Cardio + mobility")
      : bp("FULL_BODY_STRENGTH", [...power, "STRENGTH", "HYPERTROPHY"], "Full-body + power", "Full-body strength + power");
    const out = [lower, upper, lower, upper];
    if (sessions === 4) return p1Aerobic ? [lower, upper, extra, { ...lower, label: "Lower-body + power", components: [...power, "STRENGTH", ...uni] }] : out;
    return out.slice(0, sessions);
  }

  if (split === "STRENGTH_CARDIO_SPLIT" || split === "FULL_BODY_PLUS_CARDIO") {
    const strength = bp(
      p1Hypertrophy ? "HYPERTROPHY" : "FULL_BODY_STRENGTH",
      [...power, p1Hypertrophy ? "HYPERTROPHY" : "STRENGTH", ...uni, ...(!short && p1Aerobic ? (["AEROBIC"] as const) : [])],
      p1Hypertrophy ? "Full-body hypertrophy" : "Full-body strength",
    );
    const cardio = bp("AEROBIC_LOW_INTENSITY", ["AEROBIC", "MOBILITY"], "Aerobic + mobility", "Cardio + mobility");
    if (sessions === 2) return p1Aerobic ? [strength, cardio] : [strength, { ...strength, components: [...strength.components, "AEROBIC"] }];
    if (sessions === 3) return [strength, cardio, { ...strength, label: "Full-body strength + power", client: "Full-body strength + power", components: [...power, "STRENGTH", ...uni] }];
    return [strength, bp("UPPER_STRENGTH", ["STRENGTH", ...mob], "Upper-body + mobility"), cardio, { ...strength, label: "Full-body + power", client: "Full-body + power" }].slice(0, sessions);
  }

  if (split === "PUSH_PULL_LEGS") {
    return [
      bp("STRENGTH", ["STRENGTH", "HYPERTROPHY"], "Push", "Upper-body push"),
      bp("STRENGTH", ["STRENGTH", "HYPERTROPHY"], "Pull", "Upper-body pull"),
      bp("LOWER_STRENGTH", [...power, "STRENGTH", ...uni], "Legs", "Lower body"),
      bp("AEROBIC_LOW_INTENSITY", ["AEROBIC", "MOBILITY"], "Conditioning", "Cardio"),
    ].slice(0, sessions);
  }

  if (split === "SPORT_SUPPORT") {
    return Array.from({ length: sessions }, (_, i) =>
      i % 2 === 1 && p1Aerobic
        ? bp("AEROBIC_LOW_INTENSITY", ["AEROBIC"], "Support conditioning", "Easy conditioning")
        : bp("FULL_BODY_STRENGTH", [...power, "STRENGTH"], "Gym support", "Gym session"),
    );
  }

  if (sessions === 2) {
    return [
      bp("FULL_BODY_STRENGTH", [...power, "STRENGTH", ...(p1Aerobic && short ? (["AEROBIC"] as const) : [])], "Full-body resistance + power", "Full-body strength"),
      bp("FULL_BODY_STRENGTH", ["STRENGTH", ...uni, ...(p1Aerobic ? (["AEROBIC"] as const) : [])], "Full-body + aerobic", "Full-body strength + cardio"),
    ];
  }
  if (sessions === 3) {
    return [
      bp("FULL_BODY_STRENGTH", ["STRENGTH", ...uni], "Full-body strength"),
      p1Aerobic
        ? bp("AEROBIC_LOW_INTENSITY", ["AEROBIC", "MOBILITY"], "Cardio + mobility")
        : bp("FULL_BODY_STRENGTH", ["STRENGTH", "AEROBIC"], "Full-body + short cardio", "Full-body strength"),
      bp("FULL_BODY_STRENGTH", [...power, "STRENGTH"], "Full-body + power", "Full-body strength + power"),
    ];
  }
  return [
    bp("LOWER_STRENGTH", ["STRENGTH", "AEROBIC", ...uni], "Lower-body + aerobic", "Lower-body + cardio"),
    bp("UPPER_STRENGTH", ["STRENGTH", "MOBILITY"], "Upper-body + mobility"),
    bp("AEROBIC_LOW_INTENSITY", ["AEROBIC", "RECOVERY"], "Cardio / recovery", "Cardio"),
    bp("FULL_BODY_STRENGTH", [...power, "STRENGTH"], "Full-body + power"),
  ].slice(0, sessions);
}

function splitMinutes(total: number, components: SessionComponent[]): { name: SessionComponent | "REST"; minutes: number }[] {
  if (!components.length) return [{ name: "REST", minutes: total }];
  const weight: Record<SessionComponent, number> = {
    POWER: 1,
    STRENGTH: 4,
    HYPERTROPHY: 4,
    AEROBIC: 3,
    MOBILITY: 1,
    BALANCE: 1,
    UNILATERAL: 1.5,
    RECOVERY: 1,
  };
  const sum = components.reduce((s, c) => s + weight[c], 0);
  const rows = components.map((c) => ({ name: c as SessionComponent | "REST", minutes: Math.max(5, Math.round((weight[c] / sum) * total)) }));
  const used = rows.reduce((s, r) => s + r.minutes, 0);
  rows[rows.length - 1].minutes += total - used;
  return rows;
}

export function runStructureEngine(input: {
  profile: ProfileInput;
  effective: EffectiveClassification;
  priorities: RankedPriority[];
  sportLoadByDay?: Partial<Record<Day, SportLoad>>;
  override?: StructureOverride | null;
}): StructureResult {
  const p = input.profile;
  const e = input.effective;
  const sport = input.sportLoadByDay ?? input.override?.sport_load_by_day ?? {};
  const flags: ConstraintFlag[] = [];
  const rationale: string[] = [];

  const availableDays = num(p.available_training_days_per_week, num(p.preferred_sessions_per_week, 3));
  const preferredSessions = num(p.preferred_sessions_per_week, availableDays);
  const minSessions = num(p.minimum_sessions_per_week, 2);
  const maxSessions = num(p.maximum_sessions_per_week, availableDays);
  const prefMin = num(p.preferred_session_minutes, 45);
  const sessionMinutes = input.override?.session_minutes ?? prefMin;

  const p1Aerobic = has(input.priorities, "AEROBIC_CAPACITY", ["P1_PRIMARY"]);
  const p1Strength = has(input.priorities, ["LOWER_BODY_STRENGTH", "MAXIMAL_STRENGTH", "UPPER_BODY_STRENGTH"], ["P1_PRIMARY"]);
  const p1Hypertrophy = has(input.priorities, "HYPERTROPHY", ["P1_PRIMARY"]) || p.primary_goal === "HYPERTROPHY";
  const p2Power = has(input.priorities, ["POWER", "RAPID_FORCE_PRODUCTION"], ["P1_PRIMARY", "P2_SECONDARY"]);
  const mobilityP1 = has(input.priorities, ["ANKLE_MOBILITY", "HIP_MOBILITY", "SHOULDER_MOBILITY", "POSTERIOR_CHAIN_MOBILITY"], ["P1_PRIMARY"]);
  const mobilityAny = has(input.priorities, ["ANKLE_MOBILITY", "HIP_MOBILITY", "SHOULDER_MOBILITY", "POSTERIOR_CHAIN_MOBILITY"], ["P1_PRIMARY", "P2_SECONDARY", "P3_MONITOR"]);
  const unilateral = input.priorities.some(
    (x) =>
      (x.quality === "LEFT_RIGHT_SYMMETRY" || x.quality === "KNEE_EXTENSOR_STRENGTH" || x.quality === "HIP_ABDUCTION_STRENGTH") &&
      (x.effective_priority === "P1_PRIMARY" || x.effective_priority === "P2_SECONDARY"),
  );

  const sessions = input.override?.recommended_sessions_per_week ?? chooseFrequency({
    available: availableDays,
    preferred: preferredSessions,
    maximum: maxSessions,
    minimum: Math.min(minSessions, availableDays),
    stage: e.training_stage,
    tolerance: e.tolerance_to_training,
    experience: e.training_experience,
    currentDays: num(p.current_training_days_per_week, 0),
    p1Aerobic,
    p1Strength,
    hypertrophy: p1Hypertrophy,
  });

  const weeklyAvailable = preferredSessions * prefMin;
  let budget = sessions * sessionMinutes;

  if (e.training_stage === "FOUNDATION" || e.tolerance_to_training === "LOW") {
    const cap = Math.min(budget, e.tolerance_to_training === "LOW" ? 120 : 135);
    if (cap < budget) {
      flags.push(e.tolerance_to_training === "LOW" ? "LOW_TOLERANCE_CAP" : "FOUNDATION_CAP");
      budget = cap;
      rationale.push(`Effective budget capped at ${cap} min because of ${e.tolerance_to_training === "LOW" ? "low training tolerance" : "foundation stage"} — available time is not automatically filled with hard work.`);
    }
  }

  const current = currentWeeklyMinutes(p);
  if (current > 0 && budget > current * 2.5 && budget - current >= 90) {
    flags.push("RAPID_LOAD_INCREASE");
    const ramped = Math.max(current + 60, Math.round(current * 1.8));
    rationale.push(`Current load is ~${current} min/week. Proposed ${budget} min is a rapid increase, so week 1 starts nearer ${ramped} min.`);
    budget = Math.min(budget, ramped);
  } else if (current === 0 && budget > 150 && e.training_stage === "FOUNDATION") {
    flags.push("RAPID_LOAD_INCREASE");
    budget = Math.min(budget, 120);
    rationale.push("Currently untrained — do not open at the full available minutes.");
  }

  if (p1Count(input.priorities) >= 3 && budget < 90) {
    flags.push("CONSTRAINT_CONFLICT");
    flags.push("INSUFFICIENT_TIME");
    rationale.push("Several primary qualities compete inside a small time budget. Not all can receive high-volume emphasis — confirm which goals drop.");
  }

  const split = input.override?.session_split ?? chooseSplit({
    sessions,
    stage: e.training_stage,
    goal: p.primary_goal,
    mode: p.program_mode,
    p1Aerobic,
    hypertrophy: p1Hypertrophy,
    style: p.training_style_preferences,
  });

  const mobilityPlacement: MobilityPlacement = mobilityP1 ? "DEDICATED" : mobilityAny ? "WARM_UP_INTEGRATED" : "COOLDOWN";
  const powerDist = p2Power ? "INTEGRATED_FRESH" : "NONE";
  const cardioKind: CardioKind = p.program_mode === "PERFORMANCE" ? "SPORT_SPECIFIC" : p1Aerobic ? "MODERATE_CONTINUOUS" : "LOW_INTENSITY_STEADY_STATE";

  const blueprints = sessionBlueprint({
    split,
    sessions,
    minutes: sessionMinutes,
    p1Aerobic,
    p1Strength,
    p1Hypertrophy,
    p2Power,
    mobilityDedicated: mobilityPlacement === "DEDICATED",
    unilateral,
  });

  const days = pickDays(p.preferred_days, sessions, sport);
  const schedule: ScheduledSession[] = DAYS.map((day) => {
    const idx = days.indexOf(day);
    const sportLoad: SportLoad = sport[day] ?? "NONE";
    if (idx === -1) {
      const optional = e.training_stage === "FOUNDATION" && (day === "sat" || day === "sun") && !p.preferred_days.length;
      if (optional || (p.training_style_preferences.includes("CARDIO_HEAVY") && day === "sun")) {
        return {
          day,
          kind: "OPTIONAL",
          session_type: "OPTIONAL_ACTIVITY",
          primary_session_type: "OPTIONAL_ACTIVITY",
          secondary_components: [],
          duration_minutes: 20,
          components: [],
          sport_load: sportLoad,
          label: "Optional easy activity",
          client_label: "Optional walk / easy movement",
        };
      }
      return {
        day,
        kind: "REST",
        session_type: "REST",
        primary_session_type: "REST",
        secondary_components: [],
        duration_minutes: 0,
        components: [],
        sport_load: sportLoad,
        label: "Rest",
        client_label: "Rest",
      };
    }
    let bp = blueprints[idx] ?? blueprints[blueprints.length - 1];
    if (sportLoad === "HIGH" && (bp.type.includes("STRENGTH") || bp.type === "HYPERTROPHY" || bp.type === "POWER")) {
      flags.push("SPORT_LOAD_CONFLICT");
      bp = { type: "RECOVERY", components: ["RECOVERY", "MOBILITY"], label: "Recovery / mobility (sport day)", client: "Easy mobility" };
      rationale.push(`${DAY_LABEL[day]} has high sport load — demanding gym work was not stacked on that day.`);
    }
    const duration = Math.min(num(p.maximum_session_minutes, sessionMinutes), Math.max(num(p.minimum_session_minutes, 20), sessionMinutes));
    return {
      day,
      kind: "PRESCRIBED",
      session_type: bp.type,
      primary_session_type: bp.type,
      secondary_components: bp.components.filter((c) => c !== "STRENGTH" && c !== "HYPERTROPHY"),
      duration_minutes: duration,
      components: splitMinutes(duration, bp.components),
      sport_load: sportLoad,
      label: bp.label,
      client_label: bp.client,
    };
  });

  const prescribed = schedule.filter((s) => s.kind === "PRESCRIBED");
  const weeklyMinutes = prescribed.reduce((s, x) => s + x.duration_minutes, 0);
  const cardioSessions = prescribed.filter((s) => s.session_type.includes("AEROBIC") || s.components.some((c) => c.name === "AEROBIC"));
  const cardioMinutes = cardioSessions.reduce((s, x) => s + x.components.filter((c) => c.name === "AEROBIC").reduce((a, c) => a + c.minutes, 0), 0);

  const allocation = input.override?.priority_time_allocation ?? allocate(input.priorities, budget);
  const phases = input.override?.program_phase_structure ?? stagePhases(e.training_stage, p.primary_goal);

  rationale.unshift(
    `Client has ${availableDays} available day(s) and prefers ~${prefMin} min sessions (${weeklyAvailable} min available).`,
    `${qlabel("LOWER_BODY_STRENGTH")} / aerobic / hypertrophy emphasis follows Layer 2: ${input.priorities
      .filter((x) => x.effective_priority === "P1_PRIMARY")
      .map((x) => qlabel(x.quality))
      .join(", ") || "no P1 qualities"}.`,
    `Training stage is ${e.training_stage.toLowerCase()} (${e.training_experience.toLowerCase()} experience, ${e.tolerance_to_training.toLowerCase()} tolerance).`,
    sessions <= 3 && e.training_stage !== "ADVANCED"
      ? "Full-body resistance is more efficient than a body-part split at this frequency and stage."
      : `${split.replaceAll("_", " ").toLowerCase()} matches the session count and primary goal.`,
  );
  if (p2Power) rationale.push("Power is integrated at the start of strength sessions rather than given its own day.");
  if (mobilityPlacement !== "DEDICATED") rationale.push("Mobility is integrated (warm-up / between sets) rather than a dedicated session.");
  if (unilateral) rationale.push("Unilateral exposure is scheduled because a sided strength or symmetry priority is P1/P2. Volume is not automatically doubled on the weaker side.");
  if (p.program_mode === "PERFORMANCE") rationale.push("Gym days are placed away from high sport-load days where those were entered.");

  const optionalDays = schedule.filter((s) => s.kind === "OPTIONAL").length;
  const effectiveSchedule = input.override?.weekly_schedule ?? schedule;

  return {
    recommended_sessions_per_week: prescribed.length || sessions,
    optional_activity_days: optionalDays,
    weekly_available_minutes: weeklyAvailable,
    weekly_training_minutes: weeklyMinutes,
    effective_training_budget: budget,
    session_minutes: sessionMinutes,
    session_split: split,
    cardio_sessions_per_week: new Set(cardioSessions.map((s) => s.day)).size,
    cardio_minutes_per_week: cardioMinutes,
    cardio_session_type: cardioKind,
    power_distribution: powerDist,
    mobility_distribution: mobilityPlacement,
    balance_distribution: unilateral ? "INTEGRATED_UNILATERAL" : "NONE",
    unilateral_bias: unilateral,
    priority_time_allocation: allocation,
    weekly_schedule: effectiveSchedule,
    program_phase_structure: phases,
    recovery_spacing: {
      minimum_recovery_hours_between_similar_sessions: e.training_stage === "ADVANCED" ? 24 : 48,
      note: "Avoid consecutive high-demand lower-body strength days unless performance programming requires it.",
    },
    constraint_flags: [...new Set(flags)],
    practitioner_rationale: rationale,
    client_week: effectiveSchedule.filter((s) => s.kind !== "REST").map((s) => ({ day: DAY_LABEL[s.day], label: s.client_label })),
  };
}

export function applyStructureOverride(auto: StructureResult, override: StructureOverride | null | undefined): StructureResult {
  if (!override) return auto;
  return {
    ...auto,
    recommended_sessions_per_week: override.recommended_sessions_per_week ?? auto.recommended_sessions_per_week,
    session_minutes: override.session_minutes ?? auto.session_minutes,
    session_split: override.session_split ?? auto.session_split,
    weekly_schedule: override.weekly_schedule ?? auto.weekly_schedule,
    priority_time_allocation: override.priority_time_allocation ?? auto.priority_time_allocation,
    program_phase_structure: override.program_phase_structure ?? auto.program_phase_structure,
    client_week: (override.weekly_schedule ?? auto.weekly_schedule).filter((s) => s.kind !== "REST").map((s) => ({ day: DAY_LABEL[s.day], label: s.client_label })),
  };
}
