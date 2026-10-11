"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadProgrammingPriorities } from "@/lib/priority-engine/load";
import type { PriorityLevel, PriorityOverrides } from "@/lib/priority-engine/types";
import { loadProgramStructure } from "@/lib/structure-engine/load";
import type { StructureOverride } from "@/lib/structure-engine/types";
import { ensureCatalog, loadProgramSelection } from "@/lib/exercise-kb/load";
import type { ExerciseKb, SelectionOverride } from "@/lib/exercise-kb/types";
import { loadProgramDosage } from "@/lib/dosage-engine/load";
import type { DoseOverride } from "@/lib/dosage-engine/types";
import { loadProgramAdaptation } from "@/lib/adaptation-engine/load";
import type { AdaptationOverride, QueueStatus } from "@/lib/adaptation-engine/types";

async function requirePractitioner() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login");
  const meta = data.claims.user_metadata as { role?: string } | undefined;
  if (meta?.role === "client") redirect("/me");
  return { supabase, userId: String(data.claims.sub) };
}

export async function saveProgrammingPriorities(input: {
  client_id: string;
  overrides: PriorityOverrides;
  confirm?: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const loaded = await loadProgrammingPriorities(supabase, input.client_id, input.overrides);
  const { error } = await supabase.from("programming_priorities").upsert(
    {
      practitioner_id: userId,
      client_id: input.client_id,
      assessment_session_id: loaded.sessionId,
      programming_profile_id: loaded.profile.row?.id ?? null,
      findings: loaded.result.findings,
      priorities: loaded.result.priorities,
      auto: loaded.result,
      overrides: input.overrides,
      summary: loaded.result.priorities
        .filter((p) => p.effective_priority === "P1_PRIMARY" || p.effective_priority === "P2_SECONDARY")
        .map((p) => `${p.effective_priority} ${p.quality}`)
        .join(" · "),
      ...(input.confirm ? { confirmed_at: new Date().toISOString() } : {}),
    },
    { onConflict: "client_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/clients/${input.client_id}`);
  revalidatePath(`/clients/${input.client_id}/priorities`);
  revalidatePath(`/clients/${input.client_id}/structure`);
  revalidatePath(`/clients/${input.client_id}/dosage`);
  return { ok: true };
}

export async function overridePriority(form: {
  client_id: string;
  key: string;
  value: PriorityLevel | "";
  reason: string;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const loaded = await loadProgrammingPriorities(supabase, form.client_id);
  const overrides: PriorityOverrides = { ...(loaded.row?.overrides ?? {}) };
  if (!form.value) delete overrides[form.key];
  else {
    overrides[form.key] = {
      value: form.value,
      reason: form.reason,
      date: new Date().toISOString(),
      overridden_by: userId,
    };
  }
  return saveProgrammingPriorities({ client_id: form.client_id, overrides });
}

export async function saveProgramStructure(input: {
  client_id: string;
  override: StructureOverride | null;
  confirm?: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const loaded = await loadProgramStructure(supabase, input.client_id, input.override);
  const { data: pri } = await supabase.from("programming_priorities").select("id").eq("client_id", input.client_id).maybeSingle();
  const { error } = await supabase.from("program_structures").upsert(
    {
      practitioner_id: userId,
      client_id: input.client_id,
      programming_priorities_id: pri?.id ?? null,
      auto: loaded.auto,
      overrides: input.override,
      structure: loaded.effective,
      rationale: loaded.effective.practitioner_rationale,
      constraint_flags: loaded.effective.constraint_flags,
      ...(input.confirm ? { confirmed_at: new Date().toISOString() } : {}),
    },
    { onConflict: "client_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/clients/${input.client_id}`);
  revalidatePath(`/clients/${input.client_id}/structure`);
  revalidatePath(`/clients/${input.client_id}/selection`);
  revalidatePath(`/clients/${input.client_id}/dosage`);
  return { ok: true };
}

export async function saveProgramSelection(input: {
  client_id: string;
  override: SelectionOverride | null;
  confirm?: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const loaded = await loadProgramSelection(supabase, input.client_id, input.override);
  const { error } = await supabase.from("program_selections").upsert(
    {
      practitioner_id: userId,
      client_id: input.client_id,
      auto: loaded.auto,
      overrides: input.override,
      selection: loaded.effective,
      rationale: loaded.effective.rationale,
      ...(input.confirm ? { confirmed_at: new Date().toISOString() } : {}),
    },
    { onConflict: "client_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/clients/${input.client_id}`);
  revalidatePath(`/clients/${input.client_id}/selection`);
  revalidatePath(`/clients/${input.client_id}/dosage`);
  revalidatePath(`/clients/${input.client_id}/adaptation`);
  return { ok: true };
}

export async function saveProgramDosage(input: {
  client_id: string;
  override: DoseOverride | null;
  confirm?: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const loaded = await loadProgramDosage(supabase, input.client_id, input.override);
  const { error } = await supabase.from("program_dosages").upsert(
    {
      practitioner_id: userId,
      client_id: input.client_id,
      auto: loaded.auto,
      overrides: input.override,
      dosage: loaded.effective,
      rationale: loaded.effective.rationale,
      flags: loaded.effective.flags,
      ...(input.confirm ? { confirmed_at: new Date().toISOString() } : {}),
    },
    { onConflict: "client_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/clients/${input.client_id}`);
  revalidatePath(`/clients/${input.client_id}/dosage`);
  revalidatePath(`/clients/${input.client_id}/adaptation`);
  revalidatePath(`/programs`);
  return { ok: true };
}

export async function saveProgramAdaptation(input: {
  client_id: string;
  override: AdaptationOverride | null;
  confirm?: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const loaded = await loadProgramAdaptation(supabase, input.client_id, input.override);
  const { error } = await supabase.from("program_adaptations").upsert(
    {
      practitioner_id: userId,
      client_id: input.client_id,
      auto: loaded.auto,
      overrides: input.override,
      adaptation: loaded.effective,
      rationale: loaded.effective.rationale,
      flags: loaded.effective.flags,
      automation_level: loaded.effective.automation_level,
      ...(input.confirm ? { confirmed_at: new Date().toISOString() } : {}),
    },
    { onConflict: "client_id" },
  );
  if (error) return { error: error.message };
  await supabase.from("adaptation_queue").delete().eq("client_id", input.client_id).eq("status", "NEW");
  if (loaded.effective.client.queue.length) {
    await supabase.from("adaptation_queue").insert(
      loaded.effective.client.queue.map((q) => ({
        practitioner_id: userId,
        client_id: input.client_id,
        slot_id: q.slot_id,
        exercise_name: q.exercise_name,
        severity: q.severity,
        trigger: q.trigger,
        issue: q.issue,
        suggested_action: q.suggested_action,
        draft_message: q.draft_message,
        status: "NEW",
      })),
    );
  }
  revalidatePath(`/clients/${input.client_id}`);
  revalidatePath(`/clients/${input.client_id}/adaptation`);
  revalidatePath(`/clients/${input.client_id}/messages`);
  revalidatePath("/adaptations");
  const { generateClientComms } = await import("@/app/comms-actions");
  await generateClientComms(input.client_id).catch(() => null);
  return { ok: true };
}

export async function setQueueStatus(input: { id: string; status: QueueStatus }): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await requirePractitioner();
  const { error } = await supabase.from("adaptation_queue").update({ status: input.status }).eq("id", input.id);
  if (error) return { error: error.message };
  revalidatePath("/adaptations");
  return { ok: true };
}

export async function seedExerciseCatalog(): Promise<void> {
  const { supabase } = await requirePractitioner();
  await ensureCatalog(supabase);
  revalidatePath("/exercises");
}

export async function saveExerciseKb(input: {
  id?: string;
  kb: ExerciseKb;
  related?: { regressions: string[]; progressions: string[]; alternatives: string[]; similar: string[] };
  tagIds?: string[];
  familyId?: string | null;
}): Promise<{ ok: true; id?: string } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const kb = input.kb;
  const isNew = !input.id;
  const payload = {
    name: kb.name,
    slug: kb.slug,
    display_name: kb.display_name || kb.name,
    description: kb.description,
    category: kb.category,
    movement_pattern: kb.movement_pattern,
    pattern: kb.legacy_pattern,
    regions: kb.primary_regions,
    equipment: kb.equipment_required.join(","),
    unilateral: kb.laterality === "UNILATERAL" || kb.laterality === "ALTERNATING",
    cues: kb.coaching_cues,
    video_url: kb.video_url || null,
    common_errors: kb.common_errors || null,
    progression_potential: kb.progression_potential,
    kb,
    active: kb.active,
    ai_selection_enabled: isNew ? false : kb.ai_selection_enabled,
    practitioner_approved: isNew ? false : kb.practitioner_approved,
    review_status: isNew ? "PENDING_REVIEW" : kb.review_status,
    source: isNew ? "PRACTITIONER" : kb.source,
    family_id: input.familyId ?? null,
  };
  let id = input.id;
  if (id) {
    const { error } = await supabase.from("exercises").update(payload).eq("id", id);
    if (error) return { error: error.message };
    await supabase.from("exercise_library_audit").insert({ exercise_id: id, changed_by: userId, field_changed: "save", old_value: null, new_value: kb.name });
  } else {
    const { data, error } = await supabase.from("exercises").insert({ ...payload, practitioner_id: userId }).select("id").single();
    if (error) return { error: error.message };
    id = data.id;
    await supabase.from("exercise_library_audit").insert({ exercise_id: id, changed_by: userId, field_changed: "create", old_value: null, new_value: kb.name });
  }
  if (id && input.related) {
    const { data: others } = await supabase.from("exercises").select("id, slug");
    const bySlug = new Map((others ?? []).map((r) => [String(r.slug), String(r.id)]));
    await supabase.from("exercise_relationships").delete().eq("from_exercise_id", id);
    const rows = [
      ...input.related.regressions.map((slug) => ({ type: "REGRESSION" as const, slug })),
      ...input.related.progressions.map((slug) => ({ type: "PROGRESSION" as const, slug })),
      ...input.related.alternatives.map((slug) => ({ type: "ALTERNATIVE" as const, slug })),
      ...(input.related.similar ?? []).map((slug) => ({ type: "SIMILAR_STIMULUS" as const, slug })),
    ]
      .map((r) => {
        const to = bySlug.get(r.slug);
        if (!to || to === id) return null;
        return { from_exercise_id: id, to_exercise_id: to, relationship_type: r.type };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    if (rows.length) {
      const { error } = await supabase.from("exercise_relationships").insert(rows);
      if (error) return { error: error.message };
    }
  }
  if (id && input.tagIds) {
    await supabase.from("exercise_tag_assignments").delete().eq("exercise_id", id);
    if (input.tagIds.length) {
      await supabase.from("exercise_tag_assignments").insert(input.tagIds.map((tag_id) => ({ exercise_id: id, tag_id })));
    }
  }
  revalidatePath("/exercises");
  if (id) revalidatePath(`/exercises/${id}`);
  return { ok: true, id };
}
