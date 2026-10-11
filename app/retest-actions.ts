"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadProgrammingPriorities } from "@/lib/priority-engine/load";
import { qualityKey, type PriorityLevel, type PriorityOverrides } from "@/lib/priority-engine/types";
import { loadRetestReview } from "@/lib/retest-engine/load";
import type { RetestOverride } from "@/lib/retest-engine/types";
import { saveProgrammingPriorities } from "@/app/engine-actions";
import { sendManualMessage } from "@/app/comms-actions";

async function requirePractitioner() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login");
  const meta = data.claims.user_metadata as { role?: string } | undefined;
  if (meta?.role === "client") redirect("/me");
  return { supabase, userId: String(data.claims.sub) };
}

export async function saveRetestReview(input: {
  client_id: string;
  current_id?: string | null;
  compare_id?: string | null;
  override: RetestOverride;
  confirm?: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const loaded = await loadRetestReview(supabase, input.client_id, {
    currentId: input.current_id,
    compareId: input.compare_id,
  });
  if (!loaded.currentId) return { error: "No assessment to compare." };
  const result = {
    ...loaded.result,
    flags: [
      ...loaded.result.flags.filter((f) => f !== "CONFIRM_GOALS" && f !== "GOALS_NEED_UPDATE" && f !== "CONTEXTUAL_CHANGE"),
      ...(input.override.goals_still_current === false ? ["GOALS_NEED_UPDATE"] : []),
      ...(input.override.contextual_change.trim() ? ["CONTEXTUAL_CHANGE"] : []),
    ],
  };
  const { error } = await supabase.from("retest_reviews").upsert(
    {
      practitioner_id: userId,
      client_id: input.client_id,
      current_assessment_id: loaded.currentId,
      compare_assessment_id: loaded.compareId,
      baseline_assessment_id: loaded.baselineId,
      auto: loaded.result,
      review: result,
      overrides: input.override,
      goals_confirmed: input.override.goals_still_current,
      contextual_change: input.override.contextual_change.trim() || null,
      practitioner_notes: input.override.notes.trim() || null,
      ...(input.confirm ? { confirmed_at: new Date().toISOString() } : {}),
    },
    { onConflict: "client_id,current_assessment_id,compare_assessment_id" },
  );
  if (error) return { error: error.message };

  if (input.confirm && loaded.currentId) {
    await supabase.from("priority_history").delete().eq("client_id", input.client_id).eq("assessment_session_id", loaded.currentId);
    if (result.priority_outcomes.length) {
      await supabase.from("priority_history").insert(
        result.priority_outcomes.map((o) => ({
          practitioner_id: userId,
          client_id: input.client_id,
          assessment_session_id: loaded.currentId,
          quality: o.quality,
          laterality: o.laterality,
          priority_level: o.suggested_level,
          outcome: o.outcome,
          reasons: o.why,
        })),
      );
    }
    if (result.comms_draft && !input.override.suppress_comms) {
      await sendManualMessage({ client_id: input.client_id, text: result.comms_draft }).catch(() => null);
    }
  }

  revalidatePath(`/clients/${input.client_id}`);
  revalidatePath(`/clients/${input.client_id}/retest`);
  revalidatePath(`/clients/${input.client_id}/priorities`);
  revalidatePath("/me/progress");
  return { ok: true };
}

export async function applyNextBlockPriorities(clientId: string, currentId?: string | null, compareId?: string | null): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await requirePractitioner();
  const loaded = await loadRetestReview(supabase, clientId, { currentId, compareId });
  const current = await loadProgrammingPriorities(supabase, clientId);
  const overrides: PriorityOverrides = { ...(current.row?.overrides ?? {}) };
  for (const item of loaded.result.next_block) {
    const match = current.result.priorities.find((p) => p.quality === item.quality && p.laterality === item.laterality)
      ?? current.result.priorities.find((p) => p.quality === item.quality);
    if (!match) continue;
    if (match.effective_priority === item.level) continue;
    overrides[qualityKey(match)] = {
      value: item.level as PriorityLevel,
      reason: item.why[0] ?? `Layer 8 ${item.source.replaceAll("_", " ").toLowerCase()}`,
      date: new Date().toISOString(),
      overridden_by: "layer8",
    };
  }
  return saveProgrammingPriorities({ client_id: clientId, overrides });
}

export async function saveRetestDate(input: { client_id: string; program_id: string | null; date: string; kind?: "FULL_BLOCK" | "INTERIM"; notes?: string }): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  if (input.program_id) {
    const { error } = await supabase.from("programs").update({ expected_retest_date: input.date }).eq("id", input.program_id);
    if (error) return { error: error.message };
  }
  const { error } = await supabase.from("retest_schedules").insert({
    practitioner_id: userId,
    client_id: input.client_id,
    program_id: input.program_id,
    expected_retest_date: input.date,
    kind: input.kind ?? "FULL_BLOCK",
    notes: input.notes ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/clients/${input.client_id}/retest`);
  return { ok: true };
}
