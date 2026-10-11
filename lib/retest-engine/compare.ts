import { protocolsMatch } from "@/lib/mobility/derive";
import { CHANGE, CATEGORY_RANK } from "./weights";
import type {
  AssessmentSnapshot,
  ChangeConfidence,
  ChangeStatus,
  Compatibility,
  Direction,
  MetricChange,
  SnapshotMetric,
} from "./types";

export function protocolCompatibility(a: SnapshotMetric, b: SnapshotMetric): Compatibility {
  if (a.family !== b.family) return "NOT_COMPATIBLE";
  if (a.unit !== b.unit) return "NOT_COMPATIBLE";
  const pa = a.protocol;
  const pb = b.protocol;
  if (!pa && !pb) return "PARTIALLY_COMPATIBLE";
  if (!pa || !pb) return "PARTIALLY_COMPATIBLE";
  if (pa.protocol_id && pb.protocol_id && pa.protocol_id !== pb.protocol_id) return "NOT_COMPATIBLE";
  const stampA = {
    protocol_id: pa.protocol_id,
    protocol_version: pa.protocol_version,
    testing_position: pa.body_position,
    hip_angle: "",
    measurement_method: pa.trial_selection,
  };
  const stampB = {
    protocol_id: pb.protocol_id,
    protocol_version: pb.protocol_version,
    testing_position: pb.body_position,
    hip_angle: "",
    measurement_method: pb.trial_selection,
  };
  if (pa.body_position && pb.body_position && pa.body_position !== pb.body_position) {
    return pa.protocol_version === pb.protocol_version ? "PARTIALLY_COMPATIBLE" : "NOT_COMPATIBLE";
  }
  if (pa.equipment && pb.equipment && pa.equipment !== pb.equipment) return "PARTIALLY_COMPATIBLE";
  if (pa.processing && pb.processing && pa.processing !== pb.processing) return "NOT_COMPATIBLE";
  if (protocolsMatch(stampA, stampB) || (pa.protocol_version && pa.protocol_version === pb.protocol_version && !pa.body_position && !pb.body_position)) {
    return "COMPATIBLE";
  }
  if (pa.protocol_version && pb.protocol_version && pa.protocol_version !== pb.protocol_version) return "PARTIALLY_COMPATIBLE";
  return "PARTIALLY_COMPATIBLE";
}

function noiseFor(m: SnapshotMetric) {
  if (m.domain === "SYMMETRY") return CHANGE.asymmetry_mdc_points;
  if (m.domain === "MOBILITY") return CHANGE.mobility_mdc_percent;
  if (m.domain === "POWER") return CHANGE.strength_mdc_percent;
  return CHANGE.strength_mdc_percent;
}

function bothSidesDeclined(prev: SnapshotMetric, curr: SnapshotMetric) {
  if (prev.left_value == null || prev.right_value == null || curr.left_value == null || curr.right_value == null) return false;
  return curr.left_value < prev.left_value && curr.right_value < prev.right_value;
}

