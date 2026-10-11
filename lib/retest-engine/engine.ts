/**
 * Layer 8 — compare assessments, classify change, suggest the next block.
 * Does not invent missing tests. Does not claim the program caused the change.
 */

import { qlabel } from "@/lib/priority-engine/types";
import { compareSnapshots, countStatuses } from "./compare";
import { detectNewFindings, nextBlock, outcomePriorities, programIssue, responseReview } from "./priorities";
import { clientSummary, commsDraft, implications, practitionerSummary, scorecard, stillToImprove, topImprovements } from "./summaries";
import { ENGINE_VERSION, WEIGHTS_ID } from "./weights";
import type { AssessmentSnapshot, BodyMaps, BodyRegion, ChangeStatus, LongitudinalSeries, MetricChange, RetestInput, RetestResult } from "./types";

export function analyseRetest(input: RetestInput): RetestResult {
  const vs_previous = compareSnapshots(input.current, input.previous);
  const vs_baseline =
    input.baseline && input.baseline.session_id !== input.previous?.session_id
      ? compareSnapshots(input.current, input.baseline)
      : input.baseline
        ? vs_previous
        : [];
  const comparable = vs_previous.filter((r) => r.current_value != null && r.previous_value != null);
  const outcomes = outcomePriorities(input.previous_priorities, vs_previous, input.current_findings);
  const fresh = detectNewFindings(input.current_priorities, input.previous_priorities, vs_previous);
  const next = nextBlock(input.current_priorities, outcomes, fresh);
  const tops = topImprovements(comparable);
  const issue = programIssue(input.adherence_percent, outcomes);
  const flags: string[] = [];
  if (!input.previous) flags.push("NO_PREVIOUS_ASSESSMENT");
  if (input.current.domains_missing.length) flags.push(`NOT_RETESTED:${input.current.domains_missing.join(",")}`);
  if (input.contextual_change) flags.push("CONTEXTUAL_CHANGE");
  if (issue !== "NONE") flags.push(issue);
  if (outcomes.some((o) => o.previous_level === "P1_PRIMARY" && o.outcome === "UNCHANGED" && issue === "PROGRAM_RESPONSE_ISSUE")) {
    flags.push("RESPONSE_BELOW_EXPECTATION");
  }
  if (input.goals_still_current === false) flags.push("GOALS_NEED_UPDATE");
  if (input.goals_still_current == null) flags.push("CONFIRM_GOALS");

  const p1 = next.filter((n) => n.level === "P1_PRIMARY").map((n) => qlabel(n.quality).toLowerCase());

  return {
    current_session_id: input.current.session_id,
    compare_session_id: input.previous?.session_id ?? null,
    baseline_session_id: input.baseline?.session_id ?? null,
    compare_label: input.previous
      ? `${formatType(input.current.assessment_type)} vs ${formatType(input.previous.assessment_type)}`
      : "No previous assessment",
    counts: countStatuses(vs_previous),
    vs_previous,
    vs_baseline,
    top_improvements: tops,
    still_to_improve: stillToImprove(comparable, outcomes),
    priority_outcomes: outcomes,
    new_findings: fresh,
    next_block: next,
    implications: implications(outcomes, tops),
    scorecard: scorecard(outcomes, input.adherence_percent, input.training_stage),
    program_issue: issue,
    response_review: responseReview(outcomes),
    body_maps: bodyMaps(input.previous, input.current, vs_previous),
    series: seriesFrom(input.history),
    practitioner_summary: practitionerSummary(input, outcomes, tops, issue),
    client_summary: clientSummary(input, outcomes, tops),
    comms_draft: commsDraft(input, tops, p1),
    flags,
    weights_id: WEIGHTS_ID,
    engine_version: ENGINE_VERSION,
  };
}

function formatType(t: string) {
  if (t === "baseline") return "Baseline";
  if (t === "twelve_week_retest") return "12-week retest";
  if (t === "follow_up") return "Follow-up";
  if (t === "partial") return "Partial / interim";
  return t.replaceAll("_", " ");
}

function heatFromPercentile(p: number | null, asymmetry: number | null): number | null {
  if (p != null) return Math.max(0, Math.min(1, p / 100));
  if (asymmetry != null) return Math.max(0, Math.min(1, 1 - asymmetry / 30));
  return null;
}

function region(id: string, label: string, heat: number | null, change: ChangeStatus | null): BodyRegion {
  return { id, label, heat, change };
}

