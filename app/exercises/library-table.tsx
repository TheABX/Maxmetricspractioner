"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateExercises, deactivateExercise, deleteExercise, duplicateExercise, setExerciseFlag } from "@/app/library-actions";
import { ghostButtonClass, inputClass } from "@/components/ui";
import { pretty, type ExerciseRecord } from "@/lib/exercise-kb/types";
import type { FamilyRow } from "@/lib/exercise-kb/load";

const DEFAULT_COLS = ["name", "category", "movement", "quality", "region", "equipment", "laterality", "difficulty", "foundation", "ai", "status"] as const;
const OPTIONAL_COLS = ["hypertrophy", "strength", "power", "stability", "mobility", "loading", "fatigue", "time", "setup", "impact", "complexity", "approved", "updated"] as const;
type Col = (typeof DEFAULT_COLS)[number] | (typeof OPTIONAL_COLS)[number];

const COL_LABEL: Record<Col, string> = {
  name: "Exercise",
  category: "Category",
  movement: "Movement",
  quality: "Primary quality",
  region: "Region",
  equipment: "Equipment",
  laterality: "Laterality",
  difficulty: "Difficulty",
  foundation: "Foundation",
  ai: "AI",
  status: "Status",
  hypertrophy: "Hypertrophy",
  strength: "Strength",
  power: "Power",
  stability: "Stability",
  mobility: "Mobility",
  loading: "Loading",
  fatigue: "Fatigue",
  time: "Time",
  setup: "Setup",
  impact: "Impact",
  complexity: "Complexity",
  approved: "Approved",
  updated: "Updated",
};

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "ok" | "warn" | "off" | "neutral" }) {
  const cls =
    tone === "ok"
      ? "bg-[#e3f2ea] text-[#1f4d3a]"
      : tone === "warn"
        ? "bg-[#fff3d6] text-[#6a4b00]"
        : tone === "off"
          ? "bg-[#f3e8e4] text-[#7a3b2e]"
          : "bg-[#f3f1ec] text-[var(--muted)]";
  return <span className={`rounded-full px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide ${cls}`}>{children}</span>;
}

