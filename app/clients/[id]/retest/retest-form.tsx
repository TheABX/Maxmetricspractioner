"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { applyNextBlockPriorities, saveRetestDate, saveRetestReview } from "@/app/retest-actions";
import { BodyMapGrid, ChangeLine, RetestBoard } from "@/components/retest-board";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import { LEVEL_LABEL, qlabel } from "@/lib/priority-engine/types";
import type { SessionOption } from "@/lib/retest-engine/load";
import type { RetestResult } from "@/lib/retest-engine/types";

export function RetestForm({
  clientId,
  firstName,
  sessions,
  currentId,
  compareId,
  result,
  schedule,
  confirmedAt,
  notes,
  contextualChange,
  goalsConfirmed,
}: {
  clientId: string;
  firstName: string;
  sessions: SessionOption[];
  currentId: string | null;
  compareId: string | null;
  result: RetestResult;
  schedule: { expected_retest_date: string | null; program_id: string | null; weeks: number | null };
  confirmedAt: string | null;
  notes: string;
  contextualChange: string;
  goalsConfirmed: boolean | null;
}) {
  const router = useRouter();
  const [goals, setGoals] = useState<boolean | null>(goalsConfirmed);
  const [context, setContext] = useState(contextualChange);
  const [note, setNote] = useState(notes);
  const [suppress, setSuppress] = useState(false);
  const [retestDate, setRetestDate] = useState(schedule.expected_retest_date ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pair(current: string, compare: string) {
    const q = new URLSearchParams();
    if (current) q.set("current", current);
    if (compare) q.set("compare", compare);
    router.push(`/clients/${clientId}/retest?${q.toString()}`);
  }

  function save(confirm: boolean) {
    setMsg(null);
    start(async () => {
      const r = await saveRetestReview({
        client_id: clientId,
        current_id: currentId,
        compare_id: compareId,
        override: {
          goals_still_current: goals,
          contextual_change: context,
          notes: note,
          suppress_comms: suppress,
        },
        confirm,
      });
      setMsg("error" in r ? r.error : confirm ? "Saved and confirmed." : "Saved.");
    });
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Compare</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="font-sans text-xs text-[var(--muted)]">
              Current
              <select
                className={`${inputClass} mt-1`}
                value={currentId ?? ""}
                onChange={(e) => pair(e.target.value, compareId ?? "")}
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.assessment_date} · {s.assessment_type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-sans text-xs text-[var(--muted)]">
              Previous
              <select
                className={`${inputClass} mt-1`}
                value={compareId ?? ""}
                onChange={(e) => pair(currentId ?? "", e.target.value)}
              >
                <option value="">None</option>
                {sessions
                  .filter((s) => s.id !== currentId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.assessment_date} · {s.assessment_type.replaceAll("_", " ")}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p className="mt-3 font-sans text-sm">
            Improved {result.counts.IMPROVED} · Stable {result.counts.STABLE} · Declined {result.counts.DECLINED} · Uncertain{" "}
            {result.counts.UNCERTAIN} · Not comparable {result.counts.NOT_COMPARABLE}
          </p>
        </article>

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Top improvements</p>
          <ul className="mt-3 space-y-3">
            {result.top_improvements.length === 0 && <li className="font-sans text-sm text-[var(--muted)]">No change larger than conservative noise.</li>}
            {result.top_improvements.map((r) => (
              <li key={r.key}>
                <ChangeLine row={r} />
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Still to improve</p>
          <ul className="mt-3 space-y-3">
            {result.still_to_improve.length === 0 && <li className="font-sans text-sm text-[var(--muted)]">No remaining matched priorities flagged.</li>}
            {result.still_to_improve.map((r) => (
              <li key={r.key}>
                <ChangeLine row={r} />
                <p className="mt-1 font-sans text-xs text-[var(--muted)]">{r.client_line}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Priority outcomes</p>
          <ul className="mt-3 space-y-3">
            {result.priority_outcomes.length === 0 && <li className="font-sans text-sm text-[var(--muted)]">Save Layer 2 priorities on the previous block to score outcomes.</li>}
            {result.priority_outcomes.map((o) => (
              <li key={`${o.quality}-${o.laterality ?? ""}`} className="rounded-lg border border-[var(--line)] bg-white p-3">
                <p className="font-sans text-sm">
                  {qlabel(o.quality)} · {LEVEL_LABEL[o.previous_level]} → {LEVEL_LABEL[o.suggested_level]}
                </p>
                <p className="mt-1 font-sans text-xs uppercase tracking-[0.12em] text-[var(--muted)]">{o.outcome.replaceAll("_", " ")}</p>
                <ul className="mt-2 list-disc pl-5 font-sans text-xs text-[var(--muted)]">
                  {o.why.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Next 12-week priorities</p>
          <ul className="mt-3 space-y-2 font-sans text-sm">
            {result.next_block.map((n) => (
              <li key={`${n.quality}-${n.laterality ?? ""}-${n.level}`}>
                <span className="font-medium">{LEVEL_LABEL[n.level]}</span> · {qlabel(n.quality)}
                <span className="text-[var(--muted)]"> — {n.why[0]}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={`${ghostButtonClass} mt-4`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await applyNextBlockPriorities(clientId, currentId, compareId);
                setMsg("error" in r ? r.error : "Suggested priorities written to Layer 2. Review and confirm there — then rebuild structure, selection, and dosage. Do not copy the old program.");
              })
            }
          >
            Send to Layer 2
          </button>
        </article>

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Body maps</p>
          <p className="mt-1 font-sans text-xs text-[var(--muted)]">Heat is reference position or symmetry, not a medical diagnosis.</p>
          <div className="mt-4 space-y-5">
            <BodyMapGrid title="Strength" previous={result.body_maps.strength.previous} current={result.body_maps.strength.current} />
            <BodyMapGrid title="Symmetry" previous={result.body_maps.symmetry.previous} current={result.body_maps.symmetry.current} />
            <BodyMapGrid title="Mobility" previous={result.body_maps.mobility.previous} current={result.body_maps.mobility.current} />
          </div>
        </article>

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Longitudinal</p>
          <ul className="mt-3 space-y-3">
            {result.series.filter((s) => s.points.length > 1).length === 0 && (
              <li className="font-sans text-sm text-[var(--muted)]">Need at least two assessments with the same metric.</li>
            )}
            {result.series
              .filter((s) => s.points.length > 0)
              .map((s) => (
                <li key={s.key} className="font-sans text-sm">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-[var(--muted)]">
                    {" "}
                    {s.points.map((p) => `${p.date.slice(0, 7)} ${p.value.toFixed(1)}${s.unit}`).join(" → ")}
                  </span>
                </li>
              ))}
          </ul>
        </article>

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">All matched metrics</p>
          <ul className="mt-3 space-y-2">
            {result.vs_previous.map((r) => (
              <li key={r.key}>
                <ChangeLine row={r} />
                <p className="font-sans text-xs text-[var(--muted)]">{r.interpretation}</p>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <RetestBoard result={result} />
          <p className="mt-3 font-sans text-sm">{result.practitioner_summary}</p>
          <p className="mt-3 font-sans text-xs text-[var(--muted)]">Client: {result.client_summary}</p>
          {result.program_issue !== "NONE" && (
            <p className="mt-3 font-sans text-xs uppercase tracking-[0.12em]">{result.program_issue.replaceAll("_", " ")}</p>
          )}
          <p className="mt-3 font-sans text-xs text-[var(--muted)]">
            Scorecard: {result.scorecard.priorities_resolved}/{result.scorecard.priorities_total} resolved · {result.scorecard.priorities_improved} improved
            {result.scorecard.adherence_percent != null ? ` · adherence ${Math.round(result.scorecard.adherence_percent * 100)}%` : ""}
            {result.scorecard.suggested_stage ? ` · stage ${result.scorecard.training_stage} → ${result.scorecard.suggested_stage}?` : ""}
          </p>
          <p className="mt-1 font-sans text-[11px] text-[var(--muted)]">Not a composite health score.</p>
        </article>

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Goals still current?</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={goals === true ? buttonClass : ghostButtonClass} onClick={() => setGoals(true)}>
              Yes
            </button>
            <button type="button" className={goals === false ? buttonClass : ghostButtonClass} onClick={() => setGoals(false)}>
              Update goals
            </button>
          </div>
          <p className="mt-2 font-sans text-xs text-[var(--muted)]">
            {firstName}&apos;s next block should not assume the original goal is unchanged.
          </p>
          <label className="mt-3 block font-sans text-xs text-[var(--muted)]">
            Contextual change
            <textarea className={`${inputClass} mt-1`} rows={3} value={context} onChange={(e) => setContext(e.target.value)} placeholder="New restriction, illness, life constraint…" />
          </label>
          <label className="mt-3 block font-sans text-xs text-[var(--muted)]">
            Practitioner notes
            <textarea className={`${inputClass} mt-1`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="mt-3 flex items-center gap-2 font-sans text-xs">
            <input type="checkbox" checked={suppress} onChange={(e) => setSuppress(e.target.checked)} />
            Don&apos;t send the Layer 7 progress note on confirm
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={pending} onClick={() => save(false)}>
              {pending ? "Saving…" : "Save review"}
            </button>
            <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => save(true)}>
              Save &amp; confirm
            </button>
          </div>
          {msg && <p className="mt-3 font-sans text-sm">{msg}</p>}
          <p className="mt-2 font-sans text-xs text-[var(--muted)]">{confirmedAt ? `Confirmed ${new Date(confirmedAt).toLocaleString("en-AU")}.` : "Not confirmed."}</p>
        </article>

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Retest date</p>
          <input className={`${inputClass} mt-2`} type="date" value={retestDate} onChange={(e) => setRetestDate(e.target.value)} />
          <button
            type="button"
            className={`${ghostButtonClass} mt-3`}
            disabled={pending || !retestDate}
            onClick={() =>
              start(async () => {
                const r = await saveRetestDate({ client_id: clientId, program_id: schedule.program_id, date: retestDate });
                setMsg("error" in r ? r.error : "Retest date saved. Layer 7 can remind from week 10.");
              })
            }
          >
            Save date
          </button>
        </article>
      </aside>
    </div>
  );
}
