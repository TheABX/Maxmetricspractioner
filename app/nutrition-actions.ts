"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveViewer } from "@/lib/auth/role";
import { NUTRITION_SECTIONS } from "@/lib/nutrition/questionnaire";
import { upsertNutritionProfile } from "@/lib/nutrition/load";
import { estimateMealFromImage } from "@/lib/nutrition/vision";
import { matchingFavorite, payloadFromEntry } from "@/lib/nutrition/favorites";
import type { EntryKind, FavoriteMeal, MealSlot, PhotoEstimate } from "@/lib/nutrition/types";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function requireClient() {
  const supabase = await createClient();
  const viewer = await resolveViewer(supabase);
  if (viewer.role === "anonymous") redirect("/join");
  if (viewer.role === "unlinked") redirect("/join?unlinked=1");
  if (viewer.role !== "client") redirect("/");
  return { supabase, viewer };
}

async function practitionerId(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string) {
  const { data } = await supabase.from("clients").select("practitioner_id").eq("id", clientId).single();
  return data?.practitioner_id as string | undefined;
}

function refresh(date?: string) {
  revalidatePath("/me/nutrition");
  revalidatePath("/me");
  if (date) revalidatePath(`/me/nutrition?date=${date}`);
}

export async function submitNutritionPreferences(formData: FormData) {
  const { supabase, viewer } = await requireClient();
  const nutrition: Record<string, unknown> = {};
  for (const section of NUTRITION_SECTIONS) {
    for (const field of section.fields) {
      if (field.type === "multi") nutrition[field.key] = formData.getAll(field.key).map(String).filter(Boolean);
      else {
        const v = String(formData.get(field.key) ?? "").trim();
        nutrition[field.key] = v || null;
      }
    }
  }
  const { data: latest } = await supabase
    .from("questionnaire_responses")
    .select("id, answers")
    .eq("client_id", viewer.clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const merged = { ...((latest?.answers as Record<string, unknown>) ?? {}), ...nutrition };
  if (latest?.id) {
    const { error } = await supabase.from("questionnaire_responses").update({ answers: merged }).eq("id", latest.id);
    if (error) return { error: error.message };
  }
  const pid = await practitionerId(supabase, viewer.clientId);
  if (!pid) return { error: "Client record not found." };
  const { error } = await upsertNutritionProfile(supabase, {
    clientId: viewer.clientId,
    practitionerId: pid,
    answers: merged,
    questionnaireResponseId: latest?.id ?? null,
  });
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: "Preferences saved." };
}

export async function chooseMeal(input: { date: string; slot: MealSlot; kind: EntryKind; mealSlug: string }) {
  const { supabase, viewer } = await requireClient();
  const pid = await practitionerId(supabase, viewer.clientId);
  if (!pid) return { error: "Client record not found." };
  if (input.kind === "plan" && input.slot !== "snack") {
    await supabase
      .from("nutrition_entries")
      .delete()
      .eq("client_id", viewer.clientId)
      .eq("entry_date", input.date)
      .eq("slot", input.slot)
      .eq("kind", "plan");
  }
  const { error } = await supabase.from("nutrition_entries").insert({
    practitioner_id: pid,
    client_id: viewer.clientId,
    entry_date: input.date,
    slot: input.slot,
    kind: input.kind,
    meal_slug: input.mealSlug,
    servings: 1,
  });
  if (error) return { error: error.message };
  refresh(input.date);
  return { ok: true };
}

export async function removeNutritionEntry(id: string, date: string) {
  const { supabase, viewer } = await requireClient();
  const { data: row } = await supabase
    .from("nutrition_entries")
    .select("photo_path")
    .eq("id", id)
    .eq("client_id", viewer.clientId)
    .maybeSingle();
  const { error } = await supabase.from("nutrition_entries").delete().eq("id", id).eq("client_id", viewer.clientId);
  if (error) return { error: error.message };
  if (row?.photo_path) {
    const [{ count: favCount }, { count: entryCount }] = await Promise.all([
      supabase.from("nutrition_favorites").select("id", { count: "exact", head: true }).eq("client_id", viewer.clientId).eq("photo_path", row.photo_path),
      supabase.from("nutrition_entries").select("id", { count: "exact", head: true }).eq("client_id", viewer.clientId).eq("photo_path", row.photo_path),
    ]);
    if (!favCount && !entryCount) await supabase.storage.from("meal-photos").remove([row.photo_path]);
  }
  refresh(date);
  return { ok: true };
}