export function comparePair(prev: SnapshotMetric, curr: SnapshotMetric): MetricChange {
  const compatibility = protocolCompatibility(prev, curr);
  const abs = curr.value - prev.value;
  const pct = prev.value === 0 ? null : (abs / prev.value) * 100;
  const direction: Direction = abs > 0 ? "UP" : abs < 0 ? "DOWN" : "UNCHANGED";
  const percentile_change =
    prev.percentile != null && curr.percentile != null ? curr.percentile - prev.percentile : null;
  const relPct =
    prev.relative_value && curr.relative_value && prev.relative_value !== 0
      ? ((curr.relative_value - prev.relative_value) / prev.relative_value) * 100
      : null;
  const sidesDown = bothSidesDeclined(prev, curr);
  const noisy = prev.noisy || curr.noisy;

  let status: ChangeStatus = "UNCERTAIN";
  let confidence: ChangeConfidence = "LOW";

  if (compatibility === "NOT_COMPATIBLE") {
    status = "NOT_COMPARABLE";
  } else {
    const classified = classify(curr, prev, abs, pct, percentile_change, noisy, compatibility);
    status = classified.status;
    confidence = classified.confidence;
    if (curr.domain === "SYMMETRY" && status === "IMPROVED" && sidesDown) {
      confidence = "LOW";
    }
  }

  return {
    key: curr.key,
    family: curr.family,
    label: curr.label,
    quality: curr.quality,
    domain: curr.domain,
    unit: curr.unit,
    favourable: curr.favourable,
    previous_value: prev.value,
    current_value: curr.value,
    absolute_change: abs,
    percentage_change: pct,
    direction,
    previous_percentile: prev.percentile,
    current_percentile: curr.percentile,
    percentile_change,
    previous_category: prev.category,
    current_category: curr.category,
    previous_relative: prev.relative_value,
    current_relative: curr.relative_value,
    relative_percentage_change: relPct,
    change_status: status,
    change_confidence: confidence,
    protocol_compatibility: compatibility,
    interpretation: interpret(curr, prev, abs, pct, percentile_change, status, sidesDown, relPct),
    client_line: clientLine(curr, prev, abs, pct, percentile_change, status, sidesDown),
    programming_implication: implication(curr, status, sidesDown),
    both_sides_declined: sidesDown,
  };
}

function classify(
  curr: SnapshotMetric,
  prev: SnapshotMetric,
  abs: number,
  pct: number | null,
  pDelta: number | null,
  noisy: boolean,
  compatibility: Compatibility,
): { status: ChangeStatus; confidence: ChangeConfidence } {
  const noise = noiseFor(curr);
  if (curr.favourable === "LOWER") {
    const points = abs;
    if (Math.abs(points) < noise) return { status: "STABLE", confidence: noisy ? "LOW" : "MODERATE" };
    const status: ChangeStatus = points <= -noise ? "IMPROVED" : "DECLINED";
    return { status, confidence: confidenceFor(Math.abs(points) / noise, noisy, compatibility) };
  }
  if (curr.favourable === "TARGET_RANGE") {
    const from = prev.category ? CATEGORY_RANK[prev.category] : undefined;
    const to = curr.category ? CATEGORY_RANK[curr.category] : undefined;
    if (from != null && to != null && from !== to) {
      return { status: to > from ? "IMPROVED" : "DECLINED", confidence: noisy ? "LOW" : "MODERATE" };
    }
    if (pDelta != null) {
      if (Math.abs(pDelta) < CHANGE.percentile_mdc_points) return { status: "STABLE", confidence: "MODERATE" };
      return { status: pDelta > 0 ? "IMPROVED" : "DECLINED", confidence: noisy ? "LOW" : "MODERATE" };
    }
    if (pct != null && Math.abs(pct) < CHANGE.mobility_mdc_percent) return { status: "STABLE", confidence: "MODERATE" };
    if (pct != null && Math.abs(pct) >= CHANGE.mobility_mdc_percent) {
      return { status: "UNCERTAIN", confidence: "LOW" };
    }
    return { status: "UNCERTAIN", confidence: "LOW" };
  }
  const rel = pct;
  const absEnough = Math.abs(abs) >= CHANGE.strength_abs_floor;
  if (rel == null) {
    if (!absEnough) return { status: "STABLE", confidence: "LOW" };
    const up = curr.favourable === "HIGHER" ? abs > 0 : abs < 0;
    return { status: up ? "IMPROVED" : "DECLINED", confidence: "LOW" };
  }
  if (Math.abs(rel) < noise && !((pDelta != null && Math.abs(pDelta) >= CHANGE.percentile_mdc_points) && absEnough)) {
    return { status: "STABLE", confidence: noisy ? "LOW" : "MODERATE" };
  }
  const favourableUp = curr.favourable === "HIGHER";
  const improved = favourableUp ? rel >= noise : rel <= -noise;
  const declined = favourableUp ? rel <= -noise : rel >= noise;
  if (!improved && !declined) return { status: "STABLE", confidence: "MODERATE" };
  return {
    status: improved ? "IMPROVED" : "DECLINED",
    confidence: confidenceFor(Math.abs(rel) / noise, noisy, compatibility),
  };
}

