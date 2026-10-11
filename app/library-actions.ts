"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ExerciseKb } from "@/lib/exercise-kb/types";

async function requirePractitioner() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login");
  const meta = data.claims.user_metadata as { role?: string } | undefined;
  if (meta?.role === "client") redirect("/me");
  return { supabase, userId: String(data.claims.sub) };
}

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  exerciseId: string,
  field: string,
  oldValue: unknown,
  newValue: unknown,
) {
  await supabase.from("exercise_library_audit").insert({
    exercise_id: exerciseId,
    changed_by: userId,
    field_changed: field,
    old_value: oldValue == null ? null : String(oldValue),
    new_value: newValue == null ? null : String(newValue),
  });
}

function refresh() {
  revalidatePath("/exercises");
  revalidatePath("/programs");
}

export async function setExerciseFlag(input: {
  id: string;
  field: "active" | "ai_selection_enabled" | "practitioner_approved";
  value: boolean;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const { data: current } = await supabase.from("exercises").select("active, ai_selection_enabled, practitioner_approved").eq("id", input.id).single();
  const patch: Record<string, unknown> = { [input.field]: input.value };
  if (input.field === "practitioner_approved" && input.value) patch.review_status = "LIVE";
  if (input.field === "practitioner_approved" && !input.value) {
    patch.review_status = "PENDING_REVIEW";
    patch.ai_selection_enabled = false;
  }
  const { error } = await supabase.from("exercises").update(patch).eq("id", input.id);
  if (error) return { error: error.message };
  await audit(supabase, userId, input.id, input.field, current?.[input.field], input.value);
  refresh();
  revalidatePath(`/exercises/${input.id}`);
  return { ok: true };
}

export async function bulkUpdateExercises(input: {
  ids: string[];
  patch: Partial<{
    active: boolean;
    ai_selection_enabled: boolean;
    practitioner_approved: boolean;
    category: string;
    family_id: string | null;
  }>;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  if (!input.ids.length) return { error: "No exercises selected." };
  const patch = { ...input.patch } as Record<string, unknown>;
  if (patch.practitioner_approved === true) patch.review_status = "LIVE";
  if (patch.practitioner_approved === false) {
    patch.review_status = "PENDING_REVIEW";
    patch.ai_selection_enabled = false;
  }
  const { error } = await supabase.from("exercises").update(patch).in("id", input.ids);
  if (error) return { error: error.message };
  for (const id of input.ids) {
    for (const [field, value] of Object.entries(input.patch)) {
      await audit(supabase, userId, id, `bulk.${field}`, null, value);
    }
  }
  refresh();
  return { ok: true };
}

export async function duplicateExercise(id: string): Promise<{ ok: true; id: string } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const { data: row, error } = await supabase.from("exercises").select("*").eq("id", id).single();
  if (error || !row) return { error: error?.message ?? "Exercise not found." };
  const kb = { ...((row.kb as ExerciseKb) ?? {}), name: `${row.name} (Copy)`, display_name: `${row.display_name || row.name} (Copy)`, slug: `${row.slug || "exercise"}_copy`, ai_selection_enabled: false, practitioner_approved: false, review_status: "PENDING_REVIEW", source: "PRACTITIONER" } as ExerciseKb;
  const { data: created, error: ins } = await supabase
    .from("exercises")
    .insert({
      practitioner_id: userId,
      name: kb.name,
      slug: `${row.slug || "exercise"}_copy_${Date.now().toString(36)}`,
      display_name: kb.display_name,
      description: row.description,
      category: row.category,
      movement_pattern: row.movement_pattern,
      pattern: row.pattern,
      regions: row.regions,
      equipment: row.equipment,
      unilateral: row.unilateral,
      video_url: row.video_url,
      cues: row.cues,
      kb,
      active: true,
      ai_selection_enabled: false,
      practitioner_approved: false,
      review_status: "PENDING_REVIEW",
      source: "PRACTITIONER",
      family_id: row.family_id,
    })
    .select("id")
    .single();
  if (ins || !created) return { error: ins?.message ?? "Could not duplicate." };
  await audit(supabase, userId, created.id, "duplicate", id, created.id);
  refresh();
  return { ok: true, id: created.id };
}

export async function deactivateExercise(id: string): Promise<{ ok: true } | { error: string }> {
  return setExerciseFlag({ id, field: "active", value: false });
}

export async function deleteExercise(id: string): Promise<{ ok: true } | { error: string; used?: true }> {
  const { supabase, userId } = await requirePractitioner();
  const { count } = await supabase.from("program_exercises").select("id", { count: "exact", head: true }).eq("exercise_id", id);
  if ((count ?? 0) > 0) {
    return { error: "This exercise has historical usage and cannot be permanently deleted. Deactivate it instead.", used: true };
  }
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) return { error: error.message };
  await audit(supabase, userId, id, "delete", id, null);
  refresh();
  return { ok: true };
}

export async function saveTag(input: { id?: string; name: string; slug?: string; active?: boolean }): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await requirePractitioner();
  const slug = (input.slug || input.name).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (input.id) {
    const { error } = await supabase.from("exercise_tags").update({ name: input.name, slug, active: input.active !== false }).eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("exercise_tags").insert({ name: input.name, slug, active: true });
    if (error) return { error: error.message };
  }
  revalidatePath("/exercises/tags");
  revalidatePath("/exercises");
  return { ok: true };
}

export async function deactivateTag(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await requirePractitioner();
  const { error } = await supabase.from("exercise_tags").update({ active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/exercises/tags");
  return { ok: true };
}

export async function setExerciseTags(exerciseId: string, tagIds: string[]): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await requirePractitioner();
  await supabase.from("exercise_tag_assignments").delete().eq("exercise_id", exerciseId);
  if (tagIds.length) {
    const { error } = await supabase.from("exercise_tag_assignments").insert(tagIds.map((tag_id) => ({ exercise_id: exerciseId, tag_id })));
    if (error) return { error: error.message };
  }
  revalidatePath(`/exercises/${exerciseId}`);
  return { ok: true };
}

export async function setClientMastery(input: {
  client_id: string;
  exercise_id: string;
  mastery_level: string;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const { error } = await supabase.from("client_exercise_mastery").upsert(
    {
      practitioner_id: userId,
      client_id: input.client_id,
      exercise_id: input.exercise_id,
      mastery_level: input.mastery_level,
      last_assessed: new Date().toISOString(),
      source: "PRACTITIONER",
      practitioner_override: true,
    },
    { onConflict: "client_id,exercise_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/exercises/${input.exercise_id}`);
  return { ok: true };
}

