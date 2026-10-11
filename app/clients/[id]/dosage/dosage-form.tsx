"use client";

import { useState, useTransition } from "react";
import { saveProgramDosage } from "@/app/engine-actions";
import { DosageBoard, WeeklySummary } from "@/components/dosage-board";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import { formatDose, formatEffort } from "@/lib/dosage-engine/engine";
import type { DosageResult, DoseOverride, Prescription } from "@/lib/dosage-engine/types";

export function DosageForm({
  clientId,
  result,
  override,
  confirmedAt,
}: {
  clientId: string;
  result: DosageResult;
  override: DoseOverride | null;
  confirmedAt: string | null;
}) {
  const [slots, setSlots] = useState<DoseOverride["slots"]>(override?.slots ?? {});
  const [reason, setReason] = useState(override?.reason ?? "");
  const [extraWeak, setExtraWeak] = useState(override?.extra_weak_side_sets ?? false);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function patch(slotId: string, field: keyof Prescription, value: string) {
    const next = { ...slots, [slotId]: { ...slots[slotId] } };
    const num = Number(value);
    if (field === "progression_method" || field === "notes") {
      (next[slotId] as Record<string, unknown>)[field] = value;
    } else {
      (next[slotId] as Record<string, unknown>)[field] = value === "" ? undefined : num;
    }
    setSlots(next);
  }

  function save(confirm: boolean) {
    setMsg(null);
    start(async () => {
      const res = await saveProgramDosage({
        client_id: clientId,
        override: { slots, extra_weak_side_sets: extraWeak, reason },
        confirm,
      });
      setMsg("error" in res ? res.error : confirm ? "Saved and confirmed." : "Saved.");
    });
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        {result.sessions.map((s) => (
          <section key={s.day} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
            <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              {s.day} · {s.label}
              {s.flags.length ? ` · ${s.flags.join(" · ")}` : ""}
            </h2>
            <ol className="mt-3 space-y-3">
              {s.exercises.map((e) => {
                const o = slots[e.slot_id];
                const shown = { ...e, ...o };
                return (
                  <li key={e.slot_id} className="rounded-lg border border-[var(--line)] bg-white p-3 font-sans text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p>
                        <span className="mr-2 text-[var(--muted)]">{e.order}.</span>
                        <span className="font-medium">{e.name}</span>
                        <span className="text-[var(--muted)]">
                          {" "}
                          · {formatDose(shown as Prescription)} · {formatEffort(shown as Prescription)}
                        </span>
                      </p>
                      <button type="button" className="text-xs underline" onClick={() => setOpen(open === e.slot_id ? null : e.slot_id)}>
                        {open === e.slot_id ? "Hide override" : "Edit dose"}
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-xs italic text-[var(--muted)]">{e.client_line}</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs underline">Why this dose?</summary>
                      <ul className="mt-1 list-disc pl-5 text-xs text-[var(--muted)]">
                        {e.rationale.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                      <p className="mt-1 text-xs text-[var(--muted)]">{e.progression_criteria}</p>
                      {e.stop_rule ? <p className="mt-1 text-xs">{e.stop_rule}</p> : null}
                    </details>
                    {open === e.slot_id && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Num label="Sets" value={o?.sets ?? e.sets} onChange={(v) => patch(e.slot_id, "sets", v)} />
                        <Num label="Reps min" value={o?.reps_min ?? e.reps_min} onChange={(v) => patch(e.slot_id, "reps_min", v)} />
                        <Num label="Reps max" value={o?.reps_max ?? e.reps_max} onChange={(v) => patch(e.slot_id, "reps_max", v)} />
                        <Num label="RIR min" value={o?.rir_min ?? e.rir_min} onChange={(v) => patch(e.slot_id, "rir_min", v)} />
                        <Num label="RIR max" value={o?.rir_max ?? e.rir_max} onChange={(v) => patch(e.slot_id, "rir_max", v)} />
                        <Num label="Rest min (s)" value={o?.rest_seconds_min ?? e.rest_seconds_min} onChange={(v) => patch(e.slot_id, "rest_seconds_min", v)} />
                        <Num label="Rest max (s)" value={o?.rest_seconds_max ?? e.rest_seconds_max} onChange={(v) => patch(e.slot_id, "rest_seconds_max", v)} />
                        <label className="col-span-2 font-sans text-xs text-[var(--muted)]">
                          Progression
                          <select
                            className={`${inputClass} mt-1`}
                            value={o?.progression_method ?? e.progression_method}
                            onChange={(ev) => patch(e.slot_id, "progression_method", ev.target.value)}
                          >
                            {["DOUBLE_PROGRESSION", "LOAD_PROGRESSION", "REP_PROGRESSION", "SET_PROGRESSION", "DURATION_PROGRESSION", "INTENSITY_PROGRESSION", "EXERCISE_PROGRESSION", "CUSTOM"].map((m) => (
                              <option key={m} value={m}>
                                {m.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
              {s.exercises.length === 0 && <p className="font-sans text-sm text-[var(--muted)]">No prescribed exercises.</p>}
            </ol>
          </section>
        ))}
      </div>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <WeeklySummary result={result} />
          <h2 className="mt-4 font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Why this week</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 font-sans text-xs">
            {result.rationale.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="mt-4">
            <DosageBoard result={result} compact />
          </div>
          <label className="mt-4 flex items-center gap-2 font-sans text-xs">
            <input type="checkbox" checked={extraWeak} onChange={(e) => setExtraWeak(e.target.checked)} />
            Extra weak-side set when unilateral
          </label>
          <label className="mt-3 block font-sans text-xs text-[var(--muted)]">
            Override reason
            <input className={`${inputClass} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={pending} onClick={() => save(false)}>
              {pending ? "Saving…" : "Save dosage"}
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

function Num({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: string) => void }) {
  return (
    <label className="font-sans text-xs text-[var(--muted)]">
      {label}
      <input className={`${inputClass} mt-1`} type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
