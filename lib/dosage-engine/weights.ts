/**
 * Configurable dosage templates. Not validated science — starting ranges.
 * Do not treat a single rep range as "strength."
 */

import type { Stage, Volume } from "@/lib/programming-profile/types";
import type { PriorityLevel } from "@/lib/priority-engine/types";
import type { VolumeRegion } from "./types";

export type Band = { sets: [number, number]; reps: [number, number]; rir: [number, number]; rest: [number, number] };

export const STAGE_DOSE: Record<Stage, { strength: Band; hypertrophy: Band; power: Band; isolation: Band }> = {
  FOUNDATION: {
    strength: { sets: [2, 3], reps: [8, 10], rir: [3, 4], rest: [90, 120] },
    hypertrophy: { sets: [2, 3], reps: [8, 12], rir: [2, 3], rest: [90, 150] },
    power: { sets: [2, 3], reps: [3, 5], rir: [4, 5], rest: [90, 150] },
    isolation: { sets: [2, 2], reps: [8, 12], rir: [2, 3], rest: [60, 90] },
  },
  DEVELOPMENT: {
    strength: { sets: [3, 4], reps: [5, 8], rir: [2, 3], rest: [150, 210] },
    hypertrophy: { sets: [3, 4], reps: [8, 12], rir: [1, 2], rest: [120, 180] },
    power: { sets: [3, 4], reps: [3, 5], rir: [3, 4], rest: [120, 180] },
    isolation: { sets: [2, 3], reps: [8, 15], rir: [1, 2], rest: [60, 90] },
  },
  ADVANCED: {
    strength: { sets: [4, 5], reps: [4, 6], rir: [1, 2], rest: [180, 300] },
    hypertrophy: { sets: [3, 5], reps: [6, 12], rir: [1, 2], rest: [120, 180] },
    power: { sets: [4, 5], reps: [2, 4], rir: [3, 4], rest: [150, 210] },
    isolation: { sets: [3, 4], reps: [8, 15], rir: [0, 2], rest: [45, 90] },
  },
};

/** Share of the stage band's set range used by priority. */
export const PRIORITY_SET_SHARE: Record<PriorityLevel | "MAINTAIN", number> = {
  P1_PRIMARY: 1,
  P2_SECONDARY: 0.75,
  P3_MONITOR: 0.55,
  MAINTAIN: 0.45,
  NOT_RELEVANT: 0.4,
  REVIEW_REQUIRED: 0.4,
};

export const CURRENT_VOLUME_SETS: Record<Volume, number> = {
  NONE: 0,
  LOW: 6,
  MODERATE: 12,
  HIGH: 20,
  VERY_HIGH: 28,
};

/** If proposed weekly hard sets exceed current by this factor, flag and cap the start. */
export const RAPID_VOLUME_FACTOR = 2.2;
export const RAPID_VOLUME_MIN_JUMP = 8;

/** Extra weak-side set is off unless the practitioner turns it on or symmetry is P1 with high severity. */
export const EXTRA_WEAK_SIDE_DEFAULT = false;

/** How much of a set counts toward a region. Compounds are not full isolation sets for every muscle. */
export const REGION_CREDIT: Partial<Record<string, Partial<Record<VolumeRegion, number>>>> = {
  SQUAT: { QUADRICEPS: 1, GLUTES: 0.7, HAMSTRINGS: 0.2 },
  LUNGE_SPLIT_SQUAT: { QUADRICEPS: 0.9, GLUTES: 0.7, HAMSTRINGS: 0.2 },
  STEP: { QUADRICEPS: 0.7, GLUTES: 0.6 },
  KNEE_EXTENSION: { QUADRICEPS: 1 },
  HINGE: { HAMSTRINGS: 1, GLUTES: 0.8, QUADRICEPS: 0.15 },
  HIP_EXTENSION: { GLUTES: 1, HAMSTRINGS: 0.4 },
  KNEE_FLEXION: { HAMSTRINGS: 1 },
  HORIZONTAL_PUSH: { CHEST: 1, SHOULDERS: 0.4, TRICEPS: 0.5 },
  VERTICAL_PUSH: { SHOULDERS: 1, TRICEPS: 0.5 },
  HORIZONTAL_PULL: { BACK: 1, BICEPS: 0.4 },
  VERTICAL_PULL: { BACK: 1, BICEPS: 0.5 },
  CALF_PLANTARFLEXION: { CALVES: 1 },
  ANTI_ROTATION: { TRUNK: 0.8 },
  ANTI_EXTENSION: { TRUNK: 0.8 },
  CARRY: { TRUNK: 0.5 },
};

export const AEROBIC_RPE: Record<string, [number, number]> = {
  LOW_INTENSITY_STEADY_STATE: [3, 4],
  MODERATE_CONTINUOUS: [4, 6],
  INTERVAL: [7, 8],
};

export const MOBILITY_EXPOSURES: Record<string, [number, number]> = {
  P1_PRIMARY: [5, 7],
  P2_SECONDARY: [3, 4],
  P3_MONITOR: [1, 2],
  MAINTAIN: [1, 1],
};
