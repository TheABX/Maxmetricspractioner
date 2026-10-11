import type { buildSummary } from "@/lib/programming-profile/derive";

/** The practitioner verification summary — shared by the editor, client record and program builder. */
export function ProgrammingSummary({
  summary,
  compact = false,
}: {
  summary: ReturnType<typeof buildSummary>;
  compact?: boolean;
}) {
  const rows = compact ? summary.lines.filter(([k]) => !["Preferences", "Movement competency", "Training tolerance", "Foundation phase"].includes(k)) : summary.lines;
  return (
    <dl className={`grid gap-x-4 font-sans text-sm ${compact ? "gap-y-1" : "gap-y-2"} sm:grid-cols-[max-content_1fr]`}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] sm:pt-0.5">{k}</dt>
          <dd className={k === "Main constraints" && summary.constraints.length ? "text-[#8a4b00]" : ""}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
