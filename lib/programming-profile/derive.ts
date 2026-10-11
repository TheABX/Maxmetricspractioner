/**
 * Programming profile logic:
 *   seedFromQuestionnaire  — pre-fill a profile from intake answers
 *   classify               — automatic classifications with rationale
 *   effective              — auto with practitioner overrides applied
 *   buildSummary           — the practitioner verification summary
 *
 * Chronological age is never an input to any classification here.
 */

import {
  emptyProfile,
  label,
  type AutoClassification,
  type Day,
  type EffectiveClassification,
  type Equipment,
  type Experience,
  type Goal,
  type LMH,
  type Location,
  type OverridableField,
  type Overrides,
  type PainLocation,
  type ProfileInput,
  type Stage,
  type StylePref,
  type Volume,
} from "./types";

type Answers = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" && v ? v.split(",") : []);
const lines = (v: unknown): string[] =>
  s(v)
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------
// Seed from questionnaire (v1 or v2 answers)
// ---------------------------------------------------------------------------

const GOAL_MAP: Record<string, Goal> = {
  strength: "MAXIMAL_STRENGTH",
  hypertrophy: "HYPERTROPHY",
  longevity: "GENERAL_HEALTH_LONGEVITY",
  fat_loss: "FAT_LOSS_BODY_COMPOSITION",
  return_to_sport: "SPORT_PERFORMANCE",
  pain_free: "MOBILITY",
  general: "GENERAL_FITNESS",
  fitness: "AEROBIC_FITNESS",
  mobility: "MOBILITY",
  balance: "GENERAL_HEALTH_LONGEVITY",
  energy: "GENERAL_HEALTH_LONGEVITY",
  sport: "SPORT_PERFORMANCE",
};

const EQUIP_MAP: Record<string, Equipment[]> = {
  barbell: ["BARBELL"],
  rack: ["SQUAT_RACK"],
  trap_bar: ["BARBELL"],
  dumbbells: ["DUMBBELLS"],
  adjustable_db: ["DUMBBELLS"],
  kettlebells: ["KETTLEBELLS"],
  cables: ["CABLE_MACHINE"],
  machines: ["SELECTORISED_MACHINES", "LEG_PRESS", "LEG_EXTENSION", "LEG_CURL"],
  bands: ["RESISTANCE_BANDS"],
  bench: ["BENCH"],
  box: ["BOX", "STEP"],
  pullup_bar: ["PULLUP_BAR"],
  bike: ["BIKE", "ROWER", "TREADMILL"],
};

