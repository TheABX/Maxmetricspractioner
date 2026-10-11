import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProgramAdaptation } from "@/lib/adaptation-engine/load";
import { loadProgrammingPriorities } from "@/lib/priority-engine/load";
import type { RankedPriority } from "@/lib/priority-engine/types";
import { analyseRetest } from "./engine";
import { flattenSnapshot, type FpSource, type IsoSource, type MobSource } from "./metrics";
import type { AssessmentSnapshot, ProtocolStamp, RetestOverride, RetestResult } from "./types";

export type SessionOption = {
  id: string;
  assessment_date: string;
  assessment_type: string;
  status: string;
  bodyweight_kg: number | null;
};

export type RetestRow = {
  id: string;
  client_id: string;
  current_assessment_id: string;
  compare_assessment_id: string | null;
  baseline_assessment_id: string | null;
  auto: RetestResult;
  review: RetestResult;
  overrides: RetestOverride | null;
  goals_confirmed: boolean | null;
  contextual_change: string | null;
  practitioner_notes: string | null;
  confirmed_at: string | null;
};

export type LoadedRetest = {
  sessions: SessionOption[];
  currentId: string | null;
  compareId: string | null;
  baselineId: string | null;
  result: RetestResult;
  row: RetestRow | null;
  seeded: boolean;
  schedule: { expected_retest_date: string | null; program_id: string | null; weeks: number | null };
  first_name: string;
};

async function loadSnapshot(supabase: SupabaseClient, session: SessionOption): Promise<AssessmentSnapshot> {
  const { data: tests } = await supabase.from("test_instances").select("id, test_type").eq("assessment_session_id", session.id);
  const testTypes: Record<string, string> = {};
  for (const t of tests ?? []) testTypes[t.id] = t.test_type;
  const ids = (tests ?? []).map((t) => t.id);
  if (!ids.length) {
    return flattenSnapshot({
      session_id: session.id,
      assessment_date: session.assessment_date,
      assessment_type: session.assessment_type,
      bodyweight_kg: session.bodyweight_kg,
      isometric: [],
      forcePlate: [],
      mobility: [],
    });
  }

  const [{ data: iso }, { data: fp }, { data: mob }, { data: metrics }] = await Promise.all([
    supabase
      .from("isometric_results")
      .select("test_instance_id, best_left_peak_force, best_right_peak_force, best_bilateral_peak_force, asymmetry_percent, high_variability")
      .in("test_instance_id", ids),
    supabase
      .from("force_plate_results")
      .select("test_instance_id, peak_force_kg, relative_peak_force, force_200ms_kg, peak_force_asymmetry_percent, trial_consistency_cv_percent, trial_consistency_status")
      .in("test_instance_id", ids),
    supabase
      .from("mobility_results")
      .select("test_instance_id, test_key, left_value, right_value, percentage_difference, left_percentile, right_percentile, left_reference_category, right_reference_category, protocol_snapshot")
      .in("test_instance_id", ids),
    supabase.from("metric_values").select("test_instance_id, metric_key, percentile").in("test_instance_id", ids),
  ]);

  const perc: Record<string, { left?: number; right?: number }> = {};
  for (const m of metrics ?? []) {
    if (m.percentile == null) continue;
    const slot = (perc[m.test_instance_id] ??= {});
    const key = String(m.metric_key).toLowerCase();
    if (key.includes("left")) slot.left = Number(m.percentile);
    else if (key.includes("right")) slot.right = Number(m.percentile);
  }

  const isometric: IsoSource[] = (iso ?? []).map((r) => ({
    test_type: testTypes[r.test_instance_id] ?? "",
    best_left_peak_force: num(r.best_left_peak_force),
    best_right_peak_force: num(r.best_right_peak_force),
    best_bilateral_peak_force: num(r.best_bilateral_peak_force),
    asymmetry_percent: num(r.asymmetry_percent),
    left_percentile: perc[r.test_instance_id]?.left ?? null,
    right_percentile: perc[r.test_instance_id]?.right ?? null,
    high_variability: Boolean(r.high_variability),
  }));

  const forcePlate: FpSource[] = (fp ?? []).map((r) => ({
    test_type: testTypes[r.test_instance_id] ?? "FORCE_PLATE_IMTP",
    peak_force_kg: num(r.peak_force_kg),
    relative_peak_force: num(r.relative_peak_force),
    force_200ms_kg: num(r.force_200ms_kg),
    peak_force_asymmetry_percent: num(r.peak_force_asymmetry_percent),
    trial_consistency_cv_percent: num(r.trial_consistency_cv_percent),
    trial_consistency_status: r.trial_consistency_status ?? null,
  }));

  const mobility: MobSource[] = (mob ?? []).map((r) => {
    const snap = (r.protocol_snapshot ?? {}) as Record<string, unknown>;
    const protocol: ProtocolStamp = {
      protocol_id: str(snap.protocol_id) ?? r.test_key,
      protocol_version: str(snap.protocol_version) ?? "v1",
      equipment: str(snap.device) ?? str(snap.equipment),
      body_position: str(snap.testing_position) ?? str(snap.body_position),
      unit: str(snap.unit),
      trial_selection: str(snap.measurement_method) ?? str(snap.trial_selection),
      processing: "mobility_v1",
    };
    return {
      test_key: r.test_key,
      left_value: num(r.left_value),
      right_value: num(r.right_value),
      percentage_difference: num(r.percentage_difference),
      left_percentile: num(r.left_percentile),
      right_percentile: num(r.right_percentile),
      left_reference_category: r.left_reference_category ?? null,
      right_reference_category: r.right_reference_category ?? null,
      protocol,
    };
  });

  return flattenSnapshot({
    session_id: session.id,
    assessment_date: session.assessment_date,
    assessment_type: session.assessment_type,
    bodyweight_kg: session.bodyweight_kg,
    isometric,
    forcePlate,
    mobility,
  });
}

