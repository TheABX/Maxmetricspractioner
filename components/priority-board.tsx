import { LEVEL_LABEL, qlabel, type PriorityLevel, type RankedPriority } from "@/lib/priority-engine/types";
import { groupedPriorities } from "@/lib/priority-engine/engine";

const ORDER: PriorityLevel[] = ["P1_PRIMARY", "P2_SECONDARY", "P3_MONITOR", "MAINTAIN", "REVIEW_REQUIRED", "NOT_RELEVANT"];

export function PriorityBoard({
  priorities,
  compact = false,
  hideIrrelevant = true,
}: {
  priorities: RankedPriority[];
  compact?: boolean;
  hideIrrelevant?: boolean;
}) {
  const groups = groupedPriorities(priorities);
  const shown = hideIrrelevant ? ORDER.filter((l) => l !== "NOT_RELEVANT" || groups[l].length) : ORDER;
  return (
    <div className={compact ? "grid gap-3" : "grid gap-4 md:grid-cols-2"}>
      {shown.map((level) => {
        const rows = groups[level];
        if (compact && !rows.length && level === "NOT_RELEVANT") return null;
        return (
          <div key={level}>
            <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{LEVEL_LABEL[level]}</p>
            {rows.length === 0 ? (
              <p className="mt-1 font-sans text-sm text-[var(--muted)]">None</p>
            ) : (
              <ul className="mt-1 space-y-1 font-sans text-sm">
                {rows.map((p) => (
                  <li key={`${p.quality}:${p.laterality ?? ""}`}>
                    <span className="font-medium">{qlabel(p.quality)}</span>
                    {p.laterality === "L" || p.laterality === "R" ? <span className="text-[var(--muted)]"> · {p.laterality === "L" ? "left" : "right"}</span> : null}
                    {p.practitioner_priority ? <span className="ml-2 text-[11px] uppercase tracking-wide text-[#8a4b00]">overridden</span> : null}
                    {!compact && p.why[0] ? <p className="text-xs text-[var(--muted)]">{p.why[0]}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ClientPriorityPreview({ priorities }: { priorities: RankedPriority[] }) {
  const improve = priorities.filter((p) => p.effective_priority === "P1_PRIMARY" || p.effective_priority === "P2_SECONDARY");
  const strengths = priorities.filter((p) => p.effective_priority === "MAINTAIN");
  return (
    <div className="font-sans text-sm">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Your main priorities</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        {improve.length === 0 && <li className="list-none pl-0 text-[var(--muted)]">No main training priorities yet.</li>}
        {improve.map((p) => (
          <li key={p.quality}>{p.client_line}</li>
        ))}
      </ol>
      <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Current strengths</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {strengths.length === 0 && <li className="list-none pl-0 text-[var(--muted)]">None flagged to maintain.</li>}
        {strengths.map((p) => (
          <li key={p.quality}>{qlabel(p.quality)}</li>
        ))}
      </ul>
    </div>
  );
}