export async function estimateMealPhoto(formData: FormData) {
  const { supabase, viewer } = await requireClient();
  const file = formData.get("photo");
  const date = String(formData.get("date") ?? "");
  const slot = String(formData.get("slot") ?? "") as MealSlot;
  if (!(file instanceof File) || file.size < 32) return { error: "Choose a photo of the meal first." };
  if (file.size > 8 * 1024 * 1024) return { error: "Keep the photo under 8 MB." };
  const mime = PHOTO_TYPES.has(file.type) ? file.type : "image/jpeg";
  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `${viewer.clientId}/${date || "undated"}/${slot || "meal"}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage.from("meal-photos").upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });
  if (uploadError) return { error: uploadError.message };
  const { data: signed } = await supabase.storage.from("meal-photos").createSignedUrl(path, 60 * 20);
  try {
    const estimate = await estimateMealFromImage(buffer.toString("base64"), mime);
    if (estimate.not_food) {
      return {
        error: "That photo does not look like a meal or snack. Try a closer shot of the plate.",
        photoPath: path,
        previewUrl: signed?.signedUrl ?? null,
      };
    }
    return { ok: true as const, estimate, photoPath: path, previewUrl: signed?.signedUrl ?? null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not estimate that photo.",
      photoPath: path,
      previewUrl: signed?.signedUrl ?? null,
    };
  }
}

export async function confirmMealPhoto(input: {
  date: string;
  slot: MealSlot;
  kind: EntryKind;
  photoPath: string;
  estimate: PhotoEstimate;
}) {
  const { supabase, viewer } = await requireClient();
  const pid = await practitionerId(supabase, viewer.clientId);
  if (!pid) return { error: "Client record not found." };
  if (input.kind === "plan" && input.slot !== "snack") {
    await supabase
      .from("nutrition_entries")
      .delete()
      .eq("client_id", viewer.clientId)
      .eq("entry_date", input.date)
      .eq("slot", input.slot)
      .eq("kind", "plan");
  }
  const estimate = input.estimate;
  const { error } = await supabase.from("nutrition_entries").insert({
    practitioner_id: pid,
    client_id: viewer.clientId,
    entry_date: input.date,
    slot: input.slot,
    kind: input.kind,
    meal_slug: "photo",
    servings: 1,
    source: "photo",
    custom_name: estimate.name,
    kcal: estimate.kcal,
    protein_g: estimate.protein_g,
    carb_g: estimate.carb_g,
    fat_g: estimate.fat_g,
    photo_path: input.photoPath,
    estimate,
  });
  if (error) return { error: error.message };
  refresh(input.date);
  return { ok: true };
}

export async function logWhatIPlanned(date: string) {
  const { supabase, viewer } = await requireClient();
  const pid = await practitionerId(supabase, viewer.clientId);
  if (!pid) return { error: "Client record not found." };
  const { data: planned } = await supabase
    .from("nutrition_entries")
    .select("slot, meal_slug, servings, source, custom_name, kcal, protein_g, carb_g, fat_g, photo_path, estimate")
    .eq("client_id", viewer.clientId)
    .eq("entry_date", date)
    .eq("kind", "plan");
  if (!planned?.length) return { error: "Nothing planned for this day yet." };
  const { error } = await supabase.from("nutrition_entries").insert(
    planned.map((p) => ({
      practitioner_id: pid,
      client_id: viewer.clientId,
      entry_date: date,
      slot: p.slot,
      kind: "log" as const,
      meal_slug: p.meal_slug,
      servings: p.servings ?? 1,
      source: p.source ?? "library",
      custom_name: p.custom_name,
      kcal: p.kcal,
      protein_g: p.protein_g,
      carb_g: p.carb_g,
      fat_g: p.fat_g,
      photo_path: p.photo_path,
      estimate: p.estimate ?? {},
    })),
  );
  if (error) return { error: error.message };
  refresh(date);
  return { ok: true, message: "Logged what you planned." };
}

export async function toggleFavorite(entryId: string, date: string) {
  const { supabase, viewer } = await requireClient();
  const pid = await practitionerId(supabase, viewer.clientId);
  if (!pid) return { error: "Client record not found." };
  const { data: entry } = await supabase
    .from("nutrition_entries")
    .select("id, slot, kind, meal_slug, source, custom_name, kcal, protein_g, carb_g, fat_g, photo_path, estimate")
    .eq("id", entryId)
    .eq("client_id", viewer.clientId)
    .maybeSingle();
  if (!entry) return { error: "Meal not found." };
  const { data: favorites } = await supabase
    .from("nutrition_favorites")
    .select("id, slot, source, meal_slug, custom_name, kcal, protein_g, carb_g, fat_g, photo_path, estimate")
    .eq("client_id", viewer.clientId);
  const existing = matchingFavorite((favorites ?? []) as FavoriteMeal[], entry as never);
  if (existing) {
    const { error } = await supabase.from("nutrition_favorites").delete().eq("id", existing.id).eq("client_id", viewer.clientId);
    if (error) return { error: error.message };
    refresh(date);
    return { ok: true };
  }
  const payload = payloadFromEntry(entry as never, entry.slot as MealSlot);
  const { error } = await supabase.from("nutrition_favorites").insert({
    practitioner_id: pid,
    client_id: viewer.clientId,
    ...payload,
  });
  if (error && error.code !== "23505") return { error: error.message };
  refresh(date);
  return { ok: true };
}

export async function chooseFavorite(input: { date: string; slot: MealSlot; kind: EntryKind; favoriteId: string }) {
  const { supabase, viewer } = await requireClient();
  const pid = await practitionerId(supabase, viewer.clientId);
  if (!pid) return { error: "Client record not found." };
  const { data: fav } = await supabase
    .from("nutrition_favorites")
    .select("*")
    .eq("id", input.favoriteId)
    .eq("client_id", viewer.clientId)
    .maybeSingle();
  if (!fav) return { error: "Favourite not found." };
  if (fav.source === "library") {
    return chooseMeal({ date: input.date, slot: input.slot, kind: input.kind, mealSlug: fav.meal_slug });
  }
  if (input.kind === "plan" && input.slot !== "snack") {
    await supabase
      .from("nutrition_entries")
      .delete()
      .eq("client_id", viewer.clientId)
      .eq("entry_date", input.date)
      .eq("slot", input.slot)
      .eq("kind", "plan");
  }
  const { error } = await supabase.from("nutrition_entries").insert({
    practitioner_id: pid,
    client_id: viewer.clientId,
    entry_date: input.date,
    slot: input.slot,
    kind: input.kind,
    meal_slug: fav.meal_slug || "photo",
    servings: 1,
    source: "favorite",
    custom_name: fav.custom_name,
    kcal: fav.kcal,
    protein_g: fav.protein_g,
    carb_g: fav.carb_g,
    fat_g: fav.fat_g,
    photo_path: fav.photo_path,
    estimate: fav.estimate ?? {},
  });
  if (error) return { error: error.message };
  refresh(input.date);
  return { ok: true };
}
