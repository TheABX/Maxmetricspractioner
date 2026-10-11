import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProgramStructure, type LoadedStructure } from "@/lib/structure-engine/load";
import { CATALOG, RELATIONSHIPS } from "./catalog";
import { selectWeek } from "./engine";
import { familySlugFor, type ExerciseHistorySummary, type ExerciseKb, type ExerciseRecord, type ExerciseRel, type ExSource, type ReviewStatus, type SelectionOverride, type SelectionResult } from "./types";

export type FamilyRow = { id: string; slug: string; name: string; description: string | null };
export type TagRow = { id: string; slug: string; name: string; active: boolean };

function normalizeKb(partial: Partial<ExerciseKb>, name: string): ExerciseKb {
  const fallback = CATALOG.find((c) => c.slug === partial.slug || c.name === name) ?? CATALOG[0];
  return {
    ...fallback,
    ...partial,
    name: partial.name || name || fallback.name,
    display_name: partial.display_name || partial.name || name || fallback.display_name,
    tags: partial.tags ?? fallback.tags ?? [],
    common_errors: partial.common_errors ?? "",
    video_url: partial.video_url ?? "",
    progression_potential: partial.progression_potential ?? "MODERATE",
    family_slug: partial.family_slug || familySlugFor(partial.movement_pattern ?? fallback.movement_pattern),
    ai_selection_enabled: partial.ai_selection_enabled ?? true,
    practitioner_approved: partial.practitioner_approved ?? true,
    review_status: (partial.review_status ?? "LIVE") as ReviewStatus,
    source: (partial.source ?? "CATALOG") as ExSource,
    active: partial.active !== false,
  };
}

function recordFromKb(
  id: string,
  practitioner_id: string | null,
  kb: ExerciseKb,
  extra: { family_id?: string | null; updated_at?: string | null; used_count?: number } = {},
): ExerciseRecord {
  return { ...kb, id, practitioner_id, family_id: extra.family_id ?? null, updated_at: extra.updated_at ?? null, used_count: extra.used_count ?? 0 };
}

export function rowToRecord(row: Record<string, unknown>, used = 0): ExerciseRecord | null {
  const raw = (row.kb ?? null) as Partial<ExerciseKb> | null;
  const name = String(row.name ?? raw?.name ?? "");
  if (!name && !raw?.slug) return null;
  const base = raw?.slug ? normalizeKb({ ...raw, name }, name) : CATALOG.find((c) => c.name === name || c.slug === row.slug);
  if (!base) return null;
  const catalog = Boolean(row.practitioner_id == null && (row.source === "CATALOG" || !row.source));
  return recordFromKb(String(row.id), (row.practitioner_id as string | null) ?? null, {
    ...base,
    name,
    active: row.active !== false,
    ai_selection_enabled: row.ai_selection_enabled != null ? Boolean(row.ai_selection_enabled) : (base.ai_selection_enabled ?? catalog),
    practitioner_approved: row.practitioner_approved != null ? Boolean(row.practitioner_approved) : (base.practitioner_approved ?? catalog),
    review_status: ((row.review_status as ReviewStatus) || base.review_status || (catalog ? "LIVE" : "PENDING_REVIEW")) as ReviewStatus,
    source: ((row.source as ExSource) || base.source || (catalog ? "CATALOG" : "PRACTITIONER")) as ExSource,
    video_url: String(row.video_url ?? base.video_url ?? ""),
    common_errors: String(row.common_errors ?? base.common_errors ?? ""),
    family_slug: base.family_slug,
  }, { family_id: (row.family_id as string | null) ?? null, updated_at: (row.updated_at as string | null) ?? null, used_count: used });
}

