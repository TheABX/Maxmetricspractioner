import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Finding, RankedPriority } from "../lib/priority-engine/types";
import { analyseRetest, comparePair, flattenSnapshot } from "../lib/retest-engine/engine";
import type { AssessmentSnapshot, RetestInput, SnapshotMetric } from "../lib/retest-engine/types";

function fail(msg: string): never {
  console.error("FAIL", msg);
  process.exit(1);
}

function iso(left: number, right: number, extra: { position?: string; leftP?: number; rightP?: number; type?: string } = {}) {
  return flattenSnapshot({
    session_id: extra.type === "now" ? "curr" : "prev",
    assessment_date: extra.type === "now" ? "2026-12-10" : "2026-09-12",
    assessment_type: extra.type === "now" ? "twelve_week_retest" : "baseline",
    bodyweight_kg: 80,
    isometric: [
      {
        test_type: "ISO_KNEE_EXTENSION",
        best_left_peak_force: left,
        best_right_peak_force: right,
        best_bilateral_peak_force: null,
        asymmetry_percent: (Math.abs(left - right) / Math.max(left, right)) * 100,
        left_percentile: extra.leftP ?? null,
        right_percentile: extra.rightP ?? null,
        protocol: {
          protocol_id: "ISO_KNEE_EXTENSION",
          protocol_version: "v1",
          equipment: "chair",
          body_position: extra.position ?? "seated_90_60",
          unit: "kg",
          trial_selection: "best",
          processing: "isometric_v1",
        },
      },
    ],
    forcePlate: [
      {
        test_type: "FORCE_PLATE_IMTP",
        peak_force_kg: extra.type === "now" ? 177.8 : 161.2,
        relative_peak_force: extra.type === "now" ? 177.8 / 80 : 161.2 / 80,
        force_200ms_kg: extra.type === "now" ? 70 : 68,
        peak_force_asymmetry_percent: extra.type === "now" ? 7.1 : 16.6,
      },
    ],
    mobility: [],
  });
}

function pri(quality: RankedPriority["quality"], level: RankedPriority["effective_priority"], extra: Partial<RankedPriority> = {}): RankedPriority {
  return {
    quality,
    parent_quality: quality.includes("KNEE") ? "LOWER_BODY_STRENGTH" : null,
    laterality: null,
    automatic_priority: level,
    practitioner_priority: null,
    effective_priority: level,
    override_reason: "",
    override_date: null,
    overridden_by: null,
    priority_score: 0,
    severity: "MODERATE",
    confidence: "MODERATE",
    goal_relevance: "HIGH",
    functional_relevance: "HIGH",
    trend: "UNKNOWN",
    multi_test_support: "NONE",
    cluster: null,
    action: "improve",
    why: ["Prior block priority."],
    recommended_quality_work: "",
    client_line: "",
    finding_ids: [],
    ...extra,
  };
}

function input(curr: AssessmentSnapshot, prev: AssessmentSnapshot, extras: Partial<RetestInput> = {}): RetestInput {
  return {
    first_name: "Sam",
    current: curr,
    previous: prev,
    baseline: prev,
    history: [prev, curr],
    previous_priorities: extras.previous_priorities ?? [pri("KNEE_EXTENSOR_STRENGTH", "P1_PRIMARY"), pri("LEFT_RIGHT_SYMMETRY", "P2_SECONDARY")],
    current_priorities: extras.current_priorities ?? [pri("KNEE_EXTENSOR_STRENGTH", "P2_SECONDARY"), pri("POWER", "P1_PRIMARY")],
    current_findings: extras.current_findings ?? [],
    previous_findings: [],
    adherence_percent: extras.adherence_percent ?? 0.91,
    training_stage: extras.training_stage ?? "FOUNDATION",
    primary_goal: "GENERAL_HEALTH_LONGEVITY",
    goals_still_current: extras.goals_still_current ?? true,
    contextual_change: extras.contextual_change ?? null,
  };
}

const prev = iso(43.1, 51.7, { type: "then", leftP: 40, rightP: 55 });
const curr = iso(49.0, 52.5, { type: "now", leftP: 55, rightP: 60 });
const peak = curr.metrics.find((m) => m.key === "FORCE_PLATE_IMTP:peak_force")!;
const peakPrev = prev.metrics.find((m) => m.key === "FORCE_PLATE_IMTP:peak_force")!;
const peakChange = comparePair(peakPrev, peak);
if (Math.abs((peakChange.absolute_change ?? 0) - 16.6) > 0.05) fail(`peak abs ${peakChange.absolute_change}`);
if (Math.abs((peakChange.percentage_change ?? 0) - 10.3) > 0.2) fail(`peak pct ${peakChange.percentage_change}`);
if (peakChange.change_status !== "IMPROVED") fail(`peak should improve, got ${peakChange.change_status}`);
if (peakChange.direction !== "UP") fail("higher peak force is UP");

