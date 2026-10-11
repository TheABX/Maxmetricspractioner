import type { SupabaseClient } from "@supabase/supabase-js";
import { loadExerciseHistory, loadProgramSelection, type LoadedSelection } from "@/lib/exercise-kb/load";
import { prescribeWeek } from "./engine";
import type { DosageResult, DoseOverride } from "./types";

export type DosageRow = {
  id: string;
  client_id: string;
  auto: DosageResult;
  overrides: DoseOverride | null;
  dosage: DosageResult;
  rationale: string[] | null;
  flags: string[] | null;
  confirmed_at: string | null;
  updated_at: string;
};

export type LoadedDosage = {
  selection: LoadedSelection;
  auto: DosageResult;
  effective: DosageResult;
  override: DoseOverride | null;
  row: DosageRow | null;
  seeded: boolean;
};

export async function loadProgramDosage(
  supabase: SupabaseClient,
  clientId: string,
  incoming?: DoseOverride | null,
): Promise<LoadedDosage> {
  const [selection, history, { data: saved }] = await Promise.all([
    loadProgramSelection(supabase, clientId),
    loadExerciseHistory(supabase, clientId),
    supabase.from("program_dosages").select("*").eq("client_id", clientId).maybeSingle(),
  ]);
  const row = (saved as DosageRow | null) ?? null;
  const override = incoming !== undefined ? incoming : row?.overrides ?? null;
  const shared = {
    selection: selection.effective,
    library: selection.library,
    profile: selection.structure.priorities.profile.profile,
    effective: selection.structure.priorities.profile.effective,
    priorities: selection.structure.priorities.result.priorities,
    structure: selection.structure.effective,
    history,
  };
  const auto = prescribeWeek({ ...shared, override: null });
  const effective = prescribeWeek({ ...shared, override });
  return { selection, auto, effective, override, row, seeded: !row };
}
