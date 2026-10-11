"use client";

import { useState, useTransition } from "react";
import { saveProgramStructure } from "@/app/engine-actions";
import { StructureBoard } from "@/components/structure-board";
import { buttonClass, Field, ghostButtonClass, inputClass } from "@/components/ui";
import { DAYS } from "@/lib/programming-profile/types";
import { qlabel } from "@/lib/priority-engine/types";
import {
  DAY_LABEL,
  SESSION_TYPES,
  SPLITS,
  SPORT_LOADS,
  slabel,
  type SportLoad,
  type Split,
  type StructureOverride,
  type StructureResult,
} from "@/lib/structure-engine/types";

export function StructureForm({
  clientId,
  structure,
  override,
  stage,
  confirmedAt,
}: {
  clientId: string;
  structure: StructureResult;
  override: StructureOverride | null;
  stage: string;
  confirmedAt: string | null;
}) {
  const [sessions, setSessions] = useState(override?.recommended_sessions_per_week ?? structure.recommended_sessions_per_week);
  const [minutes, setMinutes] = useState(override?.session_minutes ?? structure.session_minutes);
  const [split, setSplit] = useState<Split>(override?.session_split ?? structure.session_split);
  const [sport, setSport] = useState<Partial<Record<(typeof DAYS)[number], SportLoad>>>(override?.sport_load_by_day ?? {});
  const [reason, setReason] = useState(override?.reason ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function buildOverride(): StructureOverride | null {
    const changed =
      sessions !== structure.recommended_sessions_per_week ||
      minutes !== structure.session_minutes ||
      split !== structure.session_split ||
      Object.keys(sport).length > 0;
    if (!changed && !reason) return override;
    return {
      recommended_sessions_per_week: sessions,
      session_minutes: minutes,
      session_split: split,
      sport_load_by_day: sport,
      reason,
    };
  }

  function save(confirm: boolean) {
    setMsg(null);
    start(async () => {
      const res = await saveProgramStructure({ client_id: clientId, override: buildOverride(), confirm });
      setMsg("error" in res ? res.error : confirm ? "Saved and confirmed." : "Saved. Reload to see the recomputed week.");
    });
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Program structure</h2>
          <p className="mt-1 font-sans text-xs text-[var(--muted)]">Training stage: {stage.toLowerCase()}</p>
          <div className="mt-4">
            <StructureBoard structure={structure} />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Why this structure</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 font-sans text-sm">
            {structure.practitioner_rationale.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Phases (12 weeks)</h2>
          <p className="mt-1 font-sans text-xs text-[var(--muted)]">Phases change volume and emphasis — not the exercise list.</p>
          <ul className="mt-3 space-y-2 font-sans text-sm">
            {structure.program_phase_structure.map((ph) => (
              <li key={ph.id}>
                <span className="font-medium">
                  Weeks {ph.weeks}: {ph.name}
                </span>
                <p className="text-[var(--muted)]">{ph.intent}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Practitioner override</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field label="Sessions / week">
              <input className={inputClass} type="number" min={1} max={7} value={sessions} onChange={(e) => setSessions(Number(e.target.value))} />
            </Field>
            <Field label="Session minutes">
              <input className={inputClass} type="number" min={20} max={180} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
            </Field>
            <Field label="Split">
              <select className={inputClass} value={split} onChange={(e) => setSplit(e.target.value as Split)}>
                {SPLITS.map((s) => (
                  <option key={s} value={s}>
                    {slabel(s)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="mt-4 mb-1 font-sans text-sm text-[var(--muted)]">Sport load (performance mode)</p>
          <div className="grid gap-2 sm:grid-cols-7">
            {DAYS.map((d) => (
              <Field key={d} label={DAY_LABEL[d].slice(0, 3)}>
                <select
                  className={inputClass}
                  value={sport[d] ?? "NONE"}
                  onChange={(e) => setSport({ ...sport, [d]: e.target.value as SportLoad })}
                >
                  {SPORT_LOADS.map((l) => (
                    <option key={l} value={l}>
                      {l.toLowerCase()}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <Field label="Override reason">
            <input className={`${inputClass} mt-3`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the automatic week is wrong" />
          </Field>
          <p className="mt-2 font-sans text-xs text-[var(--muted)]">
            Session types on the automatic week:{" "}
            {structure.weekly_schedule
              .filter((s) => s.kind === "PRESCRIBED")
              .map((s) => `${DAY_LABEL[s.day]} ${s.session_type}`)
              .join(" · ")}
            . Available types include {SESSION_TYPES.slice(0, 4).join(", ")}…
          </p>
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Client week</h2>
          <ul className="mt-3 space-y-1 font-sans text-sm">
            {structure.client_week.map((r) => (
              <li key={r.day}>
                <span className="text-[var(--muted)]">{r.day}</span> · {r.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 font-sans text-sm">Approx. {Math.round(structure.weekly_training_minutes / 60)} hr {structure.weekly_training_minutes % 60} min/week</p>
          <p className="mt-3 font-sans text-xs text-[var(--muted)]">
            Recovery spacing: {structure.recovery_spacing.minimum_recovery_hours_between_similar_sessions}h between similar hard sessions.
          </p>
          <div className="mt-4">
            <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Allocation</p>
            <ul className="mt-1 space-y-1 font-sans text-xs">
              {structure.priority_time_allocation
                .filter((a) => a.percent > 0)
                .sort((a, b) => b.percent - a.percent)
                .slice(0, 6)
                .map((a) => (
                  <li key={a.quality}>
                    {qlabel(a.quality)} · {a.emphasis}
                  </li>
                ))}
            </ul>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={pending} onClick={() => save(false)}>
              {pending ? "Saving…" : "Save structure"}
            </button>
            <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => save(true)}>
              Save & confirm
            </button>
          </div>
          {msg && <p className="mt-3 font-sans text-sm">{msg}</p>}
          <p className="mt-2 font-sans text-xs text-[var(--muted)]">{confirmedAt ? `Confirmed ${new Date(confirmedAt).toLocaleString("en-AU")}.` : "Not confirmed."}</p>
        </div>
      </aside>
    </div>
  );
}