function catalogPayload(ex: ExerciseKb, familyId: string | null) {
  return {
    name: ex.name,
    slug: ex.slug,
    display_name: ex.display_name,
    description: ex.description,
    category: ex.category,
    movement_pattern: ex.movement_pattern,
    pattern: ex.legacy_pattern,
    regions: ex.primary_regions,
    equipment: ex.equipment_required.join(","),
    unilateral: ex.laterality === "UNILATERAL" || ex.laterality === "ALTERNATING",
    cues: ex.coaching_cues,
    kb: ex,
    active: true,
    practitioner_id: null,
    ai_selection_enabled: true,
    practitioner_approved: true,
    review_status: "LIVE",
    source: "CATALOG",
    family_id: familyId,
    video_url: ex.video_url || null,
    common_errors: ex.common_errors || null,
    progression_potential: ex.progression_potential,
  };
}

export async function ensureCatalog(supabase: SupabaseClient): Promise<ExerciseRecord[]> {
  const [{ data: existing }, { data: families }, { data: tags }] = await Promise.all([
    supabase.from("exercises").select("id, name, slug, practitioner_id, kb, active, pattern, unilateral, ai_selection_enabled, practitioner_approved, source, family_id"),
    supabase.from("exercise_families").select("id, slug, name, description"),
    supabase.from("exercise_tags").select("id, slug, name, active"),
  ]);
  const rows = existing ?? [];
  const familyBySlug = new Map((families ?? []).map((f) => [f.slug, f.id]));
  const needsSeed = rows.filter((r) => r.slug || (r.kb && typeof r.kb === "object" && Object.keys(r.kb as object).length)).length < CATALOG.length / 2;
  const needsFlags = rows.some((r) => r.practitioner_id == null && r.ai_selection_enabled !== true);
  for (const ex of CATALOG) {
    const found = rows.find((r) => r.slug === ex.slug || (r.practitioner_id == null && r.name === ex.name));
    const familyId = familyBySlug.get(ex.family_slug) ?? null;
    if (found && !needsSeed && found.slug && found.kb && !needsFlags) continue;
    const payload = catalogPayload(ex, familyId);
    if (found) await supabase.from("exercises").update(payload).eq("id", found.id);
    else await supabase.from("exercises").insert(payload);
  }

  const { data: fresh } = await supabase
    .from("exercises")
    .select("id, name, slug, practitioner_id, kb, active, ai_selection_enabled, practitioner_approved, review_status, source, family_id, updated_at, video_url, common_errors");
  const { data: uses } = await supabase.from("program_exercises").select("exercise_id");
  const used = new Map<string, number>();
  for (const u of uses ?? []) {
    if (!u.exercise_id) continue;
    used.set(String(u.exercise_id), (used.get(String(u.exercise_id)) ?? 0) + 1);
  }
  const library = (fresh ?? []).map((r) => rowToRecord(r, used.get(String(r.id)) ?? 0)).filter((x): x is ExerciseRecord => Boolean(x));
  const bySlug = new Map(library.map((e) => [e.slug, e.id]));

  const { data: rels } = await supabase.from("exercise_relationships").select("id");
  if (!rels?.length) {
    const inserts = RELATIONSHIPS.map((r) => {
      const from = bySlug.get(r.from_slug);
      const to = bySlug.get(r.to_slug);
      if (!from || !to) return null;
      return { from_exercise_id: from, to_exercise_id: to, relationship_type: r.type };
    }).filter((x): x is NonNullable<typeof x> => Boolean(x));
    if (inserts.length) await supabase.from("exercise_relationships").insert(inserts);
  }

  const tagBySlug = new Map((tags ?? []).map((t) => [t.slug, t.id]));
  const { data: assigned } = await supabase.from("exercise_tag_assignments").select("exercise_id");
  if (!assigned?.length) {
    const assigns: { exercise_id: string; tag_id: string }[] = [];
    for (const ex of library) {
      for (const slug of ex.tags) {
        const tagId = tagBySlug.get(slug);
        if (tagId) assigns.push({ exercise_id: ex.id, tag_id: tagId });
      }
    }
    if (assigns.length) await supabase.from("exercise_tag_assignments").insert(assigns);
  }
  return library;
}

export async function loadFamilies(supabase: SupabaseClient): Promise<FamilyRow[]> {
  const { data } = await supabase.from("exercise_families").select("id, slug, name, description").order("name");
  return (data ?? []) as FamilyRow[];
}

