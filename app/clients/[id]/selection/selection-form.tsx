"use client";

import { useState, useTransition } from "react";
import { saveProgramSelection } from "@/app/engine-actions";
import { SelectionBoard } from "@/components/selection-board";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import type { SelectionOverride, SelectionResult } from "@/lib/exercise-kb/types";

export function SelectionForm({
  clientId,
  result,
  override,
  confirmedAt,
}: {
  clientId: string;
  result: SelectionResult;
  override: SelectionOverride | null;
  confirmedAt: string | null;
}) {
  const [locks, setLocks] = useState<Record<string, string>>(override?.locks ?? {});
  const [replacements, setReplacements] = useState<Record<string, string>>(override?.replacements ?? {});
  const [reason, setReason] = useState(override?.reason ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(confirm: boolean) {
    setMsg(null);
    start(async () => {
      const res = await saveProgramSelection({
        client_id: clientId,
        override: { locks, replacements, removed_slot_ids: override?.removed_slot_ids ?? [], added: override?.added ?? [], reason },
        confirm,
      });
      setMsg("error" in res ? res.error : confirm ? "Saved and confirmed." : "Saved. Reload to see replacements applied.");
    });
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        {result.sessions.map((s) => (
          <section key={s.day} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
            <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              {s.day} · {s.label}
            </h2>
            <ol className="mt-3 space-y-3">
              {s.exercises.map((e) => (
                <li key={e.slot_id} className="rounded-lg border border-[var(--line)] bg-white p-3 font-sans text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p>
                      <span className="mr-2 text-[var(--muted)]">{e.order}.</span>
                      <span className="font-medium">{e.name}</span>
                      <span className="text-[var(--muted)]"> · {e.intent.replaceAll("_", " ").toLowerCase()}</span>
                    </p>
                    <label className="text-xs">
                      <input
                        type="checkbox"
                        className="mr-1"
                        checked={Boolean(locks[e.slot_id])}
                        onChange={(ev) => {
                          const next = { ...locks };
                          if (ev.target.checked) next[e.slot_id] = e.slug;
                          else delete next[e.slot_id];
                          setLocks(next);
                        }}
                      />
                      Lock
                    </label>
                  </div>
                  <ul className="mt-2 list-disc pl-5 text-xs text-[var(--muted)]">
                    {e.selection_reason.slice(0, 4).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs italic">{e.client_reason}</p>
                  {e.eligible_alternatives.length > 0 && (
                    <label className="mt-2 block text-xs text-[var(--muted)]">
                      Replace with
                      <select
                        className={`${inputClass} mt-1`}
                        value={replacements[e.slot_id] ?? ""}
                        onChange={(ev) => {
                          const next = { ...replacements };
                          if (!ev.target.value) delete next[e.slot_id];
                          else next[e.slot_id] = ev.target.value;
                          setReplacements(next);
                        }}
                      >
                        <option value="">Keep {e.name}</option>
                        {e.eligible_alternatives.map((a) => (
                          <option key={a.slug} value={a.slug}>
                            {a.name}
                            {a.why[0] ? ` — ${a.why[0]}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {(e.regression_options.length > 0 || e.progression_options.length > 0) && (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {e.regression_options.length ? `Easier: ${e.regression_options.map((x) => x.name).join(", ")}. ` : ""}
                      {e.progression_options.length ? `Progress later: ${e.progression_options.map((x) => x.name).join(", ")}.` : ""}
                    </p>
                  )}
                </li>
              ))}
              {s.exercises.length === 0 && <p className="font-sans text-sm text-[var(--muted)]">No prescribed exercises.</p>}
            </ol>
          </section>
        ))}
      </div>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Why this pool</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 font-sans text-xs">
            {result.rationale.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-4 font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Week at a glance</p>
          <div className="mt-2">
            <SelectionBoard sessions={result.sessions} compact />
          </div>
          <label className="mt-4 block font-sans text-xs text-[var(--muted)]">
            Override reason
            <input className={`${inputClass} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={pending} onClick={() => save(false)}>
              {pending ? "Saving…" : "Save selection"}
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