function confidenceFor(ratio: number, noisy: boolean, compatibility: Compatibility): ChangeConfidence {
  if (noisy || compatibility !== "COMPATIBLE") return "LOW";
  if (ratio >= 1.5) return "HIGH";
  return "MODERATE";
}

function interpret(
  curr: SnapshotMetric,
  prev: SnapshotMetric,
  abs: number,
  pct: number | null,
  pDelta: number | null,
  status: ChangeStatus,
  sidesDown: boolean,
  relPct: number | null,
) {
  if (status === "NOT_COMPARABLE") return "Protocols or units do not match. These results are not compared.";
  const signed = `${abs >= 0 ? "+" : ""}${fmt(abs)} ${curr.unit}`;
  const rel = pct == null ? "" : ` (${pct >= 0 ? "+" : ""}${fmt(pct)}%)`;
  let text = `${curr.label} ${fmt(prev.value)} → ${fmt(curr.value)} ${curr.unit} (${signed}${rel}).`;
  if (pDelta != null) text += ` Reference position moved ${pDelta >= 0 ? "+" : ""}${fmt(pDelta)} percentile points — not a ${fmt(pDelta)}% change.`;
  if (relPct != null && curr.relative_value != null && prev.relative_value != null && Math.abs(relPct - (pct ?? 0)) >= CHANGE.bodyweight_material_percent) {
    text += ` Relative to bodyweight the change is ${relPct >= 0 ? "+" : ""}${fmt(relPct)}%. Compare both absolute and relative figures.`;
  }
  if (curr.domain === "SYMMETRY" && sidesDown) {
    text += " Side-to-side difference reduced, although overall force capacity also declined.";
  }
  if (status === "STABLE") text += " Change sits inside conservative measurement noise.";
  return text;
}

function clientLine(
  curr: SnapshotMetric,
  prev: SnapshotMetric,
  abs: number,
  pct: number | null,
  pDelta: number | null,
  status: ChangeStatus,
  sidesDown: boolean,
) {
  if (status === "NOT_COMPARABLE") return `${curr.label} was not compared — the test setup changed.`;
  if (curr.domain === "SYMMETRY") {
    const extra = sidesDown ? " Overall force on both sides was also lower." : "";
    if (status === "IMPROVED") return `Left–right ${curr.label.replace(" asymmetry", "")} difference reduced from ${fmt(prev.value)}% to ${fmt(curr.value)}%.${extra}`;
    if (status === "DECLINED") return `Left–right difference increased from ${fmt(prev.value)}% to ${fmt(curr.value)}%.`;
    return `Left–right difference stayed similar (${fmt(curr.value)}%).`;
  }
  if (status === "IMPROVED") {
    const bit = pct != null ? ` (${pct >= 0 ? "+" : ""}${fmt(pct)}%)` : "";
    const p = pDelta != null ? ` Reference position: ${fmt(prev.percentile)}th → ${fmt(curr.percentile)}th percentile.` : "";
    return `${curr.label} improved from ${fmt(prev.value)} to ${fmt(curr.value)} ${curr.unit}${bit}.${p}`;
  }
  if (status === "DECLINED") return `${curr.label} is lower than last time (${fmt(prev.value)} → ${fmt(curr.value)} ${curr.unit}).`;
  if (status === "STABLE") return `${curr.label} was maintained (${fmt(curr.value)} ${curr.unit}).`;
  void abs;
  return `${curr.label} change is unclear from the available numbers.`;
}

