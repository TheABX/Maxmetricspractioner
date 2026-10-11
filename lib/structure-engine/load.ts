import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProgrammingPriorities, type LoadedPriorities } from "@/lib/priority-engine/load";
import { applyStructureOverride, runStructureEngine } from "./engine";
import type { StructureOverride, StructureResult } from "./types";

export type StructureRow = {
  id: string;
  client_id: string;
  auto: StructureResult;
  overrides: StructureOverride | null;
  structure: StructureResult;
  rationale: string[] | null;
  constraint_flags: StructureResult["constraint_flags"];
  confirmed_at: string | null;
  updated_at: string;
};

export type LoadedStructure = {
  priorities: LoadedPriorities;
  auto: StructureResult;
  effective: StructureResult;
  override: StructureOverride | null;
  row: StructureRow | null;
  seeded: boolean;
};

export async function loadProgramStructure(
  supabase: SupabaseClient,
  clientId: string,
  incomingOverride?: StructureOverride | null,
): Promise<LoadedStructure> {
  const priorities = await loadProgrammingPriorities(supabase, clientId);
  const { data: saved } = await supabase.from("program_structures").select("*").eq("client_id", clientId).maybeSingle();
  const row = (saved as StructureRow | null) ?? null;
  const override = incomingOverride !== undefined ? incomingOverride : row?.overrides ?? null;
  const auto = runStructureEngine({
    profile: priorities.profile.profile,
    effective: priorities.profile.effective,
    priorities: priorities.result.priorities,
    sportLoadByDay: override?.sport_load_by_day,
    override,
  });
  const effective = applyStructureOverride(auto, override);
  return { priorities, auto, effective, override, row, seeded: !row };
}