function pickChange(rows: MetricChange[], pred: (r: MetricChange) => boolean): ChangeStatus | null {
  const hit = rows.find(pred);
  return hit && hit.previous_value != null && hit.current_value != null ? hit.change_status : null;
}

function bodyMaps(prev: AssessmentSnapshot | null, curr: AssessmentSnapshot, changes: MetricChange[]): BodyMaps {
  const layer = (snap: AssessmentSnapshot | null, domain: "STRENGTH" | "SYMMETRY" | "MOBILITY") => {
    const ms = snap?.metrics.filter((m) => m.domain === domain) ?? [];
    const kneeL = ms.find((m) => /KNEE_EXTENSION:left|knee extension — left/i.test(m.key + m.label));
    const kneeR = ms.find((m) => /KNEE_EXTENSION:right|knee extension — right/i.test(m.key + m.label));
    const hipL = ms.find((m) => /HIP_ABDUCTION:left|hip/i.test(m.key) && m.side === "L");
    const hipR = ms.find((m) => /HIP_ABDUCTION:right|hip/i.test(m.key) && m.side === "R");
    const ankleL = ms.find((m) => /KNEE_TO_WALL:left/.test(m.key));
    const ankleR = ms.find((m) => /KNEE_TO_WALL:right/.test(m.key));
    const gripL = ms.find((m) => m.key === "GRIP_STRENGTH:left");
    const gripR = ms.find((m) => m.key === "GRIP_STRENGTH:right");
    const heat = (m?: { percentile: number | null; value: number; domain: string }) =>
      m ? heatFromPercentile(m.percentile, m.domain === "SYMMETRY" ? m.value : null) : null;
    return [
      region("left_knee", "Left knee", heat(kneeL), pickChange(changes, (c) => c.key === "ISO_KNEE_EXTENSION:left")),
      region("right_knee", "Right knee", heat(kneeR), pickChange(changes, (c) => c.key === "ISO_KNEE_EXTENSION:right")),
      region("left_hip", "Left hip", heat(hipL), pickChange(changes, (c) => c.key.includes("HIP") && c.key.endsWith(":left"))),
      region("right_hip", "Right hip", heat(hipR), pickChange(changes, (c) => c.key.includes("HIP") && c.key.endsWith(":right"))),
      region("left_ankle", "Left ankle", heat(ankleL), pickChange(changes, (c) => c.key === "MOBILITY_KNEE_TO_WALL:left")),
      region("right_ankle", "Right ankle", heat(ankleR), pickChange(changes, (c) => c.key === "MOBILITY_KNEE_TO_WALL:right")),
      region("left_grip", "Left grip", heat(gripL), pickChange(changes, (c) => c.key === "GRIP_STRENGTH:left")),
      region("right_grip", "Right grip", heat(gripR), pickChange(changes, (c) => c.key === "GRIP_STRENGTH:right")),
    ];
  };
  return {
    strength: { previous: layer(prev, "STRENGTH"), current: layer(curr, "STRENGTH") },
    symmetry: { previous: layer(prev, "SYMMETRY"), current: layer(curr, "SYMMETRY") },
    mobility: { previous: layer(prev, "MOBILITY"), current: layer(curr, "MOBILITY") },
  };
}

function seriesFrom(history: AssessmentSnapshot[]): LongitudinalSeries[] {
  const keys = [
    { key: "FORCE_PLATE_IMTP:peak_force", label: "Peak force" },
    { key: "ISO_KNEE_EXTENSION:left", label: "Knee extension — left" },
    { key: "ISO_KNEE_EXTENSION:right", label: "Knee extension — right" },
    { key: "ISO_KNEE_EXTENSION:asymmetry", label: "Knee-extension asymmetry" },
    { key: "GRIP_STRENGTH:left", label: "Grip — left" },
    { key: "GRIP_STRENGTH:right", label: "Grip — right" },
  ];
  return keys
    .map((k) => {
      const points = history
        .map((s) => {
          const m = s.metrics.find((x) => x.key === k.key);
          if (!m) return null;
          return { date: s.assessment_date, assessment_id: s.session_id, assessment_type: s.assessment_type, value: m.value, unit: m.unit };
        })
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      return { key: k.key, label: k.label, unit: points[0]?.unit ?? "", points };
    })
    .filter((s) => s.points.length >= 1);
}

export { comparePair, protocolCompatibility } from "./compare";
export { flattenSnapshot } from "./metrics";
