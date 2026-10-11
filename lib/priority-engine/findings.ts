import type { AssessmentSignals } from "@/lib/programming-profile/derive";
import type { EffectiveClassification, ProfileInput } from "@/lib/programming-profile/types";
import type { Confidence, Finding, FunctionalRelevance, Quality, Severity } from "./types";

export type IsoRow = {
  test_instance_id: string;
  test_type?: string;
  best_left_peak_force: number | null;
  best_right_peak_force: number | null;
  best_bilateral_peak_force: number | null;
  asymmetry_percent: number | null;
  weaker_side: string | null;
  symmetry_status: string | null;
  population_strength_status: string | null;
  reference_available: boolean | null;
  high_variability: boolean | null;
  left_percentile?: number | null;
  right_percentile?: number | null;
};

export type FpRow = {
  test_instance_id: string;
  peak_force_kg: number | null;
  relative_peak_force: number | null;
  force_200ms_kg: number | null;
  peak_force_asymmetry_percent: number | null;
  weaker_side: string | null;
  left_contribution: number | null;
  right_contribution: number | null;
  trial_consistency_status: string | null;
  trial_consistency_cv_percent: number | null;
  valid_trial_count: number | null;
};

export type MobRow = {
  test_instance_id: string;
  test_key: string;
  left_value: number | null;
  right_value: number | null;
  percentage_difference: number | null;
  lower_side: string | null;
  symmetry_status: string | null;
  population_status: string | null;
  left_percentile: number | null;
  right_percentile: number | null;
  left_reference_category: string | null;
  right_reference_category: string | null;
  reference_available: boolean | null;
};

export type SquatRow = {
  depth_achieved: string | null;
  heel_contact: string | null;
  left_right_weight_shift: string | null;
  pain_reported: string | null;
  overhead_arm_position: string | null;
};

export type AssessmentBundle = {
  sessionId: string | null;
  testTypes: Record<string, string>;
  isometric: IsoRow[];
  forcePlate: FpRow[];
  mobility: MobRow[];
  squat: SquatRow | null;
};

const ISO_QUALITY: Record<string, Quality> = {
  ISO_GLOBAL_LOWER_BODY: "LOWER_BODY_STRENGTH",
  ISO_KNEE_EXTENSION: "KNEE_EXTENSOR_STRENGTH",
  ISO_KNEE_FLEXION: "KNEE_FLEXOR_STRENGTH",
  ISO_HIP_ABDUCTION: "HIP_ABDUCTION_STRENGTH",
  ISO_UPPER_PULL: "UPPER_BODY_STRENGTH",
  GRIP_STRENGTH: "GRIP_STRENGTH",
};

const MOB_QUALITY: Record<string, Quality> = {
  MOBILITY_KNEE_TO_WALL: "ANKLE_MOBILITY",
  MOBILITY_ASLR: "POSTERIOR_CHAIN_MOBILITY",
  MOBILITY_HIP_IR: "HIP_MOBILITY",
  MOBILITY_SHOULDER_FLEXION: "SHOULDER_MOBILITY",
};

function side(v: string | null | undefined): "L" | "R" | null {
  if (v === "L" || v === "R") return v;
  return null;
}

function worse(a: Severity, b: Severity): Severity {
  const o = ["NONE", "MILD", "MODERATE", "HIGH", "VERY_HIGH"] as const;
  return o.indexOf(a) >= o.indexOf(b) ? a : b;
}

export function severityFromPercentile(p: number | null): { severity: Severity; confidence: Confidence } {
  if (p == null) return { severity: "NONE", confidence: "LOW" };
  if (p < 10) return { severity: "VERY_HIGH", confidence: "HIGH" };
  if (p < 25) return { severity: "HIGH", confidence: "HIGH" };
  if (p < 40) return { severity: "MODERATE", confidence: "HIGH" };
  if (p < 55) return { severity: "MILD", confidence: "MODERATE" };
  return { severity: "NONE", confidence: "HIGH" };
}

export function severityFromAsymmetry(pct: number | null, status: string | null): Severity {
  if (status === "priority" || (pct != null && pct >= 20)) return pct != null && pct >= 25 ? "VERY_HIGH" : "HIGH";
  if (status === "monitor" || (pct != null && pct >= 10)) return pct != null && pct >= 15 ? "MODERATE" : "MILD";
  return "NONE";
}

