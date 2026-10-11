"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveExerciseKb } from "@/app/engine-actions";
import { deactivateExercise, deleteExercise, duplicateExercise, setClientMastery, setExerciseFlag } from "@/app/library-actions";
import { buttonClass, Field, ghostButtonClass, inputClass } from "@/components/ui";
import {
  CATEGORIES,
  DIFFICULTIES,
  ENVIRONMENTS,
  EX_QUALITIES,
  FOUNDATIONS,
  KB_EQUIPMENT,
  LATERALITIES,
  LMH,
  LMHV,
  MASTERY_LEVELS,
  MOVEMENTS,
  REGIONS,
  movementToLegacy,
  pretty,
  type ExerciseKb,
  type ExQuality,
  type KbEquipment,
  type Region,
} from "@/lib/exercise-kb/types";
import type { FamilyRow, TagRow } from "@/lib/exercise-kb/load";
import { engineMayChoose } from "@/lib/exercise-kb/explain";
import type { ExerciseRecord } from "@/lib/exercise-kb/types";

function Chips({ options, selected, onToggle }: { options: readonly string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onToggle(o)}
          className={`rounded-full border px-2 py-0.5 font-sans text-[11px] ${selected.includes(o) ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)] bg-white"}`}
        >
          {o.replaceAll("_", " ")}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
      <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{title}</h2>
      <div className="mt-3 grid gap-3">{children}</div>
    </section>
  );
}