function matches(ex: ExerciseRecord, q: string) {
  if (!q.trim()) return true;
  const hay = [
    ex.name,
    ex.display_name,
    ex.description,
    ex.category,
    ex.movement_pattern,
    ex.laterality,
    ...ex.training_qualities,
    ...ex.primary_regions,
    ...ex.secondary_regions,
    ...ex.equipment_required,
    ...ex.equipment_optional,
    ...ex.tags,
    ...ex.caution_tags,
  ]
    .join(" ")
    .toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

export function LibraryTable({
  library,
  families,
  picker = false,
  onPick,
}: {
  library: ExerciseRecord[];
  families: FamilyRow[];
  picker?: boolean;
  onPick?: (ex: ExerciseRecord) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: Col; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [cols, setCols] = useState<Col[]>([...DEFAULT_COLS]);
  const [showCols, setShowCols] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggleFilter(key: string, value: string) {
    setFilters((p) => {
      const cur = p[key] ?? [];
      return { ...p, [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] };
    });
  }

  const rows = useMemo(() => {
    const list = library.filter((ex) => {
      if (!matches(ex, q)) return false;
      const f = filters;
      if (f.category?.length && !f.category.includes(ex.category)) return false;
      if (f.movement?.length && !f.movement.includes(ex.movement_pattern)) return false;
      if (f.quality?.length && !ex.training_qualities.some((x) => f.quality.includes(x))) return false;
      if (f.region?.length && !ex.primary_regions.some((x) => f.region.includes(x))) return false;
      if (f.equipment?.length && !ex.equipment_required.some((x) => f.equipment.includes(x))) return false;
      if (f.laterality?.length && !f.laterality.includes(ex.laterality)) return false;
      if (f.difficulty?.length && !f.difficulty.includes(ex.difficulty_level)) return false;
      if (f.complexity?.length && !f.complexity.includes(ex.technical_complexity)) return false;
      if (f.stability?.length && !f.stability.includes(ex.stability_requirement)) return false;
      if (f.foundation?.length && !f.foundation.includes(ex.foundation_suitability)) return false;
      if (f.hypertrophy?.length && !f.hypertrophy.includes(ex.hypertrophy_suitability)) return false;
      if (f.strength?.length && !f.strength.includes(ex.strength_suitability)) return false;
      if (f.power?.length && !f.power.includes(ex.power_suitability)) return false;
      if (f.fatigue?.length && !f.fatigue.includes(ex.systemic_fatigue_cost)) return false;
      if (f.ai?.length) {
        const on = ex.ai_selection_enabled ? "ON" : "OFF";
        if (!f.ai.includes(on)) return false;
      }
      if (f.status?.length) {
        const s = ex.active ? "ACTIVE" : "INACTIVE";
        if (!f.status.includes(s)) return false;
      }
      if (f.approved?.length) {
        const a = ex.practitioner_approved ? "APPROVED" : "PENDING";
        if (!f.approved.includes(a)) return false;
      }
      return true;
    });
    const val = (ex: ExerciseRecord, key: Col): string => {
      if (key === "name") return ex.name;
      if (key === "category") return ex.category;
      if (key === "movement") return ex.movement_pattern;
      if (key === "quality") return ex.training_qualities[0] ?? "";
      if (key === "region") return ex.primary_regions.join(" ");
      if (key === "equipment") return ex.equipment_required.join(" ");
      if (key === "laterality") return ex.laterality;
      if (key === "difficulty") return ex.difficulty_level;
      if (key === "foundation") return ex.foundation_suitability;
      if (key === "ai") return ex.ai_selection_enabled ? "1" : "0";
      if (key === "status") return ex.active ? "1" : "0";
      if (key === "hypertrophy") return ex.hypertrophy_suitability;
      if (key === "strength") return ex.strength_suitability;
      if (key === "power") return ex.power_suitability;
      if (key === "stability") return ex.stability_requirement;
      if (key === "mobility") return ex.ankle_mobility_requirement;
      if (key === "loading") return ex.loading_potential;
      if (key === "fatigue") return ex.systemic_fatigue_cost;
      if (key === "time") return ex.time_efficiency;
      if (key === "setup") return ex.setup_complexity;
      if (key === "impact") return ex.impact_level;
      if (key === "complexity") return ex.technical_complexity;
      if (key === "approved") return ex.practitioner_approved ? "1" : "0";
      if (key === "updated") return ex.updated_at ?? "";
      return "";
    };
    return list.sort((a, b) => val(a, sort.key).localeCompare(val(b, sort.key)) * sort.dir);
  }, [library, q, filters, sort]);

  function cell(ex: ExerciseRecord, key: Col) {
    if (key === "name") {
      return picker ? (
        <button type="button" className="text-left font-medium underline" onClick={() => onPick?.(ex)}>
          {ex.name}
        </button>
      ) : (
        <Link className="font-medium underline" href={`/exercises/${ex.id}`}>
          {ex.name}
        </Link>
      );
    }
    if (key === "category") return pretty(ex.category);
    if (key === "movement") return pretty(ex.movement_pattern);
    if (key === "quality") return ex.training_qualities.slice(0, 2).map(pretty).join(" / ") || "—";
    if (key === "region") return ex.primary_regions.map(pretty).join(" / ") || "—";
    if (key === "equipment") return ex.equipment_required.map(pretty).join(" / ") || "—";
    if (key === "laterality") return pretty(ex.laterality);
    if (key === "difficulty") return pretty(ex.difficulty_level);
    if (key === "foundation") return pretty(ex.foundation_suitability);
    if (key === "ai") return <Badge tone={ex.ai_selection_enabled ? "ok" : "off"}>{ex.ai_selection_enabled ? "AI on" : "AI off"}</Badge>;
    if (key === "status") return <Badge tone={ex.active ? "ok" : "off"}>{ex.active ? "Active" : "Inactive"}</Badge>;
    if (key === "hypertrophy") return pretty(ex.hypertrophy_suitability);
    if (key === "strength") return pretty(ex.strength_suitability);
    if (key === "power") return pretty(ex.power_suitability);
    if (key === "stability") return pretty(ex.stability_requirement);
    if (key === "mobility") return pretty(ex.ankle_mobility_requirement);
    if (key === "loading") return pretty(ex.loading_potential);
    if (key === "fatigue") return pretty(ex.systemic_fatigue_cost);
    if (key === "time") return pretty(ex.time_efficiency);
    if (key === "setup") return pretty(ex.setup_complexity);
    if (key === "impact") return pretty(ex.impact_level);
    if (key === "complexity") return pretty(ex.technical_complexity);
    if (key === "approved") return <Badge tone={ex.practitioner_approved ? "ok" : "warn"}>{ex.practitioner_approved ? "Approved" : "Pending"}</Badge>;
    if (key === "updated") return ex.updated_at ? new Date(ex.updated_at).toLocaleDateString("en-AU") : "—";
    return "—";
  }

  function run(fn: () => Promise<{ ok: true } | { error: string } | { ok: true; id: string }>) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if ("error" in res) setMsg(res.error);
      else if ("id" in res && res.id) router.push(`/exercises/${res.id}`);
      else router.refresh();
    });
  }

  function exportCsv() {
    const header = cols.map((c) => COL_LABEL[c]).join(",");
    const body = rows
      .map((ex) =>
        cols
          .map((c) => {
            const raw = typeof cell(ex, c) === "string" ? String(cell(ex, c)) : ex.name;
            return `"${raw.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "exercise-library.csv";
    a.click();
  }

  const unique = (fn: (e: ExerciseRecord) => string | string[]) =>
    [...new Set(library.flatMap((e) => {
      const v = fn(e);
      return Array.isArray(v) ? v : [v];
    }))].sort();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${inputClass} max-w-md`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, quality, region, equipment…" />
        <button type="button" className={ghostButtonClass} onClick={() => setShowFilters((v) => !v)}>
          Filters
        </button>
        <button type="button" className={ghostButtonClass} onClick={() => setShowCols((v) => !v)}>
          Columns
        </button>
        {!picker && (
          <button type="button" className={ghostButtonClass} onClick={exportCsv}>
            Export CSV
          </button>
        )}
        <span className="font-sans text-xs text-[var(--muted)]">{rows.length} shown</span>
      </div>

      {showCols && (
        <div className="mt-3 flex flex-wrap gap-2 rounded-lg border border-[var(--line)] bg-white p-3">
          {[...DEFAULT_COLS, ...OPTIONAL_COLS].map((c) => (
            <label key={c} className="font-sans text-xs">
              <input
                type="checkbox"
                className="mr-1"
                checked={cols.includes(c)}
                onChange={() => setCols((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))}
              />
              {COL_LABEL[c]}
            </label>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="mt-3 grid gap-3 rounded-lg border border-[var(--line)] bg-white p-3 font-sans text-xs sm:grid-cols-3">
          {(
            [
              ["category", "Category", unique((e) => e.category)],
              ["movement", "Movement", unique((e) => e.movement_pattern)],
              ["quality", "Quality", unique((e) => e.training_qualities)],
              ["region", "Region", unique((e) => e.primary_regions)],
              ["equipment", "Equipment", unique((e) => e.equipment_required)],
              ["laterality", "Laterality", unique((e) => e.laterality)],
              ["difficulty", "Difficulty", unique((e) => e.difficulty_level)],
              ["complexity", "Complexity", unique((e) => e.technical_complexity)],
              ["stability", "Stability", unique((e) => e.stability_requirement)],
              ["foundation", "Foundation", unique((e) => e.foundation_suitability)],
              ["ai", "AI selection", ["ON", "OFF"]],
              ["status", "Status", ["ACTIVE", "INACTIVE"]],
              ["approved", "Approval", ["APPROVED", "PENDING"]],
            ] as [string, string, string[]][]
          ).map(([key, label, opts]) => (
            <div key={key}>
              <p className="mb-1 text-[var(--muted)]">{label}</p>
              <div className="flex flex-wrap gap-1">
                {opts.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggleFilter(key, o)}
                    className={`rounded-full border px-2 py-0.5 ${(filters[key] ?? []).includes(o) ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)]"}`}
                  >
                    {pretty(o)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!picker && selected.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-white p-3 font-sans text-xs">
          <span>{selected.length} selected</span>
          <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => run(() => bulkUpdateExercises({ ids: selected, patch: { ai_selection_enabled: false } }))}>
            AI off
          </button>
          <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => run(() => bulkUpdateExercises({ ids: selected, patch: { ai_selection_enabled: true } }))}>
            AI on
          </button>
          <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => run(() => bulkUpdateExercises({ ids: selected, patch: { practitioner_approved: true } }))}>
            Approve
          </button>
          <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => run(() => bulkUpdateExercises({ ids: selected, patch: { active: false } }))}>
            Deactivate
          </button>
          <select
            className={inputClass}
            defaultValue=""
            onChange={(e) => {
              if (!e.target.value) return;
              run(() => bulkUpdateExercises({ ids: selected, patch: { family_id: e.target.value } }));
            }}
          >
            <option value="">Move to family…</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button type="button" className="underline" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--card)]">
        <table className="w-full min-w-[960px] text-left font-sans text-sm">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
            <tr>
              {!picker && <th className="px-3 py-2" />}
              {cols.map((c) => (
                <th key={c} className="cursor-pointer px-3 py-2" onClick={() => setSort((s) => ({ key: c, dir: s.key === c ? (s.dir === 1 ? -1 : 1) : 1 }))}>
                  {COL_LABEL[c]}
                  {sort.key === c ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                </th>
              ))}
              {!picker && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((ex) => (
              <tr key={ex.id} className="border-t border-[var(--line)]">
                {!picker && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(ex.id)}
                      onChange={() => setSelected((p) => (p.includes(ex.id) ? p.filter((x) => x !== ex.id) : [...p, ex.id]))}
                    />
                  </td>
                )}
                {cols.map((c) => (
                  <td key={c} className="px-3 py-2 align-top">
                    {cell(ex, c)}
                    {c === "name" && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {!ex.practitioner_approved && <Badge tone="warn">Pending review</Badge>}
                        {ex.foundation_suitability === "EXCELLENT" && <Badge>Foundation friendly</Badge>}
                        {ex.difficulty_level === "ADVANCED" && <Badge tone="warn">Advanced</Badge>}
                      </div>
                    )}
                  </td>
                ))}
                {!picker && (
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button type="button" className="text-xs underline" disabled={pending} onClick={() => run(() => setExerciseFlag({ id: ex.id, field: "ai_selection_enabled", value: !ex.ai_selection_enabled }))}>
                      {ex.ai_selection_enabled ? "Disable AI" : "Enable AI"}
                    </button>
                    {" · "}
                    <button type="button" className="text-xs underline" disabled={pending} onClick={() => run(() => duplicateExercise(ex.id))}>
                      Duplicate
                    </button>
                    {" · "}
                    {ex.active ? (
                      <button type="button" className="text-xs underline" disabled={pending} onClick={() => run(() => deactivateExercise(ex.id))}>
                        Deactivate
                      </button>
                    ) : (
                      <button type="button" className="text-xs underline" disabled={pending} onClick={() => run(() => setExerciseFlag({ id: ex.id, field: "active", value: true }))}>
                        Activate
                      </button>
                    )}
                    {ex.used_count === 0 && (
                      <>
                        {" · "}
                        <button
                          type="button"
                          className="text-xs underline"
                          disabled={pending}
                          onClick={() => {
                            if (confirm("Permanently delete this unused exercise?")) run(() => deleteExercise(ex.id));
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-5 font-sans text-sm text-[var(--muted)]">No exercises match.</p>}
      </div>
      {msg && <p className="mt-3 font-sans text-sm">{msg}</p>}
    </div>
  );
}
