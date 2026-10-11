"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildSummary, classify, effective, signalsFromAnswers } from "@/lib/programming-profile/derive";
import { assessmentSignals, normaliseProfile } from "@/lib/programming-profile/load";
import { GOALS, PROGRAM_MODES, type Overrides, type ProfileInput } from "@/lib/programming-profile/types";

async function requirePractitioner() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login");
  const meta = data.claims.user_metadata as { role?: string } | undefined;
  if (meta?.role === "client") redirect("/me");
  return { supabase, userId: String(data.claims.sub) };
}

export type SaveProfileInput = {
  client_id: string;
  questionnaire_response_id: string | null;
  assessment_session_id: string | null;
  profile: ProfileInput;
  overrides: Overrides;
  confirm?: boolean;
};

export async function saveProgrammingProfile(input: SaveProfileInput): Promise<{ ok: true; summary: string } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const profile = normaliseProfile(input.profile);
  if (!PROGRAM_MODES.includes(profile.program_mode)) return { error: "Invalid program mode." };
  if (profile.primary_goal && !GOALS.includes(profile.primary_goal)) return { error: "Invalid primary goal." };
  profile.secondary_goals = profile.secondary_goals.filter((g) => GOALS.includes(g) && g !== profile.primary_goal);

  // Strip overrides that have no value (practitioner cleared them).
  const overrides: Overrides = {};
  for (const [k, v] of Object.entries(input.overrides ?? {})) {
    if (v && v.value !== null && v.value !== undefined && String(v.value) !== "") overrides[k as keyof Overrides] = { value: v.value, reason: v.reason ?? "" };
  }

  const { data: response } = input.questionnaire_response_id
    ? await supabase.from("questionnaire_responses").select("answers").eq("id", input.questionnaire_response_id).maybeSingle()
    : { data: null };
  const signals = {
    ...signalsFromAnswers((response?.answers as Record<string, unknown> | null) ?? null),
    ...(await assessmentSignals(supabase, input.assessment_session_id)),
  };
  const auto = classify(profile, signals);
  const eff = effective(auto, overrides);
  const summary = buildSummary(profile, eff);

  const { error } = await supabase.from("programming_profiles").upsert(
    {
      practitioner_id: userId,
      client_id: input.client_id,
      questionnaire_response_id: input.questionnaire_response_id,
      assessment_session_id: input.assessment_session_id,
      program_mode: profile.program_mode,
      primary_goal: profile.primary_goal,
      training_stage: eff.training_stage,
      foundation_phase_recommended: eff.foundation_phase_recommended,
      profile,
      auto,
      overrides,
      summary: summary.text,
      ...(input.confirm ? { confirmed_at: new Date().toISOString() } : {}),
    },
    { onConflict: "client_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/clients/${input.client_id}`);
  revalidatePath(`/clients/${input.client_id}/profile`);
  return { ok: true, summary: summary.text };
}
