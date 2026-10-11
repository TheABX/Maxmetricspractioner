/**
 * Configurable adaptation thresholds. Starting rules, not validated science.
 */

export const WINDOWS = { short: 7, fortnight: 14, month: 28 } as const;

export const ADHERENCE = {
  excellent: 0.9,
  good: 0.75,
  moderate: 0.5,
  missed_check_in: 2,
};

export const PAIN = {
  mild_max: 3,
  moderate_max: 6,
  repeated_exposures: 2,
};

export const PROGRESS = {
  top_range_sessions: 2,
  missed_rep_sessions: 3,
  stall_exposures_default: 4,
  stall_exposures_advanced: 6,
  effort_trend_sessions: 3,
  one_bad_session_ignore: true,
};

export const LIMITS = {
  max_load_increase_percent: 10,
  max_weekly_set_increase: 1,
  max_cardio_minutes_increase: 5,
  max_exercise_changes_per_week: 1,
};

export const LOW_RISK_ACTIONS = new Set([
  "INCREASE_REPS",
  "INCREASE_LOAD",
  "HOLD_PRESCRIPTION",
  "INCREASE_DURATION",
  "HOLD_DURATION",
]);

export const RED_FLAG_TERMS = [
  "swelling",
  "swollen",
  "numb",
  "numbness",
  "tingling",
  "pins and needles",
  "giving way",
  "gave way",
  "unstable",
  "instability",
  "can't walk",
  "cannot walk",
  "loss of function",
  "night pain",
  "locking",
];

export function loadIncrement(slug: string, name: string): number {
  const t = `${slug} ${name}`.toLowerCase();
  if (t.includes("leg_press") || t.includes("leg press") || t.includes("hack")) return 5;
  if (t.includes("curl") || t.includes("raise") || t.includes("fly") || t.includes("extension") && t.includes("leg")) return t.includes("leg") ? 2.5 : 1;
  if (t.includes("db_") || t.includes("dumbbell") || t.includes("goblet")) return 2;
  if (t.includes("barbell") || t.includes("back_squat") || t.includes("deadlift") || t.includes("rdl")) return 2.5;
  if (t.includes("machine") || t.includes("cable")) return 2.5;
  return 2.5;
}

export function rirFromRpe(rpe: number | null | undefined): number | null {
  if (rpe == null || !Number.isFinite(rpe)) return null;
  return Math.max(0, Math.round((10 - rpe) * 10) / 10);
}
