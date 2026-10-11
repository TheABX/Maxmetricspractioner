import type { Quality } from "@/lib/priority-engine/types";
import type { AssessmentSnapshot, MetricDomain, ProtocolStamp, SnapshotMetric } from "./types";

const ISO_QUALITY: Record<string, Quality> = {
  ISO_GLOBAL_LOWER_BODY: "LOWER_BODY_STRENGTH",
  ISO_KNEE_EXTENSION: "KNEE_EXTENSOR_STRENGTH",
  ISO_KNEE_FLEXION: "KNEE_FLEXOR_STRENGTH",
  ISO_HIP_ABDUCTION: "HIP_ABDUCTION_STRENGTH",
  ISO_UPPER_PULL: "UPPER_BODY_STRENGTH",
  GRIP_STRENGTH: "GRIP_STRENGTH",
};

const ISO_LABEL: Record<string, string> = {
  ISO_GLOBAL_LOWER_BODY: "Lower-body isometric",
  ISO_KNEE_EXTENSION: "Knee extension",
  ISO_KNEE_FLEXION: "Knee flexion",
  ISO_HIP_ABDUCTION: "Hip abduction",
  ISO_UPPER_PULL: "Upper-body pull",
  GRIP_STRENGTH: "Grip strength",
};

const MOB_QUALITY: Record<string, Quality> = {
  MOBILITY_KNEE_TO_WALL: "ANKLE_MOBILITY",
  MOBILITY_ASLR: "POSTERIOR_CHAIN_MOBILITY",
  MOBILITY_HIP_IR: "HIP_MOBILITY",
  MOBILITY_SHOULDER_FLEXION: "SHOULDER_MOBILITY",
};

const MOB_LABEL: Record<string, string> = {
  MOBILITY_KNEE_TO_WALL: "Knee-to-wall",
  MOBILITY_ASLR: "Active straight-leg raise",
  MOBILITY_HIP_IR: "Hip internal rotation",
  MOBILITY_SHOULDER_FLEXION: "Shoulder flexion",
};

export type IsoSource = {
  test_type: string;
  best_left_peak_force: number | null;
  best_right_peak_force: number | null;
  best_bilateral_peak_force: number | null;
  asymmetry_percent: number | null;
  left_percentile?: number | null;
  right_percentile?: number | null;
  high_variability?: boolean | null;
  protocol?: ProtocolStamp | null;
};

export type FpSource = {
  test_type: string;
  peak_force_kg: number | null;
  relative_peak_force: number | null;
  force_200ms_kg: number | null;
  peak_force_asymmetry_percent: number | null;
  trial_consistency_cv_percent?: number | null;
  trial_consistency_status?: string | null;
  protocol?: ProtocolStamp | null;
};

export type MobSource = {
  test_key: string;
  left_value: number | null;
  right_value: number | null;
  percentage_difference: number | null;
  left_percentile: number | null;
  right_percentile: number | null;
  left_reference_category: string | null;
  right_reference_category: string | null;
  protocol?: ProtocolStamp | null;
};

function metric(partial: SnapshotMetric): SnapshotMetric {
  return partial;
}

function sideLabel(side: "L" | "R" | "BILATERAL") {
  if (side === "L") return "left";
  if (side === "R") return "right";
  return "combined";
}

