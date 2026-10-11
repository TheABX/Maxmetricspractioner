import type { EffectiveClassification, Goal, ProfileInput, ProgramMode } from "@/lib/programming-profile/types";
import { goalRelevance, mapsToPrimaryGoal, mapsToSecondaryGoal, supportsPrimary } from "./relevance";
import {
  ASYMMETRY_W,
  CONF_W,
  FUNC_W,
  GOAL_W,
  PRIMARY_GOAL_BOOST,
  SECONDARY_GOAL_BOOST,
  SEVERITY_W,
  SUPPORTS_PRIMARY_BOOST,
  SUPPORT_W,
  TREND_W,
  WEIGHTS_ID,
  levelFromScore,
} from "./weights";
import type {
  Confidence,
  Finding,
  FunctionalRelevance,
  PriorityLevel,
  PriorityOverrides,
  PriorityResult,
  Quality,
  RankedPriority,
  RelevanceLevel,
  Severity,
  SupportLevel,
  Trend,
} from "./types";
import { LEVEL_CLIENT, qlabel, qualityKey } from "./types";

const SEV_ORD: Severity[] = ["NONE", "MILD", "MODERATE", "HIGH", "VERY_HIGH"];
const REL_ORD: RelevanceLevel[] = ["NONE", "LOW", "MODERATE", "HIGH", "VERY_HIGH"];
const CONF_ORD: Confidence[] = ["LOW", "MODERATE", "HIGH"];
const FUNC_ORD: FunctionalRelevance[] = ["LOW", "MODERATE", "HIGH"];
const maxOf = <T extends string>(vals: T[], order: T[]) =>
  vals.reduce((best, v) => (order.indexOf(v) > order.indexOf(best) ? v : best), order[0]);

const LOWER_CLUSTER = new Set<Quality>(["KNEE_EXTENSOR_STRENGTH", "KNEE_FLEXOR_STRENGTH", "HIP_ABDUCTION_STRENGTH", "LOWER_BODY_STRENGTH", "LEFT_RIGHT_SYMMETRY", "ANKLE_MOBILITY"]);

function clusterFindings(findings: Finding[]): Finding[] {
  const left = findings.filter((f) => f.lower_side === "L" && LOWER_CLUSTER.has(f.quality));
  const right = findings.filter((f) => f.lower_side === "R" && LOWER_CLUSTER.has(f.quality));
  const tag = (rows: Finding[], name: string) => {
    if (rows.length < 2) return;
    const ids = rows.map((r) => r.finding_id);
    for (const f of rows) {
      f.cluster = name;
      f.supporting_findings = ids.filter((id) => id !== f.finding_id);
      f.source_count = ids.length;
      if (ids.length >= 3 && (f.confidence === "LOW" || f.confidence === "MODERATE")) f.confidence = "HIGH";
    }
  };
  tag(left, "CONSISTENT_LEFT_LOWER_LIMB_DEFICIT");
  tag(right, "CONSISTENT_RIGHT_LOWER_LIMB_DEFICIT");
  return findings;
}

function supportLevel(n: number): SupportLevel {
  if (n >= 3) return "MULTIPLE_SUPPORTING";
  if (n === 2) return "ONE_SUPPORTING";
  return "NONE";
}

function isolatedMildAsymmetry(group: Finding[]): boolean {
  const asym = group.filter((f) => f.quality === "LEFT_RIGHT_SYMMETRY" || (f.asymmetry_percent != null && f.asymmetry_percent >= 10));
  if (!asym.length) return false;
  const worst = maxOf(asym.map((a) => a.severity), SEV_ORD);
  if (worst !== "MILD" && worst !== "MODERATE") return false;
  const corroborating = group.filter(
    (f) =>
      f.quality !== "LEFT_RIGHT_SYMMETRY" &&
      f.severity !== "NONE" &&
      f.severity_confidence !== "LOW" &&
      f.test_source !== asym[0]?.test_source,
  );
  return corroborating.length === 0;
}

