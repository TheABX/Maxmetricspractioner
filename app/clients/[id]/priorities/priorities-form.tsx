"use client";

import { useState, useTransition } from "react";
import { saveProgrammingPriorities } from "@/app/engine-actions";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import { groupedPriorities } from "@/lib/priority-engine/engine";
import {
  LEVEL_LABEL,
  PRIORITY_LEVELS,
  qlabel,
  qualityKey,
  type PriorityLevel,
  type PriorityOverrides,
  type PriorityResult,
  type RankedPriority,
} from "@/lib/priority-engine/types";

const ORDER: PriorityLevel[] = ["REVIEW_REQUIRED", "P1_PRIMARY", "P2_SECONDARY", "P3_MONITOR", "MAINTAIN", "NOT_RELEVANT"];

export function PrioritiesForm({
  clientId,
  result,
  overrides: initial,
  confirmedAt,
}: {
  clientId: string;
  result: PriorityResult;
  overrides: PriorityOverrides;
  confirmedAt: string | null;
}) {
  const [overrides, setOverrides] = useState<PriorityOverrides>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const groups = groupedPriorities(result.priorities);

  function save(confirm: boolean) {
    setMsg(null);
    start(async () => {
      const res = await saveProgrammingPriorities({ client_id: clientId, overrides, confirm });
      setMsg("error" in res ? res.error : confirm ? "Saved and confirmed." : "Saved.");
    });
  }

  return (
    <div className="mt-8 space-y-5">
      {result.clusters.length > 0 && (
        <p className="font-sans text-sm text-[#1f3f6e]">
          Pattern: {result.clusters.map((c) => c.replaceAll("_", " ").toLowerCase()).join("; ")}
        </p>
      )}
      {ORDER.map((level) => (
        <section key={level} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{LEVEL_LABEL[level]}</h2>
          {groups[level].length === 0 && <p className="mt-2 font-sans text-sm text-[var(--muted)]">None</p>}
          <div className="mt-3 grid gap-3">
            {groups[level].map((p) => (
              <PriorityCard key={qualityKey(p)} p={p} overrides={overrides} setOverrides={setOverrides} />
            ))}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={pending} onClick={() => save(false)}>
          {pending ? "Saving…" : "Save priorities"}
        </button>
        <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => save(true)}>
          Save & confirm
        </button>
      </div>
      {msg && <p className="font-sans text-sm">{msg}</p>}
      <p className="font-sans text-xs text-[var(--muted)]">{confirmedAt ? `Confirmed ${new Date(confirmedAt).toLocaleString("en-AU")}.` : "Not confirmed."}</p>
    </div>
  );
}

function PriorityCard({
  p,
  overrides,
  setOverrides,
}: {
  p: RankedPriority;
  overrides: PriorityOverrides;
  setOverrides: (o: PriorityOverrides) => void;
}) {
  const key = qualityKey(p);
  const ov = overrides[key] ?? overrides[p.quality];
  return (
    <details className="rounded-lg border border-[var(--line)] bg-white p-3">
      <summary className="cursor-pointer font-sans text-sm">
        <span className="font-medium">{qlabel(p.quality)}</span>
        {p.laterality === "L" || p.laterality === "R" ? ` · ${p.laterality === "L" ? "left" : "right"}` : ""}
        {p.parent_quality ? <span className="text-[var(--muted)]"> · under {qlabel(p.parent_quality)}</span> : null}
        {ov ? <span className="ml-2 text-[11px] uppercase tracking-wide text-[#8a4b00]">override</span> : null}
      </summary>
      <div className="mt-3 grid gap-2 font-sans text-sm">
        <p className="text-xs text-[var(--muted)]">
          Automatic: {LEVEL_LABEL[p.automatic_priority]} · Goal {p.goal_relevance.replaceAll("_", " ").toLowerCase()} · Function{" "}
          {p.functional_relevance.toLowerCase()} · Confidence {p.confidence.toLowerCase()} · Trend {p.trend.replaceAll("_", " ").toLowerCase()}
          {p.cluster ? ` · ${p.cluster.replaceAll("_", " ").toLowerCase()}` : ""}
        </p>
        <ul className="list-disc pl-5 text-sm">
          {p.why.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <p>{p.recommended_quality_work}</p>
        <p className="text-xs text-[var(--muted)]">
          Supporting findings: {p.finding_ids.length} · {p.multi_test_support.replaceAll("_", " ").toLowerCase()}
        </p>
        <div className="grid gap-2 sm:grid-cols-[220px_1fr]">
          <label className="text-xs text-[var(--muted)]">
            Practitioner priority
            <select
              className={`${inputClass} mt-1`}
              value={ov?.value ?? ""}
              onChange={(e) => {
                const v = e.target.value as PriorityLevel | "";
                const next = { ...overrides };
                if (!v) delete next[key];
                else next[key] = { value: v, reason: next[key]?.reason ?? "", date: new Date().toISOString(), overridden_by: null };
                setOverrides(next);
              }}
            >
              <option value="">Use automatic ({LEVEL_LABEL[p.automatic_priority]})</option>
              {PRIORITY_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </label>
          {ov && (
            <label className="text-xs text-[var(--muted)]">
              Override reason
              <input
                className={`${inputClass} mt-1`}
                value={ov.reason}
                onChange={(e) => setOverrides({ ...overrides, [key]: { ...ov, reason: e.target.value } })}
              />
            </label>
          )}
        </div>
      </div>
    </details>
  );
}
