import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSummary, classify, effective, seedFromQuestionnaire, signalsFromAnswers, type AssessmentSignals } from "./derive";
import { emptyProfile, type AutoClassification, type Overrides, type ProfileInput } from "./types";

export type ProfileRow = {
  id: string;
  client_id: string;
  questionnaire_response_id: string | null;
  assessment_session_id: string | null;
  program_mode: string;
  primary_goal: string | null;
  training_stage: string | null;
  foundation_phase_recommended: boolean | null;
  profile: ProfileInput;
  auto: AutoClassification;
  overrides: Overrides;
  summary: string | null;
  confirmed_at: string | null;
  updated_at: string;
};

export type LoadedProfile = {
  row: ProfileRow | null;
  /** True when nothing is saved yet and `profile` was seeded from the questionnaire. */
  seeded: boolean;
  profile: ProfileInput;
  auto: AutoClassification;
  overrides: Overrides;
  effective: ReturnType<typeof effective>;
  summary: ReturnType<typeof buildSummary>;
  signals: AssessmentSignals;
  questionnaireResponseId: string | null;
};

/** Merge a saved profile over the empty shape so new fields never come back undefined. */
export function normaliseProfile(saved: Partial<ProfileInput> | null | undefined): ProfileInput {
  const base = emptyProfile();
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    goal_priorities: saved.goal_priorities ?? {},
    performance: { ...base.performance, ...(saved.performance ?? {}), qualities: saved.performance?.qualities ?? {} },
  };
}

/** Pull assessment-derived movement signals for a session (squat observation, mobility priorities). */
export async function assessmentSignals(supabase: SupabaseClient, assessmentSessionId: string | null | undefined): Promise<AssessmentSignals> {
  if (!assessmentSessionId) return {};
  const [{ data: obs }, { data: results }] = await Promise.all([
    supabase
      .from("mobility_observations")
      .select("depth_achieved, pain_reported")
      .eq("assessment_session_id", assessmentSessionId)
      .limit(1)
      .maybeSingle(),
    supabase.from("mobility_results").select("symmetry_status").eq("assessment_session_id", assessmentSessionId),
  ]);
  const out: AssessmentSignals = {};
  if (obs?.depth_achieved) out.squat_depth = String(obs.depth_achieved);
  if (obs?.pain_reported) out.squat_pain = String(obs.pain_reported);
  out.mobility_priority_count = (results ?? []).filter((r) => r.symmetry_status === "priority").length;
  return out;
}

export async function loadProgrammingProfile(supabase: SupabaseClient, clientId: string): Promise<LoadedProfile> {
  const [{ data: row }, { data: response }] = await Promise.all([
    supabase.from("programming_profiles").select("*").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("questionnaire_responses")
      .select("id, answers, assessment_session_id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const answers = (response?.answers as Record<string, unknown> | null) ?? null;
  const typed = row as ProfileRow | null;

  const profile = typed ? normaliseProfile(typed.profile) : answers ? seedFromQuestionnaire(answers) : emptyProfile();
  const overrides: Overrides = typed?.overrides ?? {};
  const sessionId = typed?.assessment_session_id ?? (response?.assessment_session_id as string | null) ?? null;
  const signals: AssessmentSignals = { ...signalsFromAnswers(answers), ...(await assessmentSignals(supabase, sessionId)) };
  const auto = classify(profile, signals);
  const eff = effective(auto, overrides);
  return {
    row: typed,
    seeded: !typed,
    profile,
    auto,
    overrides,
    effective: eff,
    summary: buildSummary(profile, eff),
    signals,
    questionnaireResponseId: typed?.questionnaire_response_id ?? response?.id ?? null,
  };
}