function concerningPain(findings: Finding[], profile: ProfileInput): boolean {
  if (profile.medical_clearance_required && !profile.medical_clearance_obtained) return true;
  if (profile.pain_present && (profile.pain_severity ?? 0) >= 5) return true;
  return findings.some((f) => f.pain_associated && (f.severity === "HIGH" || f.severity === "VERY_HIGH"));
}

function actionFor(level: PriorityLevel): RankedPriority["action"] {
  if (level === "REVIEW_REQUIRED") return "escalate";
  if (level === "MAINTAIN" || level === "NOT_RELEVANT") return "maintain";
  if (level === "P3_MONITOR") return "monitor";
  return "improve";
}

function workLine(q: Quality, level: PriorityLevel): string {
  if (level === "MAINTAIN") return `Preserve current ${qlabel(q).toLowerCase()} with minimum effective exposure.`;
  if (level === "REVIEW_REQUIRED") return "Do not load this quality aggressively until reviewed. This is not a diagnosis.";
  if (q === "AEROBIC_CAPACITY") return "Progressive aerobic training within the weekly time budget.";
  if (q === "HYPERTROPHY") return "Sufficient weekly muscle-group exposure and recoverable volume.";
  if (q.includes("MOBILITY")) return "Targeted mobility where it limits training; do not add dedicated sessions unless functionally limiting.";
  if (q === "POWER" || q === "RAPID_FORCE_PRODUCTION") return "Short power work while fresh, typically at the start of a strength session.";
  if (q === "LEFT_RIGHT_SYMMETRY") return "Unilateral exposure with the lower side first. Do not automatically double volume.";
  if (q === "RECOVERY") return "Conservative weekly load and extra spacing between hard sessions.";
  return `Progressive ${qlabel(q).toLowerCase()} work, scaled to stage and tolerance.`;
}

function clientLine(q: Quality, level: PriorityLevel): string {
  const verb = LEVEL_CLIENT[level];
  if (!verb) return "";
  return `${verb} ${qlabel(q).toLowerCase()}`;
}

function whyLines(opts: {
  quality: Quality;
  findings: Finding[];
  goal: RelevanceLevel;
  primary: Goal | null;
  mode: ProgramMode;
  severity: Severity;
  isolated: boolean;
  cluster: string | null;
  goalDriven: boolean;
}): string[] {
  const why: string[] = [];
  if (opts.goalDriven) why.push(`${qlabel(opts.quality)} is a primary-goal quality (${opts.primary?.replaceAll("_", " ").toLowerCase() ?? "goal"}).`);
  if (opts.goal !== "NONE") why.push(`Goal relevance is ${opts.goal.replaceAll("_", " ").toLowerCase()} in ${opts.mode === "PERFORMANCE" ? "performance" : "general wellness"} mode.`);
  if (opts.severity !== "NONE") {
    const withRef = opts.findings.filter((f) => f.reference_percentile != null);
    if (withRef.length) why.push(`Capacity is below the available age/sex reference (severity ${opts.severity.replaceAll("_", " ").toLowerCase()}).`);
    else why.push(`Severity ${opts.severity.replaceAll("_", " ").toLowerCase()} comes from clinic symmetry/function rules, not a population ranking.`);
  } else if (!opts.goalDriven) {
    why.push("No established capacity deficit was scored.");
  }
  if (opts.cluster) why.push(`Multiple tests agree: ${opts.cluster.replaceAll("_", " ").toLowerCase()}.`);
  if (opts.isolated) why.push("Mild isolated finding without corroborating tests — not treated as a primary deficit.");
  const func = opts.findings.find((f) => f.functional_relevance === "HIGH");
  if (func) why.push("Functional impact is high (movement screen or daily limitation).");
  if (opts.mode === "PERFORMANCE" && (opts.goal === "NONE" || opts.goal === "LOW")) {
    why.push("General-population norms are not used as automatic performance priorities.");
  }
  return why;
}

type Group = {
  quality: Quality;
  parent_quality: Quality | null;
  laterality: RankedPriority["laterality"];
  findings: Finding[];
};

