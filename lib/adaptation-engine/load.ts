import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProgramDosage, type LoadedDosage } from "@/lib/dosage-engine/load";
import type { Prescription } from "@/lib/dosage-engine/types";
import type { MasteryLevel } from "@/lib/exercise-kb/types";
import { adaptWeek, groupExposures } from "./engine";
import type {
  AdaptationOverride,
  AdaptationResult,
  Exposure,
  LoggedSession,
} from "./types";

export type AdaptationRow = {
  id: string;
  client_id: string;
  auto: AdaptationResult;
  overrides: AdaptationOverride | null;
  adaptation: AdaptationResult;
  rationale: string[] | null;
  flags: string[] | null;
  automation_level: string | null;
  confirmed_at: string | null;
  updated_at: string;
};

export type LoadedAdaptation = {
  dosage: LoadedDosage;
  auto: AdaptationResult;
  effective: AdaptationResult;
  override: AdaptationOverride | null;
  row: AdaptationRow | null;
  seeded: boolean;
};

export async function loadProgramAdaptation(
  supabase: SupabaseClient,
  clientId: string,
  incoming?: AdaptationOverride | null,
): Promise<LoadedAdaptation> {
  const [dosage, { data: saved }, logs, masteryRows, { data: client }, { data: program }] = await Promise.all([
    loadProgramDosage(supabase, clientId),
    supabase.from("program_adaptations").select("*").eq("client_id", clientId).maybeSingle(),
    loadTrainingLogs(supabase, clientId),
    loadMastery(supabase, clientId),
    supabase.from("clients").select("first_name").eq("id", clientId).maybeSingle(),
    supabase.from("programs").select("id, weeks, days_per_week, start_date, status").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const row = (saved as AdaptationRow | null) ?? null;
  const override = incoming !== undefined ? incoming : row?.overrides ?? null;
  const prescriptions = dosage.effective.sessions.flatMap((s) => s.exercises);
  const graph = relationshipsFromSelection(dosage);
  const week = programWeek(program?.start_date, program?.weeks);
  const shared = {
    prescriptions,
    exposures: matchExposures(prescriptions, logs.exposures),
    sessions: logs.sessions,
    mastery: masteryRows,
    progressions: graph.progressions,
    regressions: graph.regressions,
    first_name: client?.first_name ?? "",
    training_stage: dosage.selection.structure.priorities.profile.effective.training_stage,
    training_experience: dosage.selection.structure.priorities.profile.effective.training_experience,
    program_week: week,
    program_weeks: program?.weeks ?? 12,
    sessions_per_week: program?.days_per_week ?? dosage.selection.structure.effective.recommended_sessions_per_week,
  };
  const auto = adaptWeek({ ...shared, override: null, automation_level: "LEVEL_1_SUGGEST" });
  const effective = adaptWeek({
    ...shared,
    override,
    automation_level: override?.automation_level ?? (row?.automation_level as AdaptationOverride["automation_level"]) ?? "LEVEL_1_SUGGEST",
  });
  return { dosage, auto, effective, override, row, seeded: !row };
}

async function loadTrainingLogs(supabase: SupabaseClient, clientId: string) {
  const setQuery = await supabase
    .from("set_logs")
    .select("logged_at, reps_done, load_used, rpe, rir, pain_0_10, notes, program_exercises(exercise_id, exercise_name, sets, program_sessions(title, week, day))")
    .eq("client_id", clientId)
    .order("logged_at", { ascending: true })
    .limit(800);
  const setRows =
    setQuery.data ??
    (
      await supabase
        .from("set_logs")
        .select("logged_at, reps_done, load_used, rpe, pain_0_10, notes, program_exercises(exercise_id, exercise_name, sets, program_sessions(title, week, day))")
        .eq("client_id", clientId)
        .order("logged_at", { ascending: true })
        .limit(800)
    ).data;
  const sessionQuery = await supabase
    .from("session_logs")
    .select("completed_at, skipped, overall_rpe, duration_minutes, notes, energy_0_10, motivation_0_10, sleep_quality_0_10, soreness_0_10, fatigue_0_10, updated_at, program_sessions(title, week, day)")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: true })
    .limit(200);
  const sessionRows =
    sessionQuery.data ??
    (
      await supabase
        .from("session_logs")
        .select("completed_at, skipped, overall_rpe, duration_minutes, notes, updated_at, program_sessions(title, week, day)")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: true })
        .limit(200)
    ).data;

  const byName = new Map<string, { date: string; reps: number | null; load: number | null; rir: number | null; rpe: number | null; pain: number | null; notes: string | null }[]>();
  for (const row of setRows ?? []) {
    const pe = unwrap(row.program_exercises);
    const name = String(pe?.exercise_name ?? "");
    if (!name) continue;
    const date = String(row.logged_at ?? "").slice(0, 10);
    const list = byName.get(name) ?? [];
    list.push({
      date,
      reps: num(row.reps_done),
      load: num(row.load_used),
      rir: num((row as { rir?: number | null }).rir),
      rpe: num(row.rpe),
      pain: num(row.pain_0_10),
      notes: row.notes ? String(row.notes) : null,
    });
    byName.set(name, list);
  }
  const exposures: Record<string, Exposure[]> = {};
  for (const [name, sets] of byName) exposures[name] = groupExposures(sets);

  const sessions: LoggedSession[] = (sessionRows ?? []).map((row) => ({
    date: String(row.completed_at ?? row.updated_at ?? "").slice(0, 10),
    completed: Boolean(row.completed_at) && !row.skipped,
    skipped: Boolean(row.skipped),
    session_rpe: num(row.overall_rpe),
    duration_minutes: num(row.duration_minutes),
    prescribed_minutes: null,
    energy: num((row as { energy_0_10?: number | null }).energy_0_10),
    motivation: num((row as { motivation_0_10?: number | null }).motivation_0_10),
    sleep: num((row as { sleep_quality_0_10?: number | null }).sleep_quality_0_10),
    soreness: num((row as { soreness_0_10?: number | null }).soreness_0_10),
    fatigue: num((row as { fatigue_0_10?: number | null }).fatigue_0_10),
    notes: row.notes ? String(row.notes) : null,
  }));

  return { exposures, sessions };
}

