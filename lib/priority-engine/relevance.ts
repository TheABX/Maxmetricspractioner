import type { Goal, PerfQuality, ProfileInput, ProgramMode, Relevance } from "@/lib/programming-profile/types";
import type { Quality, RelevanceLevel } from "./types";

const rank: Record<RelevanceLevel, number> = { NONE: 0, LOW: 1, MODERATE: 2, HIGH: 3, VERY_HIGH: 4 };
const higher = (a: RelevanceLevel, b: RelevanceLevel): RelevanceLevel => (rank[a] >= rank[b] ? a : b);

const WELLNESS: Partial<Record<Goal, Partial<Record<Quality, RelevanceLevel>>>> = {
  GENERAL_HEALTH_LONGEVITY: {
    AEROBIC_CAPACITY: "VERY_HIGH",
    LOWER_BODY_STRENGTH: "VERY_HIGH",
    MAXIMAL_STRENGTH: "HIGH",
    GRIP_STRENGTH: "HIGH",
    POWER: "HIGH",
    RAPID_FORCE_PRODUCTION: "HIGH",
    BALANCE: "MODERATE",
    ANKLE_MOBILITY: "MODERATE",
    HIP_MOBILITY: "MODERATE",
    POSTERIOR_CHAIN_MOBILITY: "MODERATE",
    SHOULDER_MOBILITY: "MODERATE",
    MOVEMENT_COMPETENCY: "MODERATE",
    HYPERTROPHY: "LOW",
    BODY_COMPOSITION: "MODERATE",
    UPPER_BODY_STRENGTH: "MODERATE",
    KNEE_EXTENSOR_STRENGTH: "HIGH",
    KNEE_FLEXOR_STRENGTH: "MODERATE",
    HIP_ABDUCTION_STRENGTH: "MODERATE",
    LEFT_RIGHT_SYMMETRY: "MODERATE",
    GENERAL_ACTIVITY: "HIGH",
    RECOVERY: "MODERATE",
  },
  HYPERTROPHY: {
    HYPERTROPHY: "VERY_HIGH",
    MAXIMAL_STRENGTH: "HIGH",
    LOWER_BODY_STRENGTH: "HIGH",
    UPPER_BODY_STRENGTH: "HIGH",
    KNEE_EXTENSOR_STRENGTH: "HIGH",
    AEROBIC_CAPACITY: "LOW",
    POWER: "LOW",
    RAPID_FORCE_PRODUCTION: "LOW",
    ANKLE_MOBILITY: "LOW",
    HIP_MOBILITY: "LOW",
    POSTERIOR_CHAIN_MOBILITY: "LOW",
    SHOULDER_MOBILITY: "LOW",
    MOVEMENT_COMPETENCY: "MODERATE",
    BODY_COMPOSITION: "MODERATE",
    GRIP_STRENGTH: "LOW",
    LEFT_RIGHT_SYMMETRY: "LOW",
  },
  MAXIMAL_STRENGTH: {
    MAXIMAL_STRENGTH: "VERY_HIGH",
    LOWER_BODY_STRENGTH: "VERY_HIGH",
    UPPER_BODY_STRENGTH: "HIGH",
    KNEE_EXTENSOR_STRENGTH: "HIGH",
    POWER: "MODERATE",
    HYPERTROPHY: "MODERATE",
    AEROBIC_CAPACITY: "LOW",
    MOVEMENT_COMPETENCY: "HIGH",
    LEFT_RIGHT_SYMMETRY: "MODERATE",
  },
  FAT_LOSS_BODY_COMPOSITION: {
    BODY_COMPOSITION: "VERY_HIGH",
    AEROBIC_CAPACITY: "HIGH",
    HYPERTROPHY: "HIGH",
    LOWER_BODY_STRENGTH: "MODERATE",
    GENERAL_ACTIVITY: "HIGH",
  },
  AEROBIC_FITNESS: {
    AEROBIC_CAPACITY: "VERY_HIGH",
    ANAEROBIC_CAPACITY: "MODERATE",
    LOWER_BODY_STRENGTH: "MODERATE",
    GENERAL_ACTIVITY: "HIGH",
  },
  POWER: {
    POWER: "VERY_HIGH",
    RAPID_FORCE_PRODUCTION: "VERY_HIGH",
    MAXIMAL_STRENGTH: "HIGH",
    LOWER_BODY_STRENGTH: "HIGH",
    SPEED_ACCELERATION: "HIGH",
  },
  MOBILITY: {
    ANKLE_MOBILITY: "VERY_HIGH",
    HIP_MOBILITY: "VERY_HIGH",
    POSTERIOR_CHAIN_MOBILITY: "VERY_HIGH",
    SHOULDER_MOBILITY: "VERY_HIGH",
    MOVEMENT_COMPETENCY: "VERY_HIGH",
  },
  GENERAL_FITNESS: {
    LOWER_BODY_STRENGTH: "HIGH",
    AEROBIC_CAPACITY: "HIGH",
    HYPERTROPHY: "MODERATE",
    POWER: "MODERATE",
    MOVEMENT_COMPETENCY: "MODERATE",
    GENERAL_ACTIVITY: "HIGH",
  },
  SPORT_PERFORMANCE: {},
  OTHER: { GENERAL_ACTIVITY: "MODERATE" },
};

