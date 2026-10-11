"use client";

import { useState, useTransition } from "react";
import { saveProgramAdaptation } from "@/app/engine-actions";
import { AdaptationBoard } from "@/components/adaptation-board";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import type { AdaptationOverride, AdaptationResult, DecisionState } from "@/lib/adaptation-engine/types";

const STATES: DecisionState[] = ["PROGRESS", "HOLD", "REGRESS", "REVIEW", "PAUSE"];

export function AdaptationForm({
  clientId,
  result,
  override,
  confirmedAt,
}: {
  clientId: string;
  result: AdaptationResult;
  override: AdaptationOverride | null;
  confirmedAt: string | null;
}) {
  const [slots, setSlots] = useState<AdaptationOverride["exercises"]>(override?.exercises ?? {});
  const [reason, setReason] = useState(override?.reason ?? "");
  const [level, setLevel] = useState(override?.automation_level ?? result.automation_level);
  const [suppress, setSuppress] = useState(override?.suppress_messages ?? false);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(confirm: boolean) {
    setMsg(null);
    start(async () => {
      const res = await saveProgramAdaptation({
        client_id: clientId,
        override: { exercises: slots, automation_level: level, suppress_messages: suppress, reason },
        confirm,
      });
      setMsg("error" in res ? res.error : confirm ? "Saved and confirmed." : "Saved.");
    });
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        {result.exercises.map((e) => {
          const o = slots[e.slot_id];
          const state = o?.state ?? e.state;
          return (
            <article key={e.slot_id} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-sans text-sm">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-[var(--muted)]"> · {state} · {e.status.replaceAll("_", " ").toLowerCase()}</span>
                </h2>
                <button type="button" className="font-sans text-xs underline" onClick={() => setOpen(open === e.slot_id ? null : e.slot_id)}>
                  Override
                </button>
              </div>
              <p className="mt-2 font-sans text-sm">{e.action.replaceAll("_", " ")}</p>
              <ul className="mt-2 list-disc pl-5 font-sans text-xs text-[var(--muted)]">
                {e.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              {e.proposed && (
                <div className="mt-3 rounded-lg border border-[var(--line)] bg-white p-3 font-sans text-xs">
                  <p className="uppercase tracking-[0.12em] text-[var(--muted)]">Change preview</p>
                  <p className="mt-1">Current: {e.proposed.current}</p>
                  <p>Proposed: {e.proposed.proposed}</p>
                  <p className="mt-1 text-[var(--muted)]">{e.proposed.reason}</p>
                  <p className="mt-1 text-[var(--muted)]">{e.proposed.auto_eligible ? "Eligible for low-risk auto if Level 2 is on." : "Practitioner approval required."}</p>
                </div>
              )}
              {e.client_message && (
                <blockquote className="mt-3 border-l-2 border-[var(--line)] pl-3 font-sans text-sm italic">{e.client_message.body}</blockquote>
              )}
              {open === e.slot_id && (
                <label className="mt-3 block font-sans text-xs text-[var(--muted)]">
                  Decision
                  <select
                    className={`${inputClass} mt-1`}
                    value={state}
                    onChange={(ev) => setSlots({ ...slots, [e.slot_id]: { ...slots[e.slot_id], state: ev.target.value as DecisionState } })}
                  >
                    {STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </article>
          );
        })}
        {result.exercises.length === 0 && <p className="font-sans text-sm text-[var(--muted)]">No prescribed exercises to adapt yet.</p>}
      </div>
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <AdaptationBoard result={result} compact />
          <h2 className="mt-4 font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">14-day review</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-sans text-xs">
            {result.rationale.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {result.client.queue.length > 0 && (
            <div className="mt-3">
              <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Queue</p>
              <ul className="mt-1 space-y-1 font-sans text-xs">
                {result.client.queue.map((q) => (
                  <li key={q.id}>
                    {q.severity}: {q.issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <label className="mt-4 block font-sans text-xs text-[var(--muted)]">
            Automation
            <select className={`${inputClass} mt-1`} value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
              <option value="LEVEL_1_SUGGEST">Level 1 — suggest only</option>
              <option value="LEVEL_2_LOW_RISK">Level 2 — low-risk auto</option>
              <option value="LEVEL_3_ADVANCED">Level 3 — broader auto</option>
            </select>
          </label>
          <label className="mt-3 flex items-center gap-2 font-sans text-xs">
            <input type="checkbox" checked={suppress} onChange={(e) => setSuppress(e.target.checked)} />
            Suppress drafted messages
          </label>
          <label className="mt-3 block font-sans text-xs text-[var(--muted)]">
            Override reason
            <input className={`${inputClass} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={pending} onClick={() => save(false)}>
              {pending ? "Saving…" : "Save review"}
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