function baseFinding(partial: Omit<Finding, "created_at" | "source_count" | "supporting_findings" | "cluster" | "goal_relevance"> & { goal_relevance?: Finding["goal_relevance"] }): Finding {
  return {
    source_count: 1,
    supporting_findings: [],
    cluster: null,
    goal_relevance: "NONE",
    created_at: new Date().toISOString(),
    ...partial,
  };
}

export function extractFindings(opts: {
  bundle: AssessmentBundle;
  profile: ProfileInput;
  effective: EffectiveClassification;
  signals: AssessmentSignals;
}): Finding[] {
  const { bundle, profile, effective, signals } = opts;
  const out: Finding[] = [];
  const squat = bundle.squat;
  const heelIssue = squat?.heel_contact && squat.heel_contact !== "BOTH";
  const squatLimited = squat?.depth_achieved === "NOT_COMPLETED" || squat?.depth_achieved === "ABOVE_PARALLEL";
  const squatPain = squat?.pain_reported === "YES";
  const shift = squat?.left_right_weight_shift === "LEFT" || squat?.left_right_weight_shift === "RIGHT";

  for (const r of bundle.isometric) {
    const testType = r.test_type ?? bundle.testTypes[r.test_instance_id] ?? "";
    const quality = ISO_QUALITY[testType];
    if (!quality) continue;
    const leftP = r.left_percentile ?? null;
    const rightP = r.right_percentile ?? null;
    const absP = leftP != null && rightP != null ? Math.min(leftP, rightP) : (leftP ?? rightP);
    const ref = Boolean(r.reference_available) && absP != null;
    const abs = severityFromPercentile(absP);
    const asymSev = severityFromAsymmetry(r.asymmetry_percent, r.symmetry_status);
    const highVar = Boolean(r.high_variability);
    const conf: Confidence = highVar ? "LOW" : ref ? abs.confidence : r.symmetry_status && r.symmetry_status !== "unavailable" ? "MODERATE" : "LOW";
    const laterality = side(r.weaker_side) && asymSev !== "NONE" ? side(r.weaker_side) : "BILATERAL";

    out.push(
      baseFinding({
        finding_id: `iso:${r.test_instance_id}:capacity`,
        quality,
        parent_quality: quality === "KNEE_EXTENSOR_STRENGTH" || quality === "KNEE_FLEXOR_STRENGTH" || quality === "HIP_ABDUCTION_STRENGTH" ? "LOWER_BODY_STRENGTH" : null,
        laterality,
        test_source: testType,
        metric: "peak_force",
        raw_value: r.best_bilateral_peak_force ?? r.best_left_peak_force,
        normalised_value: null,
        reference_percentile: absP,
        reference_category: r.population_strength_status,
        left_value: r.best_left_peak_force,
        right_value: r.best_right_peak_force,
        asymmetry_percent: r.asymmetry_percent,
        lower_side: side(r.weaker_side),
        severity: ref ? abs.severity : "NONE",
        severity_confidence: ref ? abs.confidence : "LOW",
        confidence: conf,
        functional_relevance: quality === "GRIP_STRENGTH" ? "MODERATE" : "MODERATE",
        trend_status: "UNKNOWN",
        pain_associated: false,
        movement_limitation_associated: false,
        notes: ref
          ? `Age/sex percentile ${absP?.toFixed(0)}.`
          : "No matching strength reference is loaded — absolute capacity is not scored as a deficit.",
      }),
    );

    if (asymSev !== "NONE") {
      out.push(
        baseFinding({
          finding_id: `iso:${r.test_instance_id}:asym`,
          quality: "LEFT_RIGHT_SYMMETRY",
          parent_quality: quality,
          laterality: side(r.weaker_side),
          test_source: testType,
          metric: "asymmetry_percent",
          raw_value: r.asymmetry_percent,
          normalised_value: r.asymmetry_percent,
          reference_percentile: null,
          reference_category: r.symmetry_status,
          left_value: r.best_left_peak_force,
          right_value: r.best_right_peak_force,
          asymmetry_percent: r.asymmetry_percent,
          lower_side: side(r.weaker_side),
          severity: asymSev,
          severity_confidence: "HIGH",
          confidence: highVar ? "LOW" : "MODERATE",
          functional_relevance: asymSev === "HIGH" || asymSev === "VERY_HIGH" ? "HIGH" : "MODERATE",
          trend_status: "UNKNOWN",
          pain_associated: false,
          movement_limitation_associated: shift && side(r.weaker_side) != null,
          notes: `${r.asymmetry_percent?.toFixed(1)}% side-to-side on ${testType.replaceAll("_", " ")}. Clinic thresholds: monitor >10%, priority >20%.`,
        }),
      );
    }
  }

  for (const r of bundle.forcePlate) {
    const testType = bundle.testTypes[r.test_instance_id] ?? "FORCE_PLATE";
    const consistent = r.trial_consistency_status === "review" || (r.trial_consistency_cv_percent != null && r.trial_consistency_cv_percent > 10);
    const conf: Confidence = consistent ? "LOW" : (r.valid_trial_count ?? 0) >= 2 ? "MODERATE" : "LOW";
    const asymSev = severityFromAsymmetry(r.peak_force_asymmetry_percent, null);

    out.push(
      baseFinding({
        finding_id: `fp:${r.test_instance_id}:peak`,
        quality: "LOWER_BODY_STRENGTH",
        parent_quality: null,
        laterality: "BILATERAL",
        test_source: testType,
        metric: "relative_peak_force",
        raw_value: r.peak_force_kg,
        normalised_value: r.relative_peak_force,
        reference_percentile: null,
        reference_category: null,
        left_value: r.left_contribution,
        right_value: r.right_contribution,
        asymmetry_percent: r.peak_force_asymmetry_percent,
        lower_side: side(r.weaker_side),
        severity: "NONE",
        severity_confidence: "LOW",
        confidence: conf,
        functional_relevance: "MODERATE",
        trend_status: "UNKNOWN",
        pain_associated: false,
        movement_limitation_associated: false,
        notes:
          r.relative_peak_force != null
            ? `${r.relative_peak_force.toFixed(2)}× bodyweight. No population ranking is applied.`
            : "Peak force recorded without a bodyweight-normalised reference ranking.",
      }),
    );

    if (r.force_200ms_kg != null && r.peak_force_kg) {
      const share = r.force_200ms_kg / r.peak_force_kg;
      out.push(
        baseFinding({
          finding_id: `fp:${r.test_instance_id}:rfd`,
          quality: "RAPID_FORCE_PRODUCTION",
          parent_quality: "POWER",
          laterality: "BILATERAL",
          test_source: testType,
          metric: "force_200ms_share",
          raw_value: r.force_200ms_kg,
          normalised_value: share,
          reference_percentile: null,
          reference_category: null,
          left_value: null,
          right_value: null,
          asymmetry_percent: null,
          lower_side: null,
          severity: share < 0.35 ? "HIGH" : share < 0.45 ? "MODERATE" : "NONE",
          severity_confidence: "MODERATE",
          confidence: "MODERATE",
          functional_relevance: share < 0.45 ? "MODERATE" : "LOW",
          trend_status: "UNKNOWN",
          pain_associated: false,
          movement_limitation_associated: false,
          notes: `200 ms force was ${(share * 100).toFixed(0)}% of peak. In-house screen only — not a validated cut-point.`,
        }),
      );
    }

    if (asymSev !== "NONE") {
      out.push(
        baseFinding({
          finding_id: `fp:${r.test_instance_id}:asym`,
          quality: "LEFT_RIGHT_SYMMETRY",
          parent_quality: "LOWER_BODY_STRENGTH",
          laterality: side(r.weaker_side),
          test_source: testType,
          metric: "peak_force_asymmetry_percent",
          raw_value: r.peak_force_asymmetry_percent,
          normalised_value: r.peak_force_asymmetry_percent,
          reference_percentile: null,
          reference_category: null,
          left_value: r.left_contribution,
          right_value: r.right_contribution,
          asymmetry_percent: r.peak_force_asymmetry_percent,
          lower_side: side(r.weaker_side),
          severity: asymSev,
          severity_confidence: "HIGH",
          confidence: conf,
          functional_relevance: shift ? "HIGH" : "MODERATE",
          trend_status: "UNKNOWN",
          pain_associated: false,
          movement_limitation_associated: Boolean(shift),
          notes: `Force-plate contribution split L ${r.left_contribution ?? "—"} / R ${r.right_contribution ?? "—"}.`,
        }),
      );
    }
  }

  for (const r of bundle.mobility) {
    const quality = MOB_QUALITY[r.test_key];
    if (!quality) continue;
    const lowP = r.left_percentile != null && r.right_percentile != null ? Math.min(r.left_percentile, r.right_percentile) : (r.left_percentile ?? r.right_percentile);
    const ref = Boolean(r.reference_available) && lowP != null;
    const abs = severityFromPercentile(lowP);
    const asymSev = severityFromAsymmetry(r.percentage_difference, r.symmetry_status);
    const functional: FunctionalRelevance =
      quality === "ANKLE_MOBILITY" && (heelIssue || squatLimited)
        ? "HIGH"
        : quality === "SHOULDER_MOBILITY" && squat?.overhead_arm_position === "NOT_MAINTAINED"
          ? "HIGH"
          : asymSev === "HIGH" || asymSev === "VERY_HIGH"
            ? "MODERATE"
            : "LOW";
    const sev = ref ? worse(abs.severity, asymSev === "NONE" ? "NONE" : asymSev === "MILD" ? "MILD" : "MODERATE") : "NONE";

    out.push(
      baseFinding({
        finding_id: `mob:${r.test_instance_id}`,
        quality,
        parent_quality: "MOVEMENT_COMPETENCY",
        laterality: side(r.lower_side) ?? "BILATERAL",
        test_source: r.test_key,
        metric: "range",
        raw_value: r.left_value,
        normalised_value: null,
        reference_percentile: lowP,
        reference_category: r.left_reference_category ?? r.population_status,
        left_value: r.left_value,
        right_value: r.right_value,
        asymmetry_percent: r.percentage_difference,
        lower_side: side(r.lower_side),
        severity: sev,
        severity_confidence: ref ? abs.confidence : "LOW",
        confidence: ref ? abs.confidence : r.symmetry_status && r.symmetry_status !== "unavailable" ? "MODERATE" : "LOW",
        functional_relevance: functional,
        trend_status: "UNKNOWN",
        pain_associated: squatPain && quality === "ANKLE_MOBILITY",
        movement_limitation_associated: functional === "HIGH",
        notes: ref
          ? `Reference percentile ${lowP?.toFixed(0)}. ${r.symmetry_status ?? ""}`
          : `No validated mobility reference loaded. Symmetry ${r.symmetry_status ?? "unavailable"}.`,
      }),
    );

    if (asymSev !== "NONE") {
      out.push(
        baseFinding({
          finding_id: `mob:${r.test_instance_id}:asym`,
          quality: "LEFT_RIGHT_SYMMETRY",
          parent_quality: quality,
          laterality: side(r.lower_side),
          test_source: r.test_key,
          metric: "percentage_difference",
          raw_value: r.percentage_difference,
          normalised_value: r.percentage_difference,
          reference_percentile: null,
          reference_category: r.symmetry_status,
          left_value: r.left_value,
          right_value: r.right_value,
          asymmetry_percent: r.percentage_difference,
          lower_side: side(r.lower_side),
          severity: asymSev,
          severity_confidence: "HIGH",
          confidence: "MODERATE",
          functional_relevance: functional,
          trend_status: "UNKNOWN",
          pain_associated: false,
          movement_limitation_associated: functional === "HIGH",
          notes: `${r.test_key.replaceAll("_", " ")} side-to-side ${r.percentage_difference?.toFixed(1) ?? "—"}%.`,
        }),
      );
    }
  }

  if (squat) {
    out.push(
      baseFinding({
        finding_id: "obs:overhead_squat",
        quality: "MOVEMENT_COMPETENCY",
        parent_quality: null,
        laterality: squat.left_right_weight_shift === "LEFT" ? "L" : squat.left_right_weight_shift === "RIGHT" ? "R" : "BILATERAL",
        test_source: "MOBILITY_OVERHEAD_SQUAT",
        metric: "depth_achieved",
        raw_value: null,
        normalised_value: null,
        reference_percentile: null,
        reference_category: squat.depth_achieved,
        left_value: null,
        right_value: null,
        asymmetry_percent: null,
        lower_side: squat.left_right_weight_shift === "LEFT" ? "L" : squat.left_right_weight_shift === "RIGHT" ? "R" : null,
        severity: squat.depth_achieved === "NOT_COMPLETED" ? "HIGH" : squat.depth_achieved === "ABOVE_PARALLEL" ? "MODERATE" : "NONE",
        severity_confidence: "MODERATE",
        confidence: "MODERATE",
        functional_relevance: squatLimited || heelIssue || shift ? "HIGH" : "LOW",
        trend_status: "UNKNOWN",
        pain_associated: squatPain,
        movement_limitation_associated: Boolean(squatLimited || heelIssue),
        notes: [squat.depth_achieved, squat.heel_contact, squat.left_right_weight_shift, squatPain ? "pain reported" : null]
          .filter(Boolean)
          .join(" · "),
      }),
    );
  }

  if (effective.movement_competency === "LOW") {
    out.push(
      baseFinding({
        finding_id: "profile:movement_competency",
        quality: "MOVEMENT_COMPETENCY",
        parent_quality: null,
        laterality: null,
        test_source: "PROGRAMMING_PROFILE",
        metric: "movement_competency",
        raw_value: null,
        normalised_value: null,
        reference_percentile: null,
        reference_category: "LOW",
        left_value: null,
        right_value: null,
        asymmetry_percent: null,
        lower_side: null,
        severity: "HIGH",
        severity_confidence: "MODERATE",
        confidence: "MODERATE",
        functional_relevance: "HIGH",
        trend_status: "UNKNOWN",
        pain_associated: false,
        movement_limitation_associated: true,
        notes: "Profile classification: low movement competency.",
      }),
    );
  }

  if (effective.tolerance_to_training === "LOW" || profile.recovery_quality === "LOW") {
    out.push(
      baseFinding({
        finding_id: "profile:recovery",
        quality: "RECOVERY",
        parent_quality: null,
        laterality: null,
        test_source: "PROGRAMMING_PROFILE",
        metric: "tolerance_to_training",
        raw_value: null,
        normalised_value: null,
        reference_percentile: null,
        reference_category: effective.tolerance_to_training,
        left_value: null,
        right_value: null,
        asymmetry_percent: null,
        lower_side: null,
        severity: "MODERATE",
        severity_confidence: "MODERATE",
        confidence: "MODERATE",
        functional_relevance: "HIGH",
        trend_status: "UNKNOWN",
        pain_associated: false,
        movement_limitation_associated: false,
        notes: `Tolerance ${effective.tolerance_to_training}; recovery ${profile.recovery_quality ?? "—"}.`,
      }),
    );
  }

  if (profile.pain_present && (profile.pain_severity ?? 0) >= 5) {
    out.push(
      baseFinding({
        finding_id: "profile:pain",
        quality: "MOVEMENT_COMPETENCY",
        parent_quality: null,
        laterality: null,
        test_source: "CLIENT_REPORT",
        metric: "pain_severity",
        raw_value: profile.pain_severity,
        normalised_value: profile.pain_severity,
        reference_percentile: null,
        reference_category: "pain_present",
        left_value: null,
        right_value: null,
        asymmetry_percent: null,
        lower_side: null,
        severity: (profile.pain_severity ?? 0) >= 7 ? "VERY_HIGH" : "HIGH",
        severity_confidence: "HIGH",
        confidence: "HIGH",
        functional_relevance: "HIGH",
        trend_status: "UNKNOWN",
        pain_associated: true,
        movement_limitation_associated: true,
        notes: [profile.pain_notes, profile.activities_that_provoke].filter(Boolean).join(" — ") || "Client-reported pain. Not a diagnosis.",
      }),
    );
  }

  void signals;
  return out;
}

export function applyTrends(current: Finding[], previous: Finding[]): Finding[] {
  if (!previous.length) {
    return current.map((f) => ({ ...f, trend_status: f.trend_status === "UNKNOWN" ? "NEW_FINDING" : f.trend_status }));
  }
  return current.map((f) => {
    const prev = previous.find((p) => p.quality === f.quality && p.metric === f.metric && p.test_source === f.test_source);
    if (!prev) return { ...f, trend_status: "NEW_FINDING" };
    const a = f.reference_percentile ?? (f.asymmetry_percent != null ? -f.asymmetry_percent : null);
    const b = prev.reference_percentile ?? (prev.asymmetry_percent != null ? -prev.asymmetry_percent : null);
    if (a == null || b == null) return { ...f, trend_status: "UNKNOWN" };
    const delta = a - b;
    if (delta > 5) return { ...f, trend_status: "IMPROVING" };
    if (delta < -5) return { ...f, trend_status: "DECLINING" };
    return { ...f, trend_status: "STABLE" };
  });
}