function groupFindings(findings: Finding[]): Group[] {
  const map = new Map<string, Group>();
  for (const f of findings) {
    const laterality = f.quality === "LEFT_RIGHT_SYMMETRY" ? f.laterality : f.laterality === "L" || f.laterality === "R" ? f.laterality : null;
    const key = `${f.quality}|${laterality ?? ""}`;
    const g = map.get(key) ?? { quality: f.quality, parent_quality: f.parent_quality, laterality, findings: [] };
    g.findings.push(f);
    if (!g.parent_quality && f.parent_quality) g.parent_quality = f.parent_quality;
    map.set(key, g);
  }
  return [...map.values()];
}

function scoreGroup(g: Group, profile: ProfileInput, mode: ProgramMode): Omit<RankedPriority, "automatic_priority" | "practitioner_priority" | "effective_priority" | "override_reason" | "override_date" | "overridden_by" | "action" | "why" | "recommended_quality_work" | "client_line"> & { isolated: boolean; goalDriven: boolean } {
  const goal = goalRelevance(g.quality, profile, mode);
  const severity = maxOf(g.findings.map((f) => f.severity), SEV_ORD);
  const confidence = maxOf(g.findings.map((f) => f.confidence), CONF_ORD);
  const functional = maxOf(g.findings.map((f) => f.functional_relevance), FUNC_ORD);
  const trend = g.findings.some((f) => f.trend_status === "DECLINING")
    ? "DECLINING"
    : g.findings.some((f) => f.trend_status === "IMPROVING")
      ? "IMPROVING"
      : (g.findings[0]?.trend_status ?? "UNKNOWN");
  const sources = new Set(g.findings.map((f) => f.test_source));
  const cluster = g.findings.find((f) => f.cluster)?.cluster ?? null;
  const support = supportLevel(Math.max(sources.size, cluster ? g.findings[0]?.source_count ?? 1 : 1));
  const isolated = isolatedMildAsymmetry(g.findings) && g.quality === "LEFT_RIGHT_SYMMETRY";
  const goalDriven = mapsToPrimaryGoal(g.quality, profile.primary_goal);
  const worstAsym = Math.max(0, ...g.findings.map((f) => f.asymmetry_percent ?? 0));
  const asymW = worstAsym >= 20 ? ASYMMETRY_W.notable : worstAsym >= 10 ? ASYMMETRY_W.mild : ASYMMETRY_W.none;

  let score =
    SEVERITY_W[severity] +
    GOAL_W[goal] +
    FUNC_W[functional] +
    CONF_W[confidence] +
    SUPPORT_W[support] +
    TREND_W[trend as Trend] +
    asymW;

  if (goalDriven) score += PRIMARY_GOAL_BOOST;
  else if (mapsToSecondaryGoal(g.quality, profile.secondary_goals)) score += SECONDARY_GOAL_BOOST;
  else if (supportsPrimary(g.quality, profile.primary_goal)) score += SUPPORTS_PRIMARY_BOOST;

  if (isolated) score = Math.min(score, 5);
  if (cluster) score += 1;

  return {
    quality: g.quality,
    parent_quality: g.parent_quality,
    laterality: g.laterality,
    priority_score: score,
    severity,
    confidence,
    goal_relevance: goal,
    functional_relevance: functional,
    trend: trend as Trend,
    multi_test_support: support,
    cluster,
    finding_ids: g.findings.map((f) => f.finding_id),
    isolated,
    goalDriven,
  };
}

function mapLevel(opts: {
  score: number;
  severity: Severity;
  goal: RelevanceLevel;
  mode: ProgramMode;
  isolated: boolean;
  goalDriven: boolean;
  escalate: boolean;
}): PriorityLevel {
  if (opts.escalate) return "REVIEW_REQUIRED";
  if (opts.mode === "PERFORMANCE" && (opts.goal === "NONE" || opts.goal === "LOW")) {
    if (opts.severity === "HIGH" || opts.severity === "VERY_HIGH") return "P3_MONITOR";
    return "NOT_RELEVANT";
  }
  if (opts.goal === "NONE" && opts.severity === "NONE" && !opts.goalDriven) return "NOT_RELEVANT";
  if (opts.isolated) return "P3_MONITOR";
  if (opts.severity === "NONE" && !opts.goalDriven) {
    if (opts.mode === "PERFORMANCE" && (opts.goal === "HIGH" || opts.goal === "VERY_HIGH")) return "P2_SECONDARY";
    if (opts.goal !== "VERY_HIGH") return opts.goal === "NONE" ? "NOT_RELEVANT" : "MAINTAIN";
  }
  return levelFromScore(opts.score);
}