const asym = comparePair(prev.metrics.find((m) => m.key === "FORCE_PLATE_IMTP:asymmetry")!, curr.metrics.find((m) => m.key === "FORCE_PLATE_IMTP:asymmetry")!);
if (asym.change_status !== "IMPROVED") fail(`asymmetry 16.6→7.1 should improve, got ${asym.change_status}`);
if (!/16\.6% to 7\.1%/.test(asym.client_line)) fail(`asymmetry client line: ${asym.client_line}`);

const weakPrev = flattenSnapshot({
  session_id: "a",
  assessment_date: "2026-09-12",
  assessment_type: "baseline",
  bodyweight_kg: 80,
  isometric: [{ test_type: "ISO_KNEE_EXTENSION", best_left_peak_force: 40, best_right_peak_force: 50, best_bilateral_peak_force: null, asymmetry_percent: 20 }],
  forcePlate: [],
  mobility: [],
});
const weakCurr = flattenSnapshot({
  session_id: "b",
  assessment_date: "2026-12-10",
  assessment_type: "twelve_week_retest",
  bodyweight_kg: 80,
  isometric: [{ test_type: "ISO_KNEE_EXTENSION", best_left_peak_force: 30, best_right_peak_force: 35, best_bilateral_peak_force: null, asymmetry_percent: 14.2857 }],
  forcePlate: [],
  mobility: [],
});
const weakAsym = comparePair(weakPrev.metrics.find((m) => m.key.endsWith(":asymmetry"))!, weakCurr.metrics.find((m) => m.key.endsWith(":asymmetry"))!);
if (!weakAsym.both_sides_declined) fail("both sides weaker must be flagged");
if (!/overall force capacity also declined/i.test(weakAsym.interpretation)) fail(weakAsym.interpretation);
if (/resolved/.test(weakAsym.programming_implication.toLowerCase()) && /do not/.test(weakAsym.programming_implication.toLowerCase()) === false) {
  fail("must not treat weaker-both-sides symmetry as a clean resolve");
}

const tiny = comparePair(
  { ...peakPrev, value: 100 },
  { ...peak, value: 102 },
);
if (tiny.change_status !== "STABLE") fail(`2% peak change is noise, got ${tiny.change_status}`);

const worseAsym = comparePair(
  { ...asym, value: 7, key: "x", family: "ISO_KNEE_EXTENSION", label: "asym", quality: "LEFT_RIGHT_SYMMETRY", domain: "SYMMETRY", unit: "%", favourable: "LOWER", percentile: null, category: null, side: "ASYMMETRY", left_value: 50, right_value: 54, protocol: peak.protocol, noisy: false, bodyweight_kg: 80, relative_value: null } as SnapshotMetric,
  { ...asym, value: 16, key: "x", family: "ISO_KNEE_EXTENSION", label: "asym", quality: "LEFT_RIGHT_SYMMETRY", domain: "SYMMETRY", unit: "%", favourable: "LOWER", percentile: null, category: null, side: "ASYMMETRY", left_value: 50, right_value: 60, protocol: peak.protocol, noisy: false, bodyweight_kg: 80, relative_value: null } as SnapshotMetric,
);
if (worseAsym.change_status !== "DECLINED") fail("higher asymmetry is not improvement");

const posPrev = iso(43, 50, { position: "seated_90_60" });
const posCurr = iso(49, 52, { type: "now", position: "prone_different" });
const pos = comparePair(posPrev.metrics.find((m) => m.key === "ISO_KNEE_EXTENSION:left")!, posCurr.metrics.find((m) => m.key === "ISO_KNEE_EXTENSION:left")!);
if (pos.protocol_compatibility === "COMPATIBLE") fail("different position must not be fully compatible");

const result = analyseRetest(input(curr, prev));
const left = result.vs_previous.find((m) => m.key === "ISO_KNEE_EXTENSION:left");
if (!left || left.percentile_change == null) fail("left knee should have percentile change");
if (Math.abs(left.percentile_change - 15) > 0.1) fail(`percentile points ${left.percentile_change}`);
if (/19% improvement|15% improvement/.test(left.interpretation)) fail("must not call percentile-point change a % improvement");
if (!/percentile points/.test(left.interpretation)) fail(left.interpretation);

if (/the program caused/i.test(result.practitioner_summary + result.client_summary)) fail("no causal over-claim");
if (/failed|abnormal/i.test(result.client_summary)) fail("client language");

