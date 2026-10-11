import type { SupabaseClient } from "@supabase/supabase-js";
import { derivePrefs, nutritionComplete, pickNutritionAnswers } from "./questionnaire";
import { computeTargets } from "./targets";
import type { Anthropometrics, EnergyTargets, FavoriteMeal, NutritionEntry, NutritionPrefs } from "./types";

export type NutritionProfileRow = {
  id: string;
  client_id: string;
  answers: Record<string, unknown>;
  goal: string;
  tdee_kcal: number | null;
  target_kcal: number | null;
  target_protein_g: number | null;
  target_carb_g: number | null;
  target_fat_g: number | null;
  updated_at: string;
};

export type LoadedNutrition = {
  prefs: NutritionPrefs;
  answers: Record<string, unknown>;
  complete: boolean;
  targets: EnergyTargets;
  anthro: Anthropometrics;
  activityLevel: string | null;
  profile: NutritionProfileRow | null;
  entries: NutritionEntry[];
  favorites: FavoriteMeal[];
};

function anthroFromClient(row: {
  sex?: string | null;
  dob?: string | null;
  height_cm?: number | null;
  bodyweight_kg?: number | null;
} | null): Anthropometrics {
  return {
    sex: row?.sex ?? null,
    dob: row?.dob ?? null,
    heightCm: row?.height_cm != null ? Number(row.height_cm) : null,
    bodyweightKg: row?.bodyweight_kg != null ? Number(row.bodyweight_kg) : null,
  };
}

export async function loadNutrition(
  supabase: SupabaseClient,
  clientId: string,
  date: string,
): Promise<LoadedNutrition> {
  const [{ data: client }, { data: latestQ }, { data: profile }, { data: entries }, { data: favorites }] = await Promise.all([
    supabase.from("clients").select("sex, dob, height_cm, bodyweight_kg").eq("id", clientId).maybeSingle(),
    supabase
      .from("questionnaire_responses")
      .select("answers")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("nutrition_profiles").select("*").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("nutrition_entries")
      .select("id, entry_date, slot, kind, meal_slug, servings, source, custom_name, kcal, protein_g, carb_g, fat_g, photo_path, estimate")
      .eq("client_id", clientId)
      .eq("entry_date", date)
      .order("created_at"),
    supabase
      .from("nutrition_favorites")
      .select("id, slot, source, meal_slug, custom_name, kcal, protein_g, carb_g, fat_g, photo_path, estimate")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  ]);

  const qAnswers = (latestQ?.answers as Record<string, unknown> | null) ?? {};
  const profileAnswers = (profile?.answers as Record<string, unknown> | null) ?? {};
  const answers = { ...qAnswers, ...profileAnswers };
  const prefs = derivePrefs(answers);
  const anthro = anthroFromClient(client);
  const activityLevel = String(qAnswers.activity_level ?? "") || null;
  const trainingDays = Number(qAnswers.days_per_week ?? 0);
  const targets = computeTargets({
    anthro,
    prefs,
    activityLevel,
    trainingDays: Number.isFinite(trainingDays) ? trainingDays : 0,
  });

  return {
    prefs,
    answers,
    complete: nutritionComplete(answers),
    targets,
    anthro,
    activityLevel,
    profile: (profile as NutritionProfileRow | null) ?? null,
    entries: (entries ?? []) as NutritionEntry[],
    favorites: (favorites ?? []) as FavoriteMeal[],
  };
}

export async function upsertNutritionProfile(
  supabase: SupabaseClient,
  input: {
    clientId: string;
    practitionerId: string;
    answers: Record<string, unknown>;
    questionnaireResponseId?: string | null;
  },
) {
  const { data: client } = await supabase
    .from("clients")
    .select("sex, dob, height_cm, bodyweight_kg")
    .eq("id", input.clientId)
    .maybeSingle();
  const prefs = derivePrefs(input.answers);
  const qActivity = String(input.answers.activity_level ?? "") || null;
  const trainingDays = Number(input.answers.days_per_week ?? 0);
  const targets = computeTargets({
    anthro: anthroFromClient(client),
    prefs,
    activityLevel: qActivity,
    trainingDays: Number.isFinite(trainingDays) ? trainingDays : 0,
  });
  const payload = {
    practitioner_id: input.practitionerId,
    client_id: input.clientId,
    questionnaire_response_id: input.questionnaireResponseId ?? null,
    answers: pickNutritionAnswers(input.answers),
    goal: prefs.goal,
    tdee_kcal: targets.tdee,
    target_kcal: targets.targetKcal,
    target_protein_g: targets.proteinG,
    target_carb_g: targets.carbG,
    target_fat_g: targets.fatG,
  };
  const { error } = await supabase.from("nutrition_profiles").upsert(payload, { onConflict: "client_id" });
  return { error, targets, prefs };
}

export function calendarDate(timeZone = "Australia/Sydney") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function mealPhotoUrls(supabase: SupabaseClient, entries: NutritionEntry[]) {
  const urls: Record<string, string> = {};
  await Promise.all(
    entries
      .filter((e) => e.photo_path)
      .map(async (e) => {
        const { data } = await supabase.storage.from("meal-photos").createSignedUrl(e.photo_path as string, 60 * 60);
        if (data?.signedUrl) urls[e.id] = data.signedUrl;
      }),
  );
  return urls;
}

export function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