function seedGoalQualities(profile: ProfileInput, mode: ProgramMode, existing: Quality[]): Finding[] {
  const seeds: Quality[] = [];
  const consider: Quality[] = [
    "HYPERTROPHY",
    "AEROBIC_CAPACITY",
    "MAXIMAL_STRENGTH",
    "POWER",
    "SPEED_ACCELERATION",
    "BODY_COMPOSITION",
    "BALANCE",
    "GENERAL_ACTIVITY",
  ];
  for (const q of consider) {
    if (existing.includes(q)) continue;
    const rel = goalRelevance(q, profile, mode);
    if (rel === "VERY_HIGH" || mapsToPrimaryGoal(q, profile.primary_goal)) seeds.push(q);
  }
  return seeds.map((quality) => ({
    finding_id: `goal:${quality}`,
    quality,
    parent_quality: null,
    laterality: null,
    test_source: "GOAL_PROFILE",
    metric: "goal_driven",
    raw_value: null,
    normalised_value: null,
    reference_percentile: null,
    reference_category: null,
    left_value: null,
    right_value: null,
    asymmetry_percent: null,
    lower_side: null,
    severity: "NONE" as const,
    severity_confidence: "HIGH" as const,
    confidence: "HIGH" as const,
    functional_relevance: "LOW" as const,
    goal_relevance: goalRelevance(quality, profile, mode),
    trend_status: "UNKNOWN" as const,
    pain_associated: false,
    movement_limitation_associated: false,
    source_count: 1,
    supporting_findings: [],
    cluster: null,
    notes: "Included because of the client's goal, not because a test showed a deficit.",
    created_at: new Date().toISOString(),
  }));
}

