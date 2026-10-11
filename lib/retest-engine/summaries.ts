import { qlabel } from "@/lib/priority-engine/types";
import { CHANGE } from "./weights";
import type { Implication, MetricChange, PriorityOutcomeRow, ProgramIssue, RetestInput, Scorecard } from "./types";

const BANNED = /\b(failed|bad|abnormal|the program caused|caused a \d)/i;

export function topImprovements(rows: MetricChange[]) {
  return rows
    .filter((r) => r.change_status === "IMPROVED" && r.current_value != null && r.previous_value != null)
    .filter((r) => !r.both_sides_declined)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 5);
}

export function stillToImprove(rows: MetricChange[], outcomes: PriorityOutcomeRow[]) {
  const remain = new Set(
    outcomes.filter((o) => o.outcome === "IMPROVED_BUT_REMAINS" || o.outcome === "UNCHANGED" || o.outcome === "WORSENED").map((o) => o.quality),
  );
  return rows
    .filter((r) => r.current_value != null && remain.has(r.quality) && (r.change_status === "DECLINED" || r.change_status === "STABLE" || r.change_status === "IMPROVED"))
    .filter((r) => r.domain !== "SYMMETRY" || (r.current_value != null && r.current_value > CHANGE.symmetry_resolved_percent))
    .slice(0, 6);
}

function score(r: MetricChange) {
  const mag = r.domain === "SYMMETRY" ? Math.abs(r.absolute_change ?? 0) : Math.abs(r.percentage_change ?? 0);
  const conf = r.change_confidence === "HIGH" ? 3 : r.change_confidence === "MODERATE" ? 2 : 1;
  const domain = r.domain === "STRENGTH" || r.domain === "POWER" || r.domain === "AEROBIC" ? 2 : r.domain === "SYMMETRY" ? 1.5 : 1;
  return mag * conf * domain;
}

export function implications(outcomes: PriorityOutcomeRow[], tops: MetricChange[]): Implication[] {
  const out: Implication[] = [];
  for (const o of outcomes) {
    if (o.outcome === "RESOLVED") {
      out.push({
        finding: qlabel(o.quality),
        change: `${o.previous_level} → MAINTAIN`,
        implication: "Reduce dedicated priority volume. Keep enough work to preserve the gain.",
      });
    } else if (o.outcome === "WORSENED" && o.previous_level === "MAINTAIN") {
      out.push({
        finding: qlabel(o.quality),
        change: "Previously maintained quality declined",
        implication: `Promote toward ${o.suggested_level.replaceAll("_", " ")} if the change is reliable.`,
      });
    } else if (o.outcome === "IMPROVED_BUT_REMAINS") {
      out.push({
        finding: qlabel(o.quality),
        change: "Improved but remains a priority",
        implication: "Keep it in the next block. Do not rotate it out for novelty.",
      });
    }
  }
  for (const t of tops.filter((x) => x.domain === "SYMMETRY" && !x.both_sides_declined)) {
    out.push({
      finding: t.label,
      change: t.client_line,
      implication: t.programming_implication,
    });
  }
  return out.slice(0, 8);
}