function num(v: unknown) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown) {
  if (v == null || v === "") return null;
  return String(v);
}

export async function loadRetestReview(
  supabase: SupabaseClient,
  clientId: string,
  opts?: { currentId?: string | null; compareId?: string | null },
): Promise<LoadedRetest> {
  const [{ data: sessionRows }, { data: saved }, { data: client }, { data: program }, priorities, adaptation] = await Promise.all([
    supabase
      .from("assessment_sessions")
      .select("id, assessment_date, assessment_type, status, bodyweight_kg")
      .eq("client_id", clientId)
      .order("assessment_date", { ascending: false }),
    supabase.from("retest_reviews").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("clients").select("first_name").eq("id", clientId).maybeSingle(),
    supabase.from("programs").select("id, weeks, start_date, expected_retest_date").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    loadProgrammingPriorities(supabase, clientId),
    loadProgramAdaptation(supabase, clientId),
  ]);

  const sessions = (sessionRows ?? []) as SessionOption[];
  const currentId = opts?.currentId ?? sessions[0]?.id ?? null;
  const earlier = sessions.filter((s) => s.id !== currentId);
  const compareId = opts?.compareId ?? earlier[0]?.id ?? null;
  const baseline = sessions.slice().reverse().find((s) => s.assessment_type === "baseline") ?? sessions[sessions.length - 1] ?? null;
  const currentMeta = sessions.find((s) => s.id === currentId) ?? null;

  const historyMetas = [...sessions].reverse();
  const snapshots = await Promise.all(historyMetas.map((s) => loadSnapshot(supabase, s)));
  const byId = new Map(snapshots.map((s) => [s.session_id, s]));
  const empty = flattenSnapshot({
    session_id: currentId ?? "none",
    assessment_date: currentMeta?.assessment_date ?? new Date().toISOString().slice(0, 10),
    assessment_type: currentMeta?.assessment_type ?? "baseline",
    bodyweight_kg: currentMeta?.bodyweight_kg ?? null,
    isometric: [],
    forcePlate: [],
    mobility: [],
  });
  const current = (currentId && byId.get(currentId)) || empty;
  const previous = compareId ? byId.get(compareId) ?? null : null;
  const baselineSnap = baseline ? byId.get(baseline.id) ?? null : null;

  const { data: historyRows } = await supabase
    .from("priority_history")
    .select("assessment_session_id, quality, laterality, priority_level")
    .eq("client_id", clientId);

  const previous_priorities: RankedPriority[] = reconstruct(historyRows ?? [], compareId) ??
    (priorities.row?.assessment_session_id && priorities.row.assessment_session_id !== currentId
      ? priorities.result.priorities
      : priorities.result.priorities);

  let expected = program?.expected_retest_date ?? null;
  if (!expected && program?.start_date && program.weeks) {
    const d = new Date(program.start_date);
    d.setDate(d.getDate() + program.weeks * 7);
    expected = d.toISOString().slice(0, 10);
  }

  const result = analyseRetest({
    first_name: client?.first_name ?? "",
    current,
    previous: previous ?? null,
    baseline: baselineSnap,
    history: snapshots,
    previous_priorities,
    current_priorities: priorities.result.priorities,
    current_findings: priorities.result.findings,
    previous_findings: [],
    adherence_percent: adaptation.effective.client.adherence_percent > 1 ? adaptation.effective.client.adherence_percent / 100 : adaptation.effective.client.adherence_percent,
    training_stage: priorities.profile.effective.training_stage,
    primary_goal: priorities.profile.profile.primary_goal,
    goals_still_current: saved?.goals_confirmed ?? null,
    contextual_change: saved?.contextual_change ?? null,
  });

  return {
    sessions,
    currentId,
    compareId,
    baselineId: baseline?.id ?? null,
    result,
    row: (saved as RetestRow | null) ?? null,
    seeded: !saved,
    schedule: { expected_retest_date: expected, program_id: program?.id ?? null, weeks: program?.weeks ?? null },
    first_name: client?.first_name ?? "",
  };
}

function reconstruct(
  rows: { assessment_session_id: string | null; quality: string; laterality: string | null; priority_level: string }[],
  sessionId: string | null,
): RankedPriority[] | null {
  if (!sessionId) return null;
  const mine = rows.filter((r) => r.assessment_session_id === sessionId);
  if (!mine.length) return null;
  return mine.map((r) => ({
    quality: r.quality as RankedPriority["quality"],
    parent_quality: null,
    laterality: (r.laterality as RankedPriority["laterality"]) ?? null,
    automatic_priority: r.priority_level as RankedPriority["effective_priority"],
    practitioner_priority: null,
    effective_priority: r.priority_level as RankedPriority["effective_priority"],
    override_reason: "",
    override_date: null,
    overridden_by: null,
    priority_score: 0,
    severity: "NONE",
    confidence: "MODERATE",
    goal_relevance: "MODERATE",
    functional_relevance: "MODERATE",
    trend: "UNKNOWN",
    multi_test_support: "NONE",
    cluster: null,
    action: "improve",
    why: ["Restored from priority history."],
    recommended_quality_work: "",
    client_line: "",
    finding_ids: [],
  }));
}