export function flattenSnapshot(input: {
  session_id: string;
  assessment_date: string;
  assessment_type: string;
  bodyweight_kg: number | null;
  isometric: IsoSource[];
  forcePlate: FpSource[];
  mobility: MobSource[];
}): AssessmentSnapshot {
  const metrics: SnapshotMetric[] = [];
  const bw = input.bodyweight_kg;

  for (const r of input.isometric) {
    const quality = ISO_QUALITY[r.test_type];
    if (!quality) continue;
    const name = ISO_LABEL[r.test_type] ?? r.test_type.replaceAll("_", " ");
    const noisy = Boolean(r.high_variability);
    const proto = r.protocol ?? { protocol_id: r.test_type, protocol_version: "v1", equipment: null, body_position: null, unit: "kg", trial_selection: "best", processing: "isometric_v1" };
    const addSide = (side: "L" | "R", value: number | null, percentile: number | null) => {
      if (value == null) return;
      metrics.push(
        metric({
          key: `${r.test_type}:${side === "L" ? "left" : "right"}`,
          family: r.test_type,
          label: `${name} — ${sideLabel(side)}`,
          quality,
          domain: "STRENGTH",
          value,
          unit: "kg",
          favourable: "HIGHER",
          percentile,
          category: null,
          side,
          left_value: r.best_left_peak_force,
          right_value: r.best_right_peak_force,
          protocol: proto,
          noisy,
          bodyweight_kg: bw,
          relative_value: bw ? value / bw : null,
        }),
      );
    };
    addSide("L", r.best_left_peak_force, r.left_percentile ?? null);
    addSide("R", r.best_right_peak_force, r.right_percentile ?? null);
    if (r.best_bilateral_peak_force != null) {
      metrics.push(
        metric({
          key: `${r.test_type}:bilateral`,
          family: r.test_type,
          label: `${name} — combined`,
          quality,
          domain: "STRENGTH",
          value: r.best_bilateral_peak_force,
          unit: "kg",
          favourable: "HIGHER",
          percentile: null,
          category: null,
          side: "BILATERAL",
          left_value: r.best_left_peak_force,
          right_value: r.best_right_peak_force,
          protocol: proto,
          noisy,
          bodyweight_kg: bw,
          relative_value: bw ? r.best_bilateral_peak_force / bw : null,
        }),
      );
    }
    if (r.asymmetry_percent != null) {
      metrics.push(
        metric({
          key: `${r.test_type}:asymmetry`,
          family: r.test_type,
          label: `${name} asymmetry`,
          quality: "LEFT_RIGHT_SYMMETRY",
          domain: "SYMMETRY",
          value: r.asymmetry_percent,
          unit: "%",
          favourable: "LOWER",
          percentile: null,
          category: null,
          side: "ASYMMETRY",
          left_value: r.best_left_peak_force,
          right_value: r.best_right_peak_force,
          protocol: proto,
          noisy,
          bodyweight_kg: bw,
          relative_value: null,
        }),
      );
    }
  }

  for (const r of input.forcePlate) {
    const noisy = r.trial_consistency_status === "review" || (r.trial_consistency_cv_percent != null && r.trial_consistency_cv_percent > 10);
    const proto = r.protocol ?? { protocol_id: r.test_type, protocol_version: "v1", equipment: "force_plate", body_position: null, unit: "kg", trial_selection: "best_combined", processing: "force_plate_v1" };
    if (r.peak_force_kg != null) {
      metrics.push(
        metric({
          key: `${r.test_type}:peak_force`,
          family: r.test_type,
          label: "Peak force",
          quality: "LOWER_BODY_STRENGTH",
          domain: "STRENGTH",
          value: r.peak_force_kg,
          unit: "kg",
          favourable: "HIGHER",
          percentile: null,
          category: null,
          side: "BILATERAL",
          left_value: null,
          right_value: null,
          protocol: proto,
          noisy,
          bodyweight_kg: bw,
          relative_value: r.relative_peak_force,
        }),
      );
    }
    if (r.relative_peak_force != null) {
      metrics.push(
        metric({
          key: `${r.test_type}:relative_peak_force`,
          family: r.test_type,
          label: "Peak force / bodyweight",
          quality: "LOWER_BODY_STRENGTH",
          domain: "STRENGTH",
          value: r.relative_peak_force,
          unit: "×BW",
          favourable: "HIGHER",
          percentile: null,
          category: null,
          side: "BILATERAL",
          left_value: null,
          right_value: null,
          protocol: proto,
          noisy,
          bodyweight_kg: bw,
          relative_value: r.relative_peak_force,
        }),
      );
    }
    if (r.force_200ms_kg != null) {
      metrics.push(
        metric({
          key: `${r.test_type}:force_200ms`,
          family: r.test_type,
          label: "Force at 200 ms",
          quality: "RAPID_FORCE_PRODUCTION",
          domain: "POWER",
          value: r.force_200ms_kg,
          unit: "kg",
          favourable: "HIGHER",
          percentile: null,
          category: null,
          side: "BILATERAL",
          left_value: null,
          right_value: null,
          protocol: proto,
          noisy,
          bodyweight_kg: bw,
          relative_value: null,
        }),
      );
    }
    if (r.peak_force_asymmetry_percent != null) {
      metrics.push(
        metric({
          key: `${r.test_type}:asymmetry`,
          family: r.test_type,
          label: "Peak-force asymmetry",
          quality: "LEFT_RIGHT_SYMMETRY",
          domain: "SYMMETRY",
          value: r.peak_force_asymmetry_percent,
          unit: "%",
          favourable: "LOWER",
          percentile: null,
          category: null,
          side: "ASYMMETRY",
          left_value: null,
          right_value: null,
          protocol: proto,
          noisy,
          bodyweight_kg: bw,
          relative_value: null,
        }),
      );
    }
  }

  for (const r of input.mobility) {
    const quality = MOB_QUALITY[r.test_key];
    if (!quality) continue;
    const name = MOB_LABEL[r.test_key] ?? r.test_key.replaceAll("_", " ");
    const proto = r.protocol ?? { protocol_id: r.test_key, protocol_version: "v1", equipment: null, body_position: null, unit: null, trial_selection: null, processing: "mobility_v1" };
    const add = (side: "L" | "R", value: number | null, percentile: number | null, category: string | null) => {
      if (value == null) return;
      metrics.push(
        metric({
          key: `${r.test_key}:${side === "L" ? "left" : "right"}`,
          family: r.test_key,
          label: `${name} — ${sideLabel(side)}`,
          quality,
          domain: "MOBILITY",
          value,
          unit: proto.unit ?? "cm",
          favourable: "TARGET_RANGE",
          percentile,
          category,
          side,
          left_value: r.left_value,
          right_value: r.right_value,
          protocol: proto,
          noisy: false,
          bodyweight_kg: bw,
          relative_value: null,
        }),
      );
    };
    add("L", r.left_value, r.left_percentile, r.left_reference_category);
    add("R", r.right_value, r.right_percentile, r.right_reference_category);
    if (r.percentage_difference != null) {
      metrics.push(
        metric({
          key: `${r.test_key}:asymmetry`,
          family: r.test_key,
          label: `${name} asymmetry`,
          quality: "LEFT_RIGHT_SYMMETRY",
          domain: "SYMMETRY",
          value: r.percentage_difference,
          unit: "%",
          favourable: "LOWER",
          percentile: null,
          category: null,
          side: "ASYMMETRY",
          left_value: r.left_value,
          right_value: r.right_value,
          protocol: proto,
          noisy: false,
          bodyweight_kg: bw,
          relative_value: null,
        }),
      );
    }
  }

  const tested = [...new Set(metrics.map((m) => m.domain))];
  const all: MetricDomain[] = ["STRENGTH", "SYMMETRY", "MOBILITY", "POWER"];
  return {
    session_id: input.session_id,
    assessment_date: input.assessment_date,
    assessment_type: input.assessment_type,
    bodyweight_kg: bw,
    protocol_versions: Object.fromEntries(
      metrics.filter((m) => m.protocol?.protocol_id && m.protocol.protocol_version).map((m) => [m.protocol!.protocol_id!, m.protocol!.protocol_version!]),
    ),
    metrics,
    domains_tested: tested,
    domains_missing: all.filter((d) => !tested.includes(d)),
  };
}