async function loadMastery(supabase: SupabaseClient, clientId: string) {
  const { data } = await supabase.from("client_exercise_mastery").select("exercise_id, mastery_level, exercises(slug)").eq("client_id", clientId);
  const map: Record<string, MasteryLevel> = {};
  for (const row of data ?? []) {
    const slug = unwrap((row as { exercises?: { slug?: string } }).exercises)?.slug;
    if (row.exercise_id) map[String(row.exercise_id)] = row.mastery_level as MasteryLevel;
    if (slug) map[slug] = row.mastery_level as MasteryLevel;
  }
  return map;
}

function matchExposures(prescriptions: Prescription[], byName: Record<string, Exposure[]>) {
  const out: Record<string, Exposure[]> = { ...byName };
  for (const p of prescriptions) {
    const hit =
      byName[p.name] ??
      byName[p.slug] ??
      Object.entries(byName).find(([n]) => n.toLowerCase() === p.name.toLowerCase() || n.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(n.toLowerCase()))?.[1];
    if (hit) {
      out[p.slug] = hit;
      out[p.slot_id] = hit;
    }
  }
  return out;
}

function relationshipsFromSelection(dosage: LoadedDosage) {
  const progressions: Record<string, { slug: string; name: string }[]> = {};
  const regressions: Record<string, { slug: string; name: string }[]> = {};
  for (const s of dosage.selection.effective.sessions) {
    for (const e of s.exercises) {
      progressions[e.slug] = e.progression_options.map((o) => ({ slug: o.id, name: o.name }));
      regressions[e.slug] = e.regression_options.map((o) => ({ slug: o.id, name: o.name }));
    }
  }
  return { progressions, regressions };
}

function programWeek(start: string | null | undefined, weeks: number | null | undefined) {
  if (!start) return 1;
  const days = Math.floor((Date.now() - new Date(start).getTime()) / 86400000);
  return Math.min(weeks ?? 12, Math.max(1, Math.floor(days / 7) + 1));
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function num(v: unknown) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