export function practitionerSummary(input: RetestInput, outcomes: PriorityOutcomeRow[], tops: MetricChange[], issue: ProgramIssue) {
  const name = input.first_name || "The client";
  const improved = tops.slice(0, 3).map((t) => t.label.toLowerCase());
  const remains = outcomes.filter((o) => o.outcome === "IMPROVED_BUT_REMAINS" || o.outcome === "UNCHANGED").map((o) => qlabel(o.quality).toLowerCase());
  const bits: string[] = [];
  bits.push(
    improved.length
      ? `Over this block, ${name} showed meaningful change in ${join(improved)}.`
      : `Over this block, ${name} did not show a clear improvement that exceeds conservative measurement noise.`,
  );
  const detail = tops[0];
  if (detail?.percentage_change != null && detail.domain !== "SYMMETRY") {
    bits.push(`${detail.label} moved from ${fmt(detail.previous_value)} to ${fmt(detail.current_value)} ${detail.unit} (${signed(detail.percentage_change)}%).`);
  }
  const asym = tops.find((t) => t.domain === "SYMMETRY");
  if (asym && asym.previous_value != null && asym.current_value != null) {
    bits.push(
      asym.both_sides_declined
        ? `${asym.label} narrowed numerically, although both sides also produced less force.`
        : `Side-to-side difference on ${asym.label.replace(" asymmetry", "")} reduced from ${fmt(asym.previous_value)}% to ${fmt(asym.current_value)}%.`,
    );
  }
  if (remains.length) bits.push(`${cap(join(remains))} ${remains.length === 1 ? "remains" : "remain"} a priority for the next block.`);
  if (issue === "PROGRAM_ADHERENCE_ISSUE") {
    bits.push(`Limited change is difficult to interpret because training adherence was ${(input.adherence_percent! * 100).toFixed(0)}%. This is not evidence that the program failed.`);
  }
  if (issue === "PROGRAM_RESPONSE_ISSUE") {
    bits.push(`Adherence was high (${(input.adherence_percent! * 100).toFixed(0)}%) while a primary quality did not change meaningfully — review dose, exercise selection, and recovery rather than repeating the same block unchanged.`);
  }
  if (input.contextual_change) bits.push(`Context noted: ${input.contextual_change}. Outcomes should be read with that in mind.`);
  const text = bits.join(" ");
  return BANNED.test(text) ? text.replace(BANNED, "changed") : text;
}

export function clientSummary(input: RetestInput, outcomes: PriorityOutcomeRow[], tops: MetricChange[]) {
  const name = input.first_name || "You";
  const wins = tops.slice(0, 3).map((t) => t.client_line);
  const remain = outcomes.filter((o) => o.outcome === "IMPROVED_BUT_REMAINS" || o.outcome === "UNCHANGED" || o.outcome === "WORSENED");
  const parts: string[] = [];
  if (wins.length) parts.push(`${name}, your latest assessment shows progress. ${wins.join(" ")}`);
  else parts.push(`${name}, several results were maintained since the last assessment.`);
  if (remain[0]) parts.push(`${qlabel(remain[0].quality)} is still a priority for the next block.`);
  const text = parts.join(" ");
  return /failed|bad|abnormal/i.test(text) ? text.replace(/failed|bad|abnormal/gi, "still a priority") : text;
}

export function commsDraft(input: RetestInput, tops: MetricChange[], nextP1: string[]) {
  if (!tops.length && !nextP1.length) return null;
  const name = input.first_name || "there";
  const areas = tops.slice(0, 3).map((t) => t.label.toLowerCase());
  const next = nextP1.length ? ` Your next block will put more emphasis on ${join(nextP1)} while maintaining the gains you've made.` : "";
  return `Hey ${name}, your new assessment is complete.${areas.length ? ` You've made clear improvements in ${join(areas)}.` : ""}${next}`;
}

export function scorecard(outcomes: PriorityOutcomeRow[], adherence: number | null, stage: RetestInput["training_stage"]): Scorecard {
  const watched = outcomes.filter((o) => o.previous_level !== "NOT_RELEVANT");
  const resolved = watched.filter((o) => o.outcome === "RESOLVED" || o.outcome === "SUCCESSFUL_MAINTENANCE").length;
  const improved = watched.filter((o) => o.outcome === "RESOLVED" || o.outcome === "IMPROVED_BUT_REMAINS" || o.outcome === "SUCCESSFUL_MAINTENANCE").length;
  const suggested =
    stage === "FOUNDATION" && resolved >= 1 && (adherence == null || adherence >= CHANGE.adherence_high) ? "DEVELOPMENT" : null;
  return {
    priorities_resolved: resolved,
    priorities_total: watched.length,
    priorities_improved: improved,
    adherence_percent: adherence,
    training_stage: stage,
    suggested_stage: suggested,
  };
}

function join(xs: string[]) {
  if (xs.length <= 1) return xs[0] ?? "";
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`;
}

function cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function fmt(n: number | null) {
  if (n == null) return "—";
  return Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(1);
}

function signed(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
}
