import type { Finding, PriorityLevel, Quality, RankedPriority } from "@/lib/priority-engine/types";
import { qualityKey } from "@/lib/priority-engine/types";
import { CHANGE } from "./weights";
import type { MetricChange, NewFinding, NextBlockItem, PriorityOutcome, PriorityOutcomeRow, ProgramIssue, ResponseLabel } from "./types";

const ACTIVE: PriorityLevel[] = ["P1_PRIMARY", "P2_SECONDARY", "P3_MONITOR"];
const TRAINED: PriorityLevel[] = ["P1_PRIMARY", "P2_SECONDARY", "P3_MONITOR", "MAINTAIN"];

function related(changes: MetricChange[], p: RankedPriority) {
  return changes.filter((c) => {
    if (c.change_status === "NOT_COMPARABLE" && (c.previous_value == null || c.current_value == null)) return false;
    if (c.quality === p.quality) return true;
    if (p.quality === "LEFT_RIGHT_SYMMETRY" && c.domain === "SYMMETRY") return true;
    if (p.parent_quality && c.quality === p.parent_quality) return true;
    if (c.quality === "LEFT_RIGHT_SYMMETRY" && p.quality !== "LEFT_RIGHT_SYMMETRY" && c.family.toLowerCase().includes(p.quality.split("_")[0].toLowerCase())) {
      return true;
    }
    return false;
  });
}

function siblingsPoor(findings: Finding[], quality: Quality) {
  return findings.some(
    (f) =>
      (f.quality === quality || f.parent_quality === quality) &&
      (f.severity === "HIGH" || f.severity === "VERY_HIGH" || (f.severity === "MODERATE" && f.confidence !== "LOW")),
  );
}

export function outcomePriorities(
  previous: RankedPriority[],
  changes: MetricChange[],
  currentFindings: Finding[],
): PriorityOutcomeRow[] {
  const watched = previous.filter((p) => TRAINED.includes(p.effective_priority) && p.effective_priority !== "NOT_RELEVANT");
  return watched.map((p) => {
    const rel = related(changes, p);
    const comparable = rel.filter((c) => c.change_status !== "NOT_COMPARABLE");
    if (!comparable.length) {
      return row(p, "INSUFFICIENT_DATA", p.effective_priority, ["No matched retest for this quality."], []);
    }
    const improved = comparable.filter((c) => c.change_status === "IMPROVED");
    const declined = comparable.filter((c) => c.change_status === "DECLINED");
    const resolved = canResolve(p, comparable, currentFindings);

    if (p.effective_priority === "MAINTAIN" && declined.length === 0 && improved.length === 0) {
      return row(p, "SUCCESSFUL_MAINTENANCE", "MAINTAIN", ["Held a previously strong quality. That is a successful outcome, not missing progress."], comparable.map((c) => c.key));
    }
    if (resolved) {
      return row(p, "RESOLVED", "MAINTAIN", whyResolved(p, comparable), comparable.map((c) => c.key));
    }
    if (declined.length && declined.length >= improved.length) {
      const next: PriorityLevel = p.effective_priority === "MAINTAIN" ? "P2_SECONDARY" : p.effective_priority;
      return row(p, "WORSENED", next, [`${declined[0].label} declined. ${declined[0].interpretation}`], comparable.map((c) => c.key));
    }
    if (improved.length) {
      return row(p, "IMPROVED_BUT_REMAINS", p.effective_priority, [`Improved (${improved.map((c) => c.label).join(", ")}) but related findings are not yet in a maintenance range.`], comparable.map((c) => c.key));
    }
    return row(p, "UNCHANGED", p.effective_priority, ["No meaningful change on the matched metrics."], comparable.map((c) => c.key));
  });
}

function canResolve(p: RankedPriority, rel: MetricChange[], findings: Finding[]) {
  const strength = rel.filter((c) => c.domain === "STRENGTH" || c.domain === "MOBILITY" || c.domain === "POWER" || c.domain === "AEROBIC");
  const symmetry = rel.filter((c) => c.domain === "SYMMETRY");
  const goodPct = strength.some((c) => c.current_percentile != null && c.current_percentile >= CHANGE.percentile_satisfactory);
  const pctBorderline = strength.some((c) => c.current_percentile != null && c.current_percentile < CHANGE.percentile_satisfactory && c.current_percentile >= CHANGE.borderline_percentile);
  const symmetryOk = symmetry.length
    ? symmetry.every((c) => c.current_value != null && c.current_value <= CHANGE.symmetry_resolved_percent && !c.both_sides_declined)
    : p.quality !== "LEFT_RIGHT_SYMMETRY";
  if (p.quality === "LEFT_RIGHT_SYMMETRY") {
    return symmetryOk && symmetry.some((c) => c.change_status === "IMPROVED" || (c.current_value != null && c.current_value <= CHANGE.symmetry_resolved_percent));
  }
  if (pctBorderline && siblingsPoor(findings, p.quality)) return false;
  if (goodPct && symmetryOk && !siblingsPoor(findings, p.quality)) return true;
  return false;
}

function whyResolved(p: RankedPriority, rel: MetricChange[]) {
  const why = [`${p.quality.replaceAll("_", " ")} no longer needs aggressive priority volume.`];
  for (const c of rel) {
    if (c.current_percentile != null && c.previous_percentile != null) {
      why.push(`${c.label} reference position ${fmt(c.previous_percentile)}th → ${fmt(c.current_percentile)}th percentile.`);
    }
    if (c.domain === "SYMMETRY" && c.previous_value != null && c.current_value != null) {
      why.push(`Asymmetry ${fmt(c.previous_value)}% → ${fmt(c.current_value)}%.`);
    }
  }
  why.push("Keep enough work to preserve the gain.");
  return why;
}