function implication(curr: SnapshotMetric, status: ChangeStatus, sidesDown: boolean) {
  if (status === "NOT_COMPARABLE") return "Retest with a matched protocol before changing programming from this metric.";
  if (curr.domain === "SYMMETRY" && status === "IMPROVED" && !sidesDown) {
    return "Reduce extra unilateral bias. Keep some single-side work so the gain is maintained.";
  }
  if (curr.domain === "SYMMETRY" && sidesDown) {
    return "Do not treat symmetry as resolved while both sides are weaker. Rebuild capacity first.";
  }
  if (status === "IMPROVED" && (curr.quality === "LOWER_BODY_STRENGTH" || curr.quality === "KNEE_EXTENSOR_STRENGTH" || curr.quality === "GRIP_STRENGTH")) {
    return "If the reference position is now satisfactory, move this quality toward a maintenance dose.";
  }
  if (status === "DECLINED") return "Review dose, recovery, and whether this quality should be promoted again.";
  if (status === "STABLE") return "If this was a maintain quality at a good position, treat it as successful maintenance — not a lack of progress.";
  return "Hold the current plan until more comparable data exist.";
}

export function compareSnapshots(current: AssessmentSnapshot, previous: AssessmentSnapshot | null): MetricChange[] {
  if (!previous) return [];
  const prevMap = new Map(previous.metrics.map((m) => [m.key, m]));
  const currKeys = new Set(current.metrics.map((m) => m.key));
  const out: MetricChange[] = [];
  for (const curr of current.metrics) {
    const prev = prevMap.get(curr.key);
    if (!prev) {
      out.push(missing(curr, "NOT_RETESTED_BEFORE"));
      continue;
    }
    out.push(comparePair(prev, curr));
  }
  for (const prev of previous.metrics) {
    if (!currKeys.has(prev.key)) out.push(missing(prev, "NOT_RETESTED"));
  }
  return out;
}

function missing(m: SnapshotMetric, kind: "NOT_RETESTED" | "NOT_RETESTED_BEFORE"): MetricChange {
  const current = kind === "NOT_RETESTED" ? null : m.value;
  const previous = kind === "NOT_RETESTED" ? m.value : null;
  return {
    key: m.key,
    family: m.family,
    label: m.label,
    quality: m.quality,
    domain: m.domain,
    unit: m.unit,
    favourable: m.favourable,
    previous_value: previous,
    current_value: current,
    absolute_change: null,
    percentage_change: null,
    direction: null,
    previous_percentile: kind === "NOT_RETESTED" ? m.percentile : null,
    current_percentile: kind === "NOT_RETESTED" ? null : m.percentile,
    percentile_change: null,
    previous_category: kind === "NOT_RETESTED" ? m.category : null,
    current_category: kind === "NOT_RETESTED" ? null : m.category,
    previous_relative: kind === "NOT_RETESTED" ? m.relative_value : null,
    current_relative: kind === "NOT_RETESTED" ? null : m.relative_value,
    relative_percentage_change: null,
    change_status: "NOT_COMPARABLE",
    change_confidence: "LOW",
    protocol_compatibility: "NOT_COMPATIBLE",
    interpretation: kind === "NOT_RETESTED" ? `${m.label} was not retested.` : `${m.label} has no matched previous value.`,
    client_line: kind === "NOT_RETESTED" ? `${m.label} was not part of this retest.` : `${m.label} is new on this assessment.`,
    programming_implication: "Do not infer change for a domain that was not retested.",
    both_sides_declined: false,
  };
}

export function countStatuses(rows: MetricChange[]) {
  const counts: Record<ChangeStatus, number> = {
    IMPROVED: 0,
    STABLE: 0,
    DECLINED: 0,
    UNCERTAIN: 0,
    NOT_COMPARABLE: 0,
  };
  for (const r of rows) {
    if (r.previous_value == null || r.current_value == null) {
      counts.NOT_COMPARABLE += 1;
      continue;
    }
    counts[r.change_status] += 1;
  }
  return counts;
}

function fmt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 100) return n.toFixed(0);
  if (a >= 10) return n.toFixed(1);
  return n.toFixed(1);
}