const PERF_MAP: Record<PerfQuality, Quality[]> = {
  maximal_strength: ["MAXIMAL_STRENGTH", "LOWER_BODY_STRENGTH", "UPPER_BODY_STRENGTH"],
  power: ["POWER", "RAPID_FORCE_PRODUCTION"],
  speed: ["SPEED_ACCELERATION"],
  acceleration: ["SPEED_ACCELERATION"],
  aerobic: ["AEROBIC_CAPACITY"],
  anaerobic: ["ANAEROBIC_CAPACITY"],
  mobility: ["ANKLE_MOBILITY", "HIP_MOBILITY", "SHOULDER_MOBILITY", "POSTERIOR_CHAIN_MOBILITY", "MOVEMENT_COMPETENCY"],
  symmetry: ["LEFT_RIGHT_SYMMETRY"],
  muscular_endurance: ["GENERAL_ACTIVITY"],
  hypertrophy: ["HYPERTROPHY"],
};

function fromPerf(r: Relevance | undefined): RelevanceLevel {
  if (!r || r === "NOT_RELEVANT") return "NONE";
  return r;
}

export function goalRelevance(quality: Quality, profile: ProfileInput, mode: ProgramMode): RelevanceLevel {
  if (mode === "PERFORMANCE") {
    let best: RelevanceLevel = "NONE";
    for (const [k, qs] of Object.entries(PERF_MAP)) {
      if (!qs.includes(quality)) continue;
      best = higher(best, fromPerf(profile.performance.qualities[k as PerfQuality]));
    }
    // Sport context still inherits a thin wellness floor only when the practitioner left a quality blank.
    if (best !== "NONE") return best;
  }

  let best: RelevanceLevel = "NONE";
  const primary = profile.primary_goal;
  if (primary) best = higher(best, WELLNESS[primary]?.[quality] ?? "NONE");
  for (const g of profile.secondary_goals) {
    const v = WELLNESS[g]?.[quality] ?? "NONE";
    // Secondary goals cannot outrank the primary map for that quality, but they can lift NONE/LOW.
    if (rank[v] > rank[best]) best = v === "VERY_HIGH" ? "HIGH" : v;
  }
  return best;
}

export function mapsToPrimaryGoal(quality: Quality, goal: Goal | null): boolean {
  if (!goal) return false;
  return (WELLNESS[goal]?.[quality] ?? "NONE") === "VERY_HIGH";
}

export function mapsToSecondaryGoal(quality: Quality, goals: Goal[]): boolean {
  return goals.some((g) => (WELLNESS[g]?.[quality] ?? "NONE") === "VERY_HIGH");
}

export function supportsPrimary(quality: Quality, goal: Goal | null): boolean {
  if (!goal) return false;
  const v = WELLNESS[goal]?.[quality] ?? "NONE";
  return v === "HIGH";
}