function row(p: RankedPriority, outcome: PriorityOutcome, suggested: PriorityLevel, why: string[], keys: string[]): PriorityOutcomeRow {
  return {
    quality: p.quality,
    laterality: p.laterality,
    previous_level: p.effective_priority,
    suggested_level: suggested,
    outcome,
    why,
    related_keys: keys,
  };
}

export function detectNewFindings(current: RankedPriority[], previous: RankedPriority[], changes: MetricChange[]): NewFinding[] {
  const prevKeys = new Set(previous.filter((p) => ACTIVE.includes(p.effective_priority)).map(qualityKey));
  const out: NewFinding[] = [];
  for (const p of current.filter((x) => ACTIVE.includes(x.effective_priority))) {
    if (prevKeys.has(qualityKey(p))) continue;
    if (p.trend === "NEW_FINDING" || p.trend === "DECLINING") {
      out.push({
        quality: p.quality,
        reason: p.why[0] ?? "Appeared on the current assessment and was not a previous training priority.",
        suggested_level: p.effective_priority,
      });
    }
  }
  for (const c of changes) {
    if (c.change_status !== "DECLINED") continue;
    if (c.previous_percentile != null && c.previous_percentile >= CHANGE.percentile_strong && c.current_percentile != null && c.current_percentile <= CHANGE.percentile_satisfactory - 5) {
      if (!out.some((n) => n.quality === c.quality)) {
        out.push({
          quality: c.quality,
          reason: `${c.label} dropped from the ${fmt(c.previous_percentile)}th to the ${fmt(c.current_percentile)}th percentile.`,
          suggested_level: "P2_SECONDARY",
        });
      }
    }
  }
  return out;
}

export function nextBlock(
  current: RankedPriority[],
  outcomes: PriorityOutcomeRow[],
  fresh: NewFinding[],
): NextBlockItem[] {
  const items: NextBlockItem[] = [];
  const seen = new Set<string>();
  const push = (q: Quality, laterality: RankedPriority["laterality"], level: PriorityLevel, source: NextBlockItem["source"], why: string[]) => {
    const k = `${q}:${laterality ?? ""}:${level}`;
    if (seen.has(`${q}:${laterality ?? ""}`)) return;
    seen.add(`${q}:${laterality ?? ""}`);
    items.push({ quality: q, laterality, level, source, why });
    void k;
  };

  for (const o of outcomes) {
    if (o.outcome === "RESOLVED" || o.outcome === "SUCCESSFUL_MAINTENANCE") {
      push(o.quality, o.laterality, "MAINTAIN", "MAINTAIN", o.why);
    } else if (o.outcome === "WORSENED" && o.previous_level === "MAINTAIN") {
      push(o.quality, o.laterality, o.suggested_level, "LAYER_8_TRANSITION", o.why);
    }
  }
  for (const n of fresh) {
    push(n.quality, null, n.suggested_level, "NEW_FINDING", [n.reason]);
  }
  for (const p of current.filter((x) => ACTIVE.includes(x.effective_priority) || x.effective_priority === "MAINTAIN")) {
    const outcome = outcomes.find((o) => o.quality === p.quality && o.laterality === p.laterality);
    if (outcome && (outcome.outcome === "RESOLVED" || outcome.outcome === "SUCCESSFUL_MAINTENANCE")) continue;
    push(p.quality, p.laterality, outcome?.suggested_level ?? p.effective_priority, "CURRENT_LAYER_2", p.why.slice(0, 2));
  }
  const rank: Record<PriorityLevel, number> = {
    P1_PRIMARY: 0,
    P2_SECONDARY: 1,
    P3_MONITOR: 2,
    MAINTAIN: 3,
    REVIEW_REQUIRED: 4,
    NOT_RELEVANT: 5,
  };
  return items.sort((a, b) => rank[a.level] - rank[b.level]);
}

export function programIssue(adherence: number | null, outcomes: PriorityOutcomeRow[]): ProgramIssue {
  const p1 = outcomes.filter((o) => o.previous_level === "P1_PRIMARY");
  const stuck = p1.filter((o) => o.outcome === "UNCHANGED" || o.outcome === "WORSENED" || o.outcome === "INSUFFICIENT_DATA");
  if (!p1.length || !stuck.length) return "NONE";
  if (adherence != null && adherence < CHANGE.adherence_low) return "PROGRAM_ADHERENCE_ISSUE";
  if (adherence != null && adherence >= CHANGE.adherence_high) return "PROGRAM_RESPONSE_ISSUE";
  return "NONE";
}

export function responseReview(outcomes: PriorityOutcomeRow[]): { quality: Quality; label: ResponseLabel; note: string }[] {
  return outcomes.map((o) => {
    if (o.outcome === "INSUFFICIENT_DATA") return { quality: o.quality, label: "UNINTERPRETABLE" as const, note: "Not enough matched retest data." };
    if (o.outcome === "SUCCESSFUL_MAINTENANCE") return { quality: o.quality, label: "MAINTAINED" as const, note: "Held on purpose." };
    if (o.outcome === "RESOLVED" || o.outcome === "IMPROVED_BUT_REMAINS") {
      return { quality: o.quality, label: o.outcome === "RESOLVED" ? "HIGH_RESPONSE" : "MODERATE_RESPONSE", note: o.why[0] ?? "" };
    }
    if (o.outcome === "WORSENED" || o.outcome === "UNCHANGED") return { quality: o.quality, label: "LOW_RESPONSE" as const, note: o.why[0] ?? "" };
    return { quality: o.quality, label: "UNINTERPRETABLE" as const, note: o.why[0] ?? "" };
  });
}

function fmt(n: number) {
  return Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(1);
}