export function runPriorityEngine(input: {
  profile: ProfileInput;
  effective: EffectiveClassification;
  findings: Finding[];
  overrides?: PriorityOverrides;
  overriddenBy?: string | null;
}): PriorityResult {
  const mode = input.profile.program_mode;
  const findings = clusterFindings(input.findings.map((f) => ({ ...f, goal_relevance: goalRelevance(f.quality, input.profile, mode) })));
  const seeded = seedGoalQualities(
    input.profile,
    mode,
    findings.map((f) => f.quality),
  );
  const all = [...findings, ...seeded];
  const groups = groupFindings(all);

  const priorities: RankedPriority[] = groups.map((g) => {
    const scored = scoreGroup(g, input.profile, mode);
    const escalate = concerningPain(g.findings, input.profile) && (g.findings.some((f) => f.pain_associated) || g.quality === "MOVEMENT_COMPETENCY");
    const automatic = mapLevel({
      score: scored.priority_score,
      severity: scored.severity,
      goal: scored.goal_relevance,
      mode,
      isolated: scored.isolated,
      goalDriven: scored.goalDriven,
      escalate,
    });
    const key = qualityKey(scored);
    const ov = input.overrides?.[key] ?? input.overrides?.[scored.quality];
    const effective = ov?.value ?? automatic;
    const { isolated, goalDriven, ...rest } = scored;
    return {
      ...rest,
      automatic_priority: automatic,
      practitioner_priority: ov?.value ?? null,
      effective_priority: effective,
      override_reason: ov?.reason ?? "",
      override_date: ov?.date ?? null,
      overridden_by: ov?.overridden_by ?? input.overriddenBy ?? null,
      action: actionFor(effective),
      why: whyLines({
        quality: rest.quality,
        findings: g.findings,
        goal: rest.goal_relevance,
        primary: input.profile.primary_goal,
        mode,
        severity: rest.severity,
        isolated,
        cluster: rest.cluster,
        goalDriven,
      }),
      recommended_quality_work: workLine(rest.quality, effective),
      client_line: clientLine(rest.quality, effective),
    };
  });

  const p1 = (q: Quality) => priorities.some((p) => p.quality === q && p.automatic_priority === "P1_PRIMARY");
  for (const p of priorities) {
    if (
      mode === "GENERAL_WELLNESS" &&
      (p.quality === "POWER" || p.quality === "RAPID_FORCE_PRODUCTION") &&
      p.automatic_priority === "P1_PRIMARY" &&
      !mapsToPrimaryGoal(p.quality, input.profile.primary_goal) &&
      p1("AEROBIC_CAPACITY") &&
      p1("LOWER_BODY_STRENGTH")
    ) {
      p.automatic_priority = "P2_SECONDARY";
      if (!p.practitioner_priority) p.effective_priority = "P2_SECONDARY";
      p.action = "improve";
      p.why.push("Meaningful deficit, held at P2 because aerobic capacity and lower-body strength already take primary emphasis.");
    }
    if (
      input.profile.primary_goal === "HYPERTROPHY" &&
      p.quality === "AEROBIC_CAPACITY" &&
      (p.severity === "NONE" || p.severity === "MILD") &&
      (p.automatic_priority === "P1_PRIMARY" || p.automatic_priority === "P2_SECONDARY")
    ) {
      p.automatic_priority = "P3_MONITOR";
      if (!p.practitioner_priority) p.effective_priority = "P3_MONITOR";
      p.action = "monitor";
      p.why.push("Mild aerobic finding does not override a hypertrophy primary goal.");
    }
  }

  const rank: Record<PriorityLevel, number> = {
    REVIEW_REQUIRED: 0,
    P1_PRIMARY: 1,
    P2_SECONDARY: 2,
    P3_MONITOR: 3,
    MAINTAIN: 4,
    NOT_RELEVANT: 5,
  };
  priorities.sort((a, b) => {
    const d = rank[a.effective_priority] - rank[b.effective_priority];
    if (d !== 0) return d;
    return b.priority_score - a.priority_score;
  });

  return {
    program_mode: mode,
    primary_goal: input.profile.primary_goal,
    findings: all,
    priorities,
    clusters: [...new Set(all.map((f) => f.cluster).filter((x): x is string => Boolean(x)))],
    weights_id: WEIGHTS_ID,
  };
}

export function applyPriorityOverrides(result: PriorityResult, overrides: PriorityOverrides, overriddenBy?: string | null): PriorityResult {
  const priorities = result.priorities.map((p) => {
    const ov = overrides[qualityKey(p)] ?? overrides[p.quality];
    if (!ov) return p;
    return {
      ...p,
      practitioner_priority: ov.value,
      effective_priority: ov.value,
      override_reason: ov.reason,
      override_date: ov.date,
      overridden_by: ov.overridden_by ?? overriddenBy ?? null,
      action: actionFor(ov.value),
      recommended_quality_work: workLine(p.quality, ov.value),
      client_line: clientLine(p.quality, ov.value),
    };
  });
  return { ...result, priorities };
}

export function groupedPriorities(priorities: RankedPriority[]) {
  const groups: Record<PriorityLevel, RankedPriority[]> = {
    P1_PRIMARY: [],
    P2_SECONDARY: [],
    P3_MONITOR: [],
    MAINTAIN: [],
    NOT_RELEVANT: [],
    REVIEW_REQUIRED: [],
  };
  for (const p of priorities) groups[p.effective_priority].push(p);
  return groups;
}

export function clientPriorityView(priorities: RankedPriority[]) {
  const improve = priorities.filter((p) => p.effective_priority === "P1_PRIMARY" || p.effective_priority === "P2_SECONDARY").map((p) => p.client_line).filter(Boolean);
  const strengths = priorities.filter((p) => p.effective_priority === "MAINTAIN").map((p) => qlabel(p.quality));
  return { improve, strengths };
}