const lowAdh = analyseRetest(
  input(prev, prev, {
    adherence_percent: 0.55,
    previous_priorities: [pri("LOWER_BODY_STRENGTH", "P1_PRIMARY")],
    current_priorities: [pri("LOWER_BODY_STRENGTH", "P1_PRIMARY")],
  }),
);
if (lowAdh.program_issue !== "PROGRAM_ADHERENCE_ISSUE") fail(`low adherence should be adherence issue, got ${lowAdh.program_issue}`);
if (!/difficult to interpret/i.test(lowAdh.practitioner_summary)) fail(lowAdh.practitioner_summary);

const highAdh = analyseRetest(
  input(prev, prev, {
    adherence_percent: 0.94,
    previous_priorities: [pri("LOWER_BODY_STRENGTH", "P1_PRIMARY")],
    current_priorities: [pri("LOWER_BODY_STRENGTH", "P1_PRIMARY")],
  }),
);
if (highAdh.program_issue !== "PROGRAM_RESPONSE_ISSUE") fail(`high adherence + no change should be response issue, got ${highAdh.program_issue}`);

const gripPrev = flattenSnapshot({
  session_id: "g1",
  assessment_date: "2026-09-12",
  assessment_type: "baseline",
  bodyweight_kg: 80,
  isometric: [{ test_type: "GRIP_STRENGTH", best_left_peak_force: 50, best_right_peak_force: 52, best_bilateral_peak_force: null, asymmetry_percent: 4, left_percentile: 78, right_percentile: 80 }],
  forcePlate: [],
  mobility: [],
});
const gripSame = flattenSnapshot({
  session_id: "g2",
  assessment_date: "2026-12-10",
  assessment_type: "twelve_week_retest",
  bodyweight_kg: 80,
  isometric: [{ test_type: "GRIP_STRENGTH", best_left_peak_force: 50.5, best_right_peak_force: 52.2, best_bilateral_peak_force: null, asymmetry_percent: 3.3, left_percentile: 78, right_percentile: 80 }],
  forcePlate: [],
  mobility: [],
});
const maintained = analyseRetest(
  input(gripSame, gripPrev, {
    previous_priorities: [pri("GRIP_STRENGTH", "MAINTAIN")],
    current_priorities: [pri("GRIP_STRENGTH", "MAINTAIN")],
  }),
);
if (!maintained.priority_outcomes.some((o) => o.outcome === "SUCCESSFUL_MAINTENANCE")) {
  fail(`stable high grip should be successful maintenance: ${maintained.priority_outcomes.map((o) => o.outcome).join(",")}`);
}

const gripDrop = flattenSnapshot({
  session_id: "g3",
  assessment_date: "2026-12-10",
  assessment_type: "twelve_week_retest",
  bodyweight_kg: 80,
  isometric: [{ test_type: "GRIP_STRENGTH", best_left_peak_force: 38, best_right_peak_force: 40, best_bilateral_peak_force: null, asymmetry_percent: 5, left_percentile: 42, right_percentile: 44 }],
  forcePlate: [],
  mobility: [],
});
const dropped = analyseRetest(
  input(gripDrop, gripPrev, {
    previous_priorities: [pri("GRIP_STRENGTH", "MAINTAIN")],
    current_priorities: [pri("GRIP_STRENGTH", "P2_SECONDARY")],
  }),
);
if (!dropped.priority_outcomes.some((o) => o.outcome === "WORSENED" && o.suggested_level === "P2_SECONDARY") && !dropped.new_findings.some((n) => n.quality === "GRIP_STRENGTH")) {
  fail("large grip percentile drop should promote off maintain");
}

const resolved = analyseRetest(
  input(curr, prev, {
    previous_priorities: [pri("LEFT_RIGHT_SYMMETRY", "P1_PRIMARY")],
    current_findings: [] as Finding[],
  }),
);
if (!resolved.priority_outcomes.some((o) => o.quality === "LEFT_RIGHT_SYMMETRY" && o.outcome === "RESOLVED")) {
  fail(`knee symmetry 16.6→7.1 with stronger sides should resolve: ${resolved.priority_outcomes.map((o) => `${o.quality}:${o.outcome}`).join(",")}`);
}

const src =
  readFileSync(join(__dirname, "../lib/retest-engine/engine.ts"), "utf8") +
  readFileSync(join(__dirname, "../lib/retest-engine/compare.ts"), "utf8") +
  readFileSync(join(__dirname, "../lib/retest-engine/priorities.ts"), "utf8") +
  readFileSync(join(__dirname, "../lib/retest-engine/weights.ts"), "utf8");
if (/chronological|years_old|\bdob\b|ageYears|client\.age/.test(src)) fail("age leaked into the retest engine as a programming rule");

console.log("Layer 8 examples OK");
console.log("peak", peakChange.absolute_change, peakChange.percentage_change, peakChange.change_status);
console.log("asymmetry", asym.client_line);
console.log("issue", lowAdh.program_issue, highAdh.program_issue);
console.log("next", result.next_block.map((n) => `${n.level} ${n.quality}`).join(" · "));