export function ExerciseEditor({
  id,
  initial,
  slugs = [],
  related = { regressions: [], progressions: [], alternatives: [], similar: [] },
  families = [],
  tags = [],
  selectedTagIds = [],
  familyId = null,
  record = null,
  clients = [],
  mastery = [],
  isNew = false,
}: {
  id?: string;
  initial: ExerciseKb;
  slugs?: { slug: string; name: string }[];
  related?: { regressions: string[]; progressions: string[]; alternatives: string[]; similar: string[] };
  families?: FamilyRow[];
  tags?: TagRow[];
  selectedTagIds?: string[];
  familyId?: string | null;
  record?: ExerciseRecord | null;
  clients?: { id: string; name: string }[];
  mastery?: { client_id: string; mastery_level: string; last_assessed: string }[];
  isNew?: boolean;
}) {
  const [kb, setKb] = useState<ExerciseKb>(initial);
  const [links, setLinks] = useState(related);
  const [tagIds, setTagIds] = useState(selectedTagIds);
  const [fam, setFam] = useState(familyId ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof ExerciseKb>(k: K, v: ExerciseKb[K]) => setKb((p) => ({ ...p, [k]: v }));
  const toggleArr = (k: "training_qualities" | "primary_regions" | "secondary_regions" | "equipment_required" | "equipment_optional" | "exercise_environment" | "caution_tags", v: string) =>
    setKb((p) => {
      const cur = p[k] as string[];
      return { ...p, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });

  function save() {
    setMsg(null);
    if (!kb.name || !kb.category || !kb.movement_pattern || !kb.training_qualities.length || !kb.primary_regions.length) {
      setMsg("Name, category, movement, at least one quality and one primary region are required.");
      return;
    }
    const slug = kb.slug || kb.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    start(async () => {
      const res = await saveExerciseKb({
        id,
        kb: { ...kb, slug, display_name: kb.display_name || kb.name, legacy_pattern: movementToLegacy(kb.movement_pattern) },
        related: links,
        tagIds,
        familyId: fam || null,
      });
      if ("error" in res) setMsg(res.error);
      else {
        setMsg(isNew ? "Saved as pending review. Approve it before automatic programming can use it." : "Saved.");
        router.push(res.id ? `/exercises/${res.id}` : "/exercises");
        router.refresh();
      }
    });
  }

  const why = engineMayChoose({ ...(record ?? ({ ...kb, id: id ?? "", practitioner_id: null, family_id: fam || null, updated_at: null, used_count: 0 } as ExerciseRecord)) });

  return (
    <div className="mt-6 grid gap-5">
      {record && (
        <div className="flex flex-wrap gap-2 font-sans text-xs">
          <span className={`rounded-full px-2 py-0.5 ${record.active ? "bg-[#e3f2ea]" : "bg-[#f3e8e4]"}`}>{record.active ? "Active" : "Inactive"}</span>
          <span className={`rounded-full px-2 py-0.5 ${record.ai_selection_enabled ? "bg-[#e3f2ea]" : "bg-[#f3e8e4]"}`}>{record.ai_selection_enabled ? "AI enabled" : "AI disabled"}</span>
          <span className={`rounded-full px-2 py-0.5 ${record.practitioner_approved ? "bg-[#e3f2ea]" : "bg-[#fff3d6]"}`}>{record.practitioner_approved ? "Approved" : "Pending review"}</span>
        </div>
      )}

      <Section title="Basic information">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Exercise name">
            <input className={inputClass} value={kb.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Display name">
            <input className={inputClass} value={kb.display_name} onChange={(e) => set("display_name", e.target.value)} />
          </Field>
        </div>
        <Field label="Description">
          <textarea className={inputClass} rows={2} value={kb.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Category">
            <select className={inputClass} value={kb.category} onChange={(e) => set("category", e.target.value as ExerciseKb["category"])}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Movement pattern">
            <select className={inputClass} value={kb.movement_pattern} onChange={(e) => set("movement_pattern", e.target.value as ExerciseKb["movement_pattern"])}>
              {MOVEMENTS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Family">
            <select className={inputClass} value={fam} onChange={(e) => setFam(e.target.value)}>
              <option value="">Unassigned</option>
              {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Training purpose">
        <Field label="Training qualities">
          <Chips options={EX_QUALITIES} selected={kb.training_qualities} onToggle={(v) => toggleArr("training_qualities", v as ExQuality)} />
        </Field>
        <Field label="Primary regions">
          <Chips options={REGIONS} selected={kb.primary_regions} onToggle={(v) => toggleArr("primary_regions", v as Region)} />
        </Field>
        <Field label="Secondary regions">
          <Chips options={REGIONS} selected={kb.secondary_regions} onToggle={(v) => toggleArr("secondary_regions", v as Region)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-4">
          {(["strength_suitability", "hypertrophy_suitability", "power_suitability", "general_wellness_suitability"] as const).map((k) => (
            <Field key={k} label={pretty(k.replace("_suitability", ""))}>
              <select className={inputClass} value={kb[k]} onChange={(e) => set(k, e.target.value as ExerciseKb[typeof k])}>
                {LMHV.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Practical requirements">
        <Field label="Required equipment">
          <Chips options={KB_EQUIPMENT} selected={kb.equipment_required} onToggle={(v) => toggleArr("equipment_required", v as KbEquipment)} />
        </Field>
        <Field label="Optional equipment">
          <Chips options={KB_EQUIPMENT} selected={kb.equipment_optional} onToggle={(v) => toggleArr("equipment_optional", v as KbEquipment)} />
        </Field>
        <Field label="Environment">
          <Chips options={ENVIRONMENTS} selected={kb.exercise_environment} onToggle={(v) => toggleArr("exercise_environment", v)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Setup complexity">
            <select className={inputClass} value={kb.setup_complexity} onChange={(e) => set("setup_complexity", e.target.value as ExerciseKb["setup_complexity"])}>
              {LMH.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Time efficiency">
            <select className={inputClass} value={kb.time_efficiency} onChange={(e) => set("time_efficiency", e.target.value as ExerciseKb["time_efficiency"])}>
              {LMH.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Client suitability">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Difficulty">
            <select className={inputClass} value={kb.difficulty_level} onChange={(e) => set("difficulty_level", e.target.value as ExerciseKb["difficulty_level"])}>
              {DIFFICULTIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Technical complexity">
            <select className={inputClass} value={kb.technical_complexity} onChange={(e) => set("technical_complexity", e.target.value as ExerciseKb["technical_complexity"])}>
              {LMH.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Foundation">
            <select className={inputClass} value={kb.foundation_suitability} onChange={(e) => set("foundation_suitability", e.target.value as ExerciseKb["foundation_suitability"])}>
              {FOUNDATIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Laterality">
            <select className={inputClass} value={kb.laterality} onChange={(e) => set("laterality", e.target.value as ExerciseKb["laterality"])}>
              {LATERALITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Stability">
            <select className={inputClass} value={kb.stability_requirement} onChange={(e) => set("stability_requirement", e.target.value as ExerciseKb["stability_requirement"])}>
              {LMHV.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Impact">
            <select className={inputClass} value={kb.impact_level} onChange={(e) => set("impact_level", e.target.value as ExerciseKb["impact_level"])}>
              {LMH.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Ankle mobility">
            <select className={inputClass} value={kb.ankle_mobility_requirement} onChange={(e) => set("ankle_mobility_requirement", e.target.value as ExerciseKb["ankle_mobility_requirement"])}>
              {LMH.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Hip mobility">
            <select className={inputClass} value={kb.hip_mobility_requirement} onChange={(e) => set("hip_mobility_requirement", e.target.value as ExerciseKb["hip_mobility_requirement"])}>
              {LMH.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Shoulder mobility">
            <select className={inputClass} value={kb.shoulder_mobility_requirement} onChange={(e) => set("shoulder_mobility_requirement", e.target.value as ExerciseKb["shoulder_mobility_requirement"])}>
              {LMH.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Thoracic mobility">
            <select className={inputClass} value={kb.thoracic_mobility_requirement} onChange={(e) => set("thoracic_mobility_requirement", e.target.value as ExerciseKb["thoracic_mobility_requirement"])}>
              {LMH.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Loading / fatigue">
        <div className="grid gap-3 sm:grid-cols-4">
          {(["loading_potential", "progression_potential", "systemic_fatigue_cost", "local_fatigue_cost"] as const).map((k) => (
            <Field key={k} label={pretty(k)}>
              <select className={inputClass} value={kb[k]} onChange={(e) => set(k, e.target.value as never)}>
                {(k.includes("progression") ? LMH : LMHV).map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Relationships">
        {(["regressions", "progressions", "alternatives", "similar"] as const).map((key) => (
          <Field key={key} label={key === "similar" ? "Similar stimulus" : pretty(key)}>
            <select
              className={inputClass}
              value=""
              onChange={(e) => {
                const slug = e.target.value;
                if (!slug || links[key].includes(slug)) return;
                setLinks((p) => ({ ...p, [key]: [...p[key], slug] }));
              }}
            >
              <option value="">Add…</option>
              {slugs.filter((s) => s.slug && s.slug !== kb.slug).map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </select>
            <div className="mt-1 flex flex-wrap gap-1">
              {links[key].map((slug) => (
                <button key={slug} type="button" className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 font-sans text-[11px]" onClick={() => setLinks((p) => ({ ...p, [key]: p[key].filter((x) => x !== slug) }))}>
                  {slugs.find((s) => s.slug === slug)?.name ?? slug} ×
                </button>
              ))}
            </div>
          </Field>
        ))}
        {(links.regressions.length > 0 || links.progressions.length > 0) && (
          <div className="rounded-lg bg-white p-3 font-sans text-sm text-center">
            {links.regressions.map((s) => slugs.find((x) => x.slug === s)?.name ?? s).join(" · ")}
            {links.regressions.length ? <p className="text-[var(--muted)]">↓ regression</p> : null}
            <p className="font-medium">{kb.name || "This exercise"}</p>
            {links.progressions.length ? <p className="text-[var(--muted)]">↓ progression</p> : null}
            {links.progressions.map((s) => slugs.find((x) => x.slug === s)?.name ?? s).join(" · ")}
          </div>
        )}
      </Section>

      <Section title="Programming control">
        <p className="font-sans text-sm text-[var(--muted)]">
          New exercises default to unapproved and AI-off. Approve only when metadata is ready. AI-off still allows manual
          programming.
        </p>
        <label className="font-sans text-sm">
          <input type="checkbox" className="mr-2" checked={kb.active} onChange={(e) => set("active", e.target.checked)} />
          Active
        </label>
        <label className="font-sans text-sm">
          <input type="checkbox" className="mr-2" checked={kb.ai_selection_enabled} onChange={(e) => set("ai_selection_enabled", e.target.checked)} disabled={!kb.practitioner_approved && !record?.practitioner_approved} />
          AI selection enabled
        </label>
        <label className="font-sans text-sm">
          <input type="checkbox" className="mr-2" checked={kb.practitioner_approved} onChange={(e) => set("practitioner_approved", e.target.checked)} />
          Practitioner approved
        </label>
        <Field label="Caution tags (comma)">
          <input className={inputClass} value={kb.caution_tags.join(", ")} onChange={(e) => set("caution_tags", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
        </Field>
        <Field label="Hard exclusion / contraindication tags (comma)">
          <input className={inputClass} value={kb.contraindication_tags.join(", ")} onChange={(e) => set("contraindication_tags", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
        </Field>
        <Field label="Flexible tags">
          <div className="flex flex-wrap gap-1.5">
            {tags.filter((t) => t.active).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTagIds((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                className={`rounded-full border px-2 py-0.5 font-sans text-[11px] ${tagIds.includes(t.id) ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)] bg-white"}`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Coaching">
        <Field label="Instructions">
          <textarea className={inputClass} rows={3} value={kb.instructions} onChange={(e) => set("instructions", e.target.value)} />
        </Field>
        <Field label="Coaching cues">
          <textarea className={inputClass} rows={2} value={kb.coaching_cues} onChange={(e) => set("coaching_cues", e.target.value)} />
        </Field>
        <Field label="Common errors">
          <textarea className={inputClass} rows={2} value={kb.common_errors} onChange={(e) => set("common_errors", e.target.value)} />
        </Field>
        <Field label="Video URL">
          <input className={inputClass} value={kb.video_url} onChange={(e) => set("video_url", e.target.value)} />
        </Field>
      </Section>

      <Section title="Why the engine may choose this">
        <ul className="list-disc space-y-1 pl-5 font-sans text-sm">
          {why.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
        {why.limits.length > 0 && (
          <>
            <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Limits / penalties</p>
            <ul className="list-disc space-y-1 pl-5 font-sans text-sm">
              {why.limits.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </>
        )}
        <p className="font-sans text-xs text-[var(--muted)]">Internal ranking scores stay hidden from clients.</p>
      </Section>

      {id && (
        <Section title="Client mastery">
          <p className="font-sans text-sm text-[var(--muted)]">Per-client competency on this exercise — separate from the exercise difficulty rating.</p>
          <ul className="font-sans text-sm">
            {mastery.map((m) => (
              <li key={m.client_id}>
                {clients.find((c) => c.id === m.client_id)?.name ?? m.client_id}: {pretty(m.mastery_level)}
              </li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select className={inputClass} id="mastery-client" defaultValue="">
              <option value="">Client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={inputClass} id="mastery-level" defaultValue="LEARNING">
              {MASTERY_LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
            <button
              type="button"
              className={ghostButtonClass}
              disabled={pending}
              onClick={() => {
                const client = (document.getElementById("mastery-client") as HTMLSelectElement)?.value;
                const level = (document.getElementById("mastery-level") as HTMLSelectElement)?.value;
                if (!client || !id) return;
                start(async () => {
                  await setClientMastery({ client_id: client, exercise_id: id, mastery_level: level });
                  router.refresh();
                });
              }}
            >
              Save mastery
            </button>
          </div>
        </Section>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={pending} onClick={save}>
          {pending ? "Saving…" : isNew ? "Add exercise" : "Save exercise"}
        </button>
        {id && (
          <>
            <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => start(async () => { const r = await duplicateExercise(id); if ("id" in r) router.push(`/exercises/${r.id}`); })}>
              Duplicate
            </button>
            <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => start(async () => { await setExerciseFlag({ id, field: "practitioner_approved", value: true }); set("practitioner_approved", true); router.refresh(); })}>
              Approve for programming
            </button>
            <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => start(async () => { await deactivateExercise(id); router.refresh(); })}>
              Deactivate
            </button>
            {record?.used_count === 0 && (
              <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => { if (confirm("Permanently delete this unused exercise?")) start(async () => { const r = await deleteExercise(id); if ("error" in r) setMsg(r.error); else router.push("/exercises"); }); }}>
                Delete
              </button>
            )}
          </>
        )}
      </div>
      {msg && <p className="font-sans text-sm">{msg}</p>}
    </div>
  );
}