const GYM_EQUIPMENT: Equipment[] = [
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

export function seedFromQuestionnaire(a: Answers): ProfileInput {
  const p = emptyProfile();

  // Goals
  const pg = s(a.primary_goal);
  p.primary_goal = GOAL_MAP[pg] ?? null;
  p.program_mode = pg === "return_to_sport" ? "PERFORMANCE" : "GENERAL_WELLNESS";
  const secondary = new Set<Goal>();
  for (const g of arr(a.secondary_goals)) {
    const mapped = GOAL_MAP[g];
    if (mapped && mapped !== p.primary_goal) secondary.add(mapped);
  }
  p.secondary_goals = [...secondary];
  if (p.primary_goal) p.goal_priorities[p.primary_goal] = "VERY_HIGH";
  for (const g of p.secondary_goals) p.goal_priorities[g] = "MODERATE";
  p.goal_notes = s(a.goal_detail);

  // Experience (entered value; classify() also computes an auto suggestion)
  p.training_experience = experienceFromAnswers(a);

  // Current training
  const cons = s(a.consistency);
  p.recent_consistency =
    cons === "committed" ? "COMMITTED" : cons === "regular" ? "REGULAR" : cons === "sporadic" ? "SPORADIC" : cons === "none" ? "NONE" : null;
  const status = s(a.training_status);
  p.currently_training = status ? status !== "untrained" && cons !== "none" : null;
  if (p.currently_training) {
    p.current_strength_sessions_per_week = cons === "committed" ? 3 : cons === "regular" ? 2 : 1;
    p.current_training_days_per_week = p.current_strength_sessions_per_week;
    p.average_session_duration_minutes = n(a.session_minutes);
  } else if (p.currently_training === false) {
    p.current_training_days_per_week = 0;
    p.current_strength_sessions_per_week = 0;
  }
  p.current_training_notes = [s(a.current_squat), s(a.current_hinge), s(a.current_push), s(a.current_pull), s(a.other_activity)]
    .filter(Boolean)
    .join("\n");

  // Availability
  const days = n(a.days_per_week);
  const wanted = n(a.days_wanted);
  p.available_training_days_per_week = days;
  p.preferred_sessions_per_week = days;
  p.minimum_sessions_per_week = days == null ? null : Math.max(1, days - 1);
  p.maximum_sessions_per_week = wanted == null ? days : Math.max(days ?? 0, wanted);

  const mins = n(a.session_minutes);
  p.preferred_session_minutes = mins;
  p.minimum_session_minutes = mins == null ? null : Math.max(20, mins - 15);
  p.maximum_session_minutes = mins == null ? null : mins >= 90 ? 120 : mins + 15;

  // Environment
  const setting = s(a.setting);
  const loc: Location[] = [];
  if (setting === "commercial_gym" || setting === "clinic" || s(a.gym_access) === "member") loc.push("COMMERCIAL_GYM");
  if (setting === "home_full") loc.push("HOME_GYM");
  if (setting === "home_minimal" || setting === "bodyweight") loc.push("HOME_MINIMAL_EQUIPMENT");
  p.training_locations = [...new Set(loc)];

  const eq = new Set<Equipment>();
  for (const key of arr(a.equipment)) for (const e of EQUIP_MAP[key] ?? []) eq.add(e);
  if (loc.includes("COMMERCIAL_GYM")) for (const e of GYM_EQUIPMENT) eq.add(e);
  p.equipment = [...eq];
  p.equipment_notes = s(a.equipment_detail);

  // Preferences
  p.preferred_exercises = lines(a.enjoys);
  p.disliked_exercises = lines(a.dislikes);
  const style = new Set<StylePref>();
  const sp = s(a.style_pref);
  if (sp === "free_weights") style.add("FREE_WEIGHTS");
  if (sp === "machines") style.add("MACHINE_BASED");
  if (sp === "no_pref") style.add("NO_PREFERENCE");
  const vp = s(a.variety_pref);
  if (vp === "varied") style.add("VARIETY");
  if (vp === "same") style.add("SIMPLE_REPETITIVE");
  const cp = s(a.cardio_pref);
  if (cp === "love") style.add("CARDIO_HEAVY");
  if (mins != null && mins <= 30) style.add("SHORT_EFFICIENT");
  if (mins != null && mins >= 75) style.add("LONGER_SESSIONS");
  if (pg === "hypertrophy") style.add("BODYBUILDING_STYLE");
  if (pg === "strength") style.add("TRADITIONAL_STRENGTH");
  p.training_style_preferences = [...style];

  // Pain
  const painNow = s(a.pain_now).trim();
  p.pain_present = painNow ? true : s(a.injuries).trim() ? null : false;
  p.pain_notes = [painNow, s(a.injuries).trim()].filter(Boolean).join("\n");
  p.activities_that_provoke = s(a.avoids);
  p.pain_locations = guessPainLocations(`${painNow} ${s(a.injuries)} ${s(a.avoids)}`);
  p.medical_clearance_required = s(a.cleared) === "yes" ? true : s(a.cleared) === "no" ? false : null;
  p.medical_clearance_notes = [s(a.cleared_detail), s(a.conditions), s(a.medications)].filter((x) => x.trim()).join("\n");

  // Recovery
  const rec = n(a.recovery_feel);
  const sleep = s(a.sleep_hours);
  const stress = s(a.stress);
  p.recovery_quality =
    (rec != null && rec <= 2) || sleep === "<6" || stress === "high"
      ? "LOW"
      : (rec != null && rec >= 4) && sleep !== "<6" && stress !== "high"
        ? "HIGH"
        : rec == null && !sleep && !stress
          ? null
          : "MODERATE";

  return p;
}

function guessPainLocations(text: string): PainLocation[] {
  const t = text.toLowerCase();
  const out = new Set<PainLocation>();
  const side = (word: string): "L" | "R" | null =>
    new RegExp(`left\\s+${word}|${word}\\s*\\(?l\\)?\\b`).test(t) ? "L" : new RegExp(`right\\s+${word}|${word}\\s*\\(?r\\)?\\b`).test(t) ? "R" : null;
  const both = (word: string, l: PainLocation, r: PainLocation) => {
    if (!t.includes(word)) return;
    const sd = side(word);
    if (sd === "L") out.add(l);
    else if (sd === "R") out.add(r);
    else {
      out.add(l);
      out.add(r);
    }
  };
  both("shoulder", "SHOULDER_L", "SHOULDER_R");
  both("elbow", "ELBOW_L", "ELBOW_R");
  both("wrist", "WRIST_HAND_L", "WRIST_HAND_R");
  both("hip", "HIP_L", "HIP_R");
  both("knee", "KNEE_L", "KNEE_R");
  both("ankle", "ANKLE_FOOT_L", "ANKLE_FOOT_R");
  if (/lower back|low back|lumbar/.test(t)) out.add("LOWER_BACK");
  if (/upper back|thoracic/.test(t)) out.add("UPPER_BACK");
  if (/neck|cervical/.test(t)) out.add("NECK");
  return [...out];
}

function experienceFromAnswers(a: Answers): Experience | null {
  const status = s(a.training_status);
  if (!status) return null;
  const years = n(a.years_training) ?? 0;
  const cons = s(a.consistency);
  const fam = ["fam_barbell_squat", "fam_deadlift", "fam_press", "fam_dumbbell", "fam_machines"].map((k) => s(a[k]));
  const famScore = fam.reduce((acc, v) => acc + (v === "strong" ? 3 : v === "competent" ? 2 : v === "tried" ? 1 : 0), 0);
  let score = 0;
  score += status === "knows_loads" ? 3 : status === "trains_no_numbers" ? 1.5 : 0;
  score += years >= 5 ? 3 : years >= 2 ? 2 : years >= 0.5 ? 1 : 0;
  score += cons === "committed" ? 2 : cons === "regular" ? 1.5 : cons === "sporadic" ? 0.5 : 0;
  score += s(a.coached_before) === "yes" ? 1.5 : s(a.coached_before) === "some" ? 0.5 : 0;
  score += famScore / 3;
  return score >= 10 ? "ADVANCED" : score >= 6 ? "INTERMEDIATE" : score >= 2.5 ? "BEGINNER" : "NONE";
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export type AssessmentSignals = {
  /** Overhead squat observation, if recorded. */
  squat_depth?: string | null;
  squat_pain?: string | null;
  /** Count of mobility tests flagged as priority asymmetry. */
  mobility_priority_count?: number;
  /** Count of capability answers marked 'no' / 'with_pain' on the questionnaire. */
  capability_no?: number;
  capability_pain?: number;
  movement_confidence?: string | null;
};

const CAPABILITY_KEYS = ["can_squat", "can_hinge", "can_push", "can_pull", "can_carry", "can_overhead", "can_floor", "can_balance", "can_stairs"];

/** Movement signals the questionnaire can supply before any assessment. */
export function signalsFromAnswers(a: Answers | null | undefined): AssessmentSignals {
  if (!a) return {};
  const vals = CAPABILITY_KEYS.map((k) => s(a[k]));
  return {
    capability_no: vals.filter((v) => v === "no").length,
    capability_pain: vals.filter((v) => v === "with_pain").length,
    movement_confidence: s(a.movement_confidence) || null,
  };
}

export function classify(p: ProfileInput, signals: AssessmentSignals = {}): AutoClassification {
  const rationale: AutoClassification["rationale"] = {};

  // Training experience: use the entered value; fall back to NONE.
  const training_experience: Experience = p.training_experience ?? "NONE";
  rationale.training_experience = p.training_experience
    ? "From intake: training status, years, consistency, coaching, lift familiarity."
    : "No experience data — defaulted to NONE.";

  // Current volume: what they are accustomed to now.
  const sessions = (p.current_strength_sessions_per_week ?? 0) + (p.current_cardio_sessions_per_week ?? 0);
  const perSession = p.average_session_duration_minutes ?? 45;
  const weeklyMin = p.currently_training === false ? 0 : sessions * perSession;
  const current_training_volume_category: Volume =
    p.currently_training === false || sessions === 0
      ? "NONE"
      : weeklyMin < 90
        ? "LOW"
        : weeklyMin < 200
          ? "MODERATE"
          : weeklyMin < 350
            ? "HIGH"
            : "VERY_HIGH";
  rationale.current_training_volume_category = `${sessions} session(s)/week × ~${perSession} min ≈ ${weeklyMin} min/week.`;

  // Movement competency: questionnaire capability + confidence, modified by assessment squat.
  const capNo = signals.capability_no ?? 0;
  const capPain = signals.capability_pain ?? 0;
  const conf = signals.movement_confidence ?? "";
  let mcScore = 2; // start moderate
  if (conf === "high") mcScore += 1;
  if (conf === "low") mcScore -= 1;
  if (capNo >= 3 || capPain >= 4) mcScore -= 1;
  if (capNo === 0 && capPain <= 1) mcScore += 0.5;
  const depth = (signals.squat_depth ?? "").toUpperCase();
  if (depth === "FULL") mcScore += 0.5;
  if (depth === "ABOVE_PARALLEL") mcScore -= 0.5;
  if (depth === "NOT_COMPLETED") mcScore -= 1;
  if (signals.squat_pain && signals.squat_pain.toUpperCase() === "YES") mcScore -= 1;
  if ((signals.mobility_priority_count ?? 0) >= 2) mcScore -= 0.5;
  if (training_experience === "ADVANCED") mcScore += 0.5;
  const movement_competency: LMH = mcScore <= 1 ? "LOW" : mcScore >= 3 ? "HIGH" : "MODERATE";
  rationale.movement_competency = [
    conf ? `self-rated ${conf} confidence` : null,
    capNo ? `${capNo} pattern(s) unable` : null,
    capPain ? `${capPain} pattern(s) with pain/hesitation` : null,
    depth ? `squat depth ${label(depth)}` : null,
    signals.squat_pain && signals.squat_pain.toUpperCase() === "YES" ? "pain in squat observation" : null,
    (signals.mobility_priority_count ?? 0) >= 2 ? `${signals.mobility_priority_count} priority asymmetries` : null,
  ]
    .filter(Boolean)
    .join("; ") || "No movement signals yet — defaulted to MODERATE; verify after assessment.";

  // Tolerance: current workload, recovery, recent consistency. Not experience.
  let tol = 0;
  tol += current_training_volume_category === "NONE" ? 0 : current_training_volume_category === "LOW" ? 1 : current_training_volume_category === "MODERATE" ? 2 : 3;
  tol += p.recovery_quality === "HIGH" ? 1.5 : p.recovery_quality === "LOW" ? -1 : 0.5;
  tol += p.recent_consistency === "COMMITTED" ? 1.5 : p.recent_consistency === "REGULAR" ? 1 : p.recent_consistency === "SPORADIC" ? 0 : -0.5;
  if (p.pain_present && (p.pain_severity ?? 0) >= 5) tol -= 1;
  const tolerance_to_training: LMH = tol <= 1.5 ? "LOW" : tol >= 4 ? "HIGH" : "MODERATE";
  rationale.tolerance_to_training = `volume ${label(current_training_volume_category)}, recovery ${label(p.recovery_quality)}, consistency ${label(p.recent_consistency)}${
    p.pain_present && (p.pain_severity ?? 0) >= 5 ? ", significant pain" : ""
  }.`;

  // Foundation: two or more risk factors. Age is never considered.
  const factors = [
    training_experience === "NONE" || training_experience === "BEGINNER" ? "low experience" : null,
    movement_competency === "LOW" ? "low movement competency" : null,
    current_training_volume_category === "NONE" || current_training_volume_category === "LOW" ? "low current volume" : null,
    tolerance_to_training === "LOW" ? "low tolerance" : null,
  ].filter((x): x is string => Boolean(x));
  const foundation_phase_recommended = factors.length >= 2;
  rationale.foundation_phase_recommended = factors.length
    ? `${factors.length} factor(s): ${factors.join(", ")}. Threshold is 2.`
    : "No foundation risk factors present.";

  // Stage
  const training_stage: Stage = foundation_phase_recommended
    ? "FOUNDATION"
    : training_experience === "ADVANCED" && movement_competency === "HIGH" && tolerance_to_training !== "LOW"
      ? "ADVANCED"
      : "DEVELOPMENT";
  rationale.training_stage =
    training_stage === "FOUNDATION"
      ? "Foundation recommended (see above)."
      : training_stage === "ADVANCED"
        ? "Advanced experience, high competency, adequate tolerance."
        : "Can perform fundamentals and tolerate progressive training.";

  return {
    training_experience,
    current_training_volume_category,
    movement_competency,
    tolerance_to_training,
    foundation_phase_recommended,
    training_stage,
    rationale,
  };
}

export function effective(auto: AutoClassification, overrides: Overrides): EffectiveClassification {
  const overridden: OverridableField[] = [];
  const pick = <K extends OverridableField>(k: K): AutoClassification[K] => {
    const o = overrides[k];
    if (o && o.value !== undefined && o.value !== null && o.value !== auto[k]) {
      overridden.push(k);
      return o.value as AutoClassification[K];
    }
    return auto[k];
  };
  return {
    training_experience: pick("training_experience"),
    current_training_volume_category: pick("current_training_volume_category"),
    movement_competency: pick("movement_competency"),
    tolerance_to_training: pick("tolerance_to_training"),
    foundation_phase_recommended: pick("foundation_phase_recommended"),
    training_stage: pick("training_stage"),
    overridden,
  };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const DAY_LABEL: Record<Day, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export function buildSummary(p: ProfileInput, e: EffectiveClassification): { lines: [string, string][]; constraints: string[]; text: string } {
  const goal = p.primary_goal === "OTHER" && p.primary_goal_custom ? p.primary_goal_custom : label(p.primary_goal);
  const secondary = p.secondary_goals.length
    ? p.secondary_goals.map((g) => `${label(g)}${p.goal_priorities[g] ? ` (${label(p.goal_priorities[g])})` : ""}`).join(", ")
    : "—";
  const current =
    p.currently_training === false
      ? "Not currently training"
      : p.current_strength_sessions_per_week != null || p.current_cardio_sessions_per_week != null
        ? `${p.current_strength_sessions_per_week ?? 0} strength + ${p.current_cardio_sessions_per_week ?? 0} cardio / week${
            p.average_session_duration_minutes ? ` · ~${p.average_session_duration_minutes} min` : ""
          } · ${label(e.current_training_volume_category)} volume`
        : "Unknown";
  const avail = [
    p.available_training_days_per_week != null ? `${p.available_training_days_per_week} days/week` : null,
    p.preferred_sessions_per_week != null
      ? `${p.minimum_sessions_per_week ?? p.preferred_sessions_per_week}–${p.maximum_sessions_per_week ?? p.preferred_sessions_per_week} sessions (prefers ${p.preferred_sessions_per_week})`
      : null,
    p.preferred_session_minutes != null
      ? `${p.minimum_session_minutes ?? p.preferred_session_minutes}–${p.maximum_session_minutes ?? p.preferred_session_minutes} min (prefers ${p.preferred_session_minutes})`
      : null,
    p.preferred_days.length ? p.preferred_days.map((d) => DAY_LABEL[d]).join("/") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const env = p.training_locations.length ? p.training_locations.map(label).join(", ") : "—";

  const constraints: string[] = [];
  if (e.training_experience === "NONE" || e.training_experience === "BEGINNER") constraints.push("Low training experience");
  if (e.movement_competency === "LOW") constraints.push("Low movement competency");
  if (e.tolerance_to_training === "LOW") constraints.push("Low training tolerance");
  if (e.current_training_volume_category === "NONE") constraints.push("Not currently training");
  if ((p.preferred_session_minutes ?? 60) <= 30) constraints.push("Limited session duration");
  if ((p.available_training_days_per_week ?? 3) <= 2) constraints.push("Limited days available");
  if (p.equipment.length > 0 && p.equipment.length <= 3) constraints.push("Minimal equipment");
  if (p.equipment.length === 0) constraints.push("No equipment recorded");
  if (p.pain_present) constraints.push(`Pain present${p.pain_severity != null ? ` (${p.pain_severity}/10)` : ""}`);
  if (p.medical_clearance_required && !p.medical_clearance_obtained) constraints.push("Medical clearance outstanding");
  const hard = p.excluded_exercises.filter((x) => x.reason === "PAIN" || x.reason === "MEDICAL_RESTRICTION");
  if (hard.length) constraints.push(`${hard.length} hard exclusion(s)`);
  if (p.program_mode === "PERFORMANCE" && !p.performance.sport) constraints.push("Performance mode without sport specified");

  const prefs = [
    ...p.training_style_preferences.map(label),
    ...(p.preferred_exercises.length ? [`likes: ${p.preferred_exercises.slice(0, 4).join(", ")}`] : []),
    ...(p.disliked_exercises.length ? [`avoid: ${p.disliked_exercises.slice(0, 4).join(", ")}`] : []),
  ].join(" · ");

  const lines: [string, string][] = [
    ["Program mode", label(p.program_mode)],
    ["Primary goal", `${goal}${p.primary_goal && p.goal_priorities[p.primary_goal] ? ` (${label(p.goal_priorities[p.primary_goal])})` : ""}`],
    ["Secondary goals", secondary],
    ["Training stage", `${label(e.training_stage)}${e.overridden.includes("training_stage") ? " (overridden)" : ""}`],
    ["Foundation phase", e.foundation_phase_recommended ? "Recommended" : "Not required"],
    ["Training experience", label(e.training_experience)],
    ["Movement competency", label(e.movement_competency)],
    ["Training tolerance", label(e.tolerance_to_training)],
    ["Current training", current],
    ["Available", avail || "—"],
    ["Environment", env],
    ["Main constraints", constraints.length ? constraints.join("; ") : "None flagged"],
    ["Preferences", prefs || "—"],
  ];
  if (p.program_mode === "PERFORMANCE") {
    const q = Object.entries(p.performance.qualities)
      .filter(([, v]) => v === "HIGH" || v === "VERY_HIGH")
      .map(([k, v]) => `${label(k.toUpperCase())} (${label(v)})`);
    lines.splice(3, 0, [
      "Sport",
      [p.performance.sport, p.performance.event_or_position, p.performance.competition_level].filter(Boolean).join(" · ") || "—",
    ]);
    lines.push(["Priority qualities", q.length ? q.join(", ") : "None rated HIGH+"]);
  }
  const text = lines.map(([k, v]) => `${k.toUpperCase()}: ${v}`).join("\n");
  return { lines, constraints, text };
}
