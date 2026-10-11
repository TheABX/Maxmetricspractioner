import type { SupabaseClient } from "@supabase/supabase-js";

export type LatestQuestionnaire = {
  id: string;
  answers: Record<string, unknown>;
  submitted_at: string | null;
  questionnaire_version: number;
};

export function questionnaireIsOpen(latest: { submitted_at: string | null } | null) {
  return !latest?.submitted_at;
}

export async function loadLatestQuestionnaire(supabase: SupabaseClient, clientId: string) {
  const { data } = await supabase
    .from("questionnaire_responses")
    .select("id, answers, submitted_at, questionnaire_version")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as LatestQuestionnaire | null) ?? null;
}
