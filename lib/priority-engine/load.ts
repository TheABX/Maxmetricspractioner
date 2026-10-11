import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProgrammingProfile, type LoadedProfile } from "@/lib/programming-profile/load";
import { applyTrends, extractFindings, type AssessmentBundle, type FpRow, type IsoRow, type MobRow, type SquatRow } from "./findings";
import { runPriorityEngine } from "./engine";
import type { PriorityOverrides, PriorityResult } from "./types";

export type PriorityRow = {
  id: string;
  client_id: string;
  assessment_session_id: string | null;
  findings: PriorityResult["findings"];
  priorities: PriorityResult["priorities"];
  auto: PriorityResult;
  overrides: PriorityOverrides;
  confirmed_at: string | null;
  updated_at: string;
};

async function loadBundle(supabase: SupabaseClient, sessionId: string | null): Promise<AssessmentBundle> {
  if (!sessionId) return { sessionId: null, testTypes: {}, isometric: [], forcePlate: [], mobility: [], squat: null };
  const { data: tests } = await supabase.from("test_instances").select("id, test_type").eq("assessment_session_id", sessionId);
  const testTypes: Record<string, string> = {};
  for (const t of tests ?? []) testTypes[t.id] = t.test_type;
  const ids = (tests ?? []).map((t) => t.id);
  if (!ids.length) return { sessionId, testTypes, isometric: [], forcePlate: [], mobility: [], squat: null };

  const [{ data: iso }, { data: fp }, { data: mob }, { data: squat }, { data: metrics }] = await Promise.all([
    supabase
      .from("isometric_results")
      .select(
        "test_instance_id, best_left_peak_force, best_right_peak_force, best_bilateral_peak_force, asymmetry_percent, weaker_side, symmetry_status, population_strength_status, reference_available, high_variability",
      )
      .in("test_instance_id", ids),
    supabase
      .from("force_plate_results")
      .select(
        "test_instance_id, peak_force_kg, relative_peak_force, force_200ms_kg, peak_force_asymmetry_percent, weaker_side, left_contribution, right_contribution, trial_consistency_status, trial_consistency_cv_percent, valid_trial_count",
      )
      .in("test_instance_id", ids),
    supabase
      .from("mobility_results")
      .select(
        "test_instance_id, test_key, left_value, right_value, percentage_difference, lower_side, symmetry_status, population_status, left_percentile, right_percentile, left_reference_category, right_reference_category, reference_available",
      )
      .in("test_instance_id", ids),
    supabase
      .from("mobility_observations")
      .select("depth_achieved, heel_contact, left_right_weight_shift, pain_reported, overhead_arm_position")
      .eq("assessment_session_id", sessionId)
      .limit(1)
      .maybeSingle(),
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

  const isometric: IsoRow[] = (iso ?? []).map((r) => ({
    ...r,
    test_type: testTypes[r.test_instance_id],
    left_percentile: perc[r.test_instance_id]?.left ?? null,
    right_percentile: perc[r.test_instance_id]?.right ?? null,
  }));

  return {
    sessionId,
    testTypes,
    isometric,
    forcePlate: (fp ?? []) as FpRow[],
    mobility: (mob ?? []) as MobRow[],
    squat: (squat as SquatRow | null) ?? null,
  };
}

export type LoadedPriorities = {
  profile: LoadedProfile;
  sessionId: string | null;
  result: PriorityResult;
  row: PriorityRow | null;
  seeded: boolean;
};

export async function loadProgrammingPriorities(
  supabase: SupabaseClient,
  clientId: string,
  overrideOverrides?: PriorityOverrides,
): Promise<LoadedPriorities> {
  const profile = await loadProgrammingProfile(supabase, clientId);
  const [{ data: saved }, { data: sessions }] = await Promise.all([
    supabase.from("programming_priorities").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("assessment_sessions").select("id").eq("client_id", clientId).order("assessment_date", { ascending: false }).limit(2),
  ]);
  const sessionId = (saved as PriorityRow | null)?.assessment_session_id ?? profile.row?.assessment_session_id ?? sessions?.[0]?.id ?? null;
  const prevId = sessions?.[1]?.id ?? null;

  const [bundle, prevBundle] = await Promise.all([loadBundle(supabase, sessionId), loadBundle(supabase, prevId)]);
  let findings = extractFindings({ bundle, profile: profile.profile, effective: profile.effective, signals: profile.signals });
  if (prevId) {
    const prev = extractFindings({ bundle: prevBundle, profile: profile.profile, effective: profile.effective, signals: profile.signals });
    findings = applyTrends(findings, prev);
  }
  const overrides = overrideOverrides ?? (((saved as PriorityRow | null)?.overrides ?? {}) as PriorityOverrides);
  const result = runPriorityEngine({ profile: profile.profile, effective: profile.effective, findings, overrides });
  return { profile, sessionId, result, row: (saved as PriorityRow | null) ?? null, seeded: !saved };
}