export async function loadTags(supabase: SupabaseClient): Promise<TagRow[]> {
  const { data } = await supabase.from("exercise_tags").select("id, slug, name, active").order("name");
  return (data ?? []) as TagRow[];
}

export async function loadRelationships(supabase: SupabaseClient, library: ExerciseRecord[]): Promise<ExerciseRel[]> {
  const { data } = await supabase.from("exercise_relationships").select("relationship_type, from_exercise_id, to_exercise_id");
  const byId = new Map(library.map((e) => [e.id, e.slug]));
  const fromDb = (data ?? [])
    .map((r) => {
      const from = byId.get(String(r.from_exercise_id));
      const to = byId.get(String(r.to_exercise_id));
      if (!from || !to) return null;
      return { from_slug: from, to_slug: to, type: r.relationship_type as ExerciseRel["type"] };
    })
    .filter((x): x is ExerciseRel => Boolean(x));
  return fromDb.length ? fromDb : RELATIONSHIPS;
}

export async function loadExerciseHistory(supabase: SupabaseClient, clientId: string): Promise<ExerciseHistorySummary[]> {
  const { data } = await supabase
    .from("set_logs")
    .select("rpe, pain_0_10, logged_at, program_exercises(exercise_id, exercise_name)")
    .eq("client_id", clientId)
    .limit(400);
  const map = new Map<string, ExerciseHistorySummary>();
  for (const row of data ?? []) {
    const pe = Array.isArray(row.program_exercises) ? row.program_exercises[0] : row.program_exercises;
    if (!pe) continue;
    const key = String(pe.exercise_id ?? pe.exercise_name);
    const cur = map.get(key) ?? {
      exercise_id: String(pe.exercise_id ?? key),
      slug: null,
      name: String(pe.exercise_name ?? ""),
      sessions_completed: 0,
      average_rpe: null,
      pain_reports: 0,
      last_prescribed: null,
    };
    cur.sessions_completed += 1;
    if (row.rpe != null) cur.average_rpe = cur.average_rpe == null ? Number(row.rpe) : (cur.average_rpe + Number(row.rpe)) / 2;
    if (row.pain_0_10 != null && Number(row.pain_0_10) >= 3) cur.pain_reports += 1;
    if (row.logged_at) cur.last_prescribed = String(row.logged_at);
    map.set(key, cur);
  }
  return [...map.values()];
}

export type SelectionRow = {
  id: string;
  client_id: string;
  auto: SelectionResult;
  overrides: SelectionOverride | null;
  selection: SelectionResult;
  confirmed_at: string | null;
  updated_at: string;
};

export type LoadedSelection = {
  structure: LoadedStructure;
  library: ExerciseRecord[];
  auto: SelectionResult;
  effective: SelectionResult;
  override: SelectionOverride | null;
  row: SelectionRow | null;
  seeded: boolean;
};

export async function loadProgramSelection(supabase: SupabaseClient, clientId: string, incoming?: SelectionOverride | null): Promise<LoadedSelection> {
  const [structure, library, history, { data: saved }] = await Promise.all([
    loadProgramStructure(supabase, clientId),
    ensureCatalog(supabase),
    loadExerciseHistory(supabase, clientId),
    supabase.from("program_selections").select("*").eq("client_id", clientId).maybeSingle(),
  ]);
  const relationships = await loadRelationships(supabase, library);
  const row = (saved as SelectionRow | null) ?? null;
  const override = incoming !== undefined ? incoming : row?.overrides ?? null;
  const shared = {
    library,
    profile: structure.priorities.profile.profile,
    effective: structure.priorities.profile.effective,
    priorities: structure.priorities.result.priorities,
    schedule: structure.effective.weekly_schedule,
    history,
    relationships,
  };
  const auto = selectWeek({ ...shared, override: null });
  const effective = selectWeek({ ...shared, override });
  return { structure, library, auto, effective, override, row, seeded: !row };
}
