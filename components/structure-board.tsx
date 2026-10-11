import { DAY_LABEL, slabel, type StructureResult } from "@/lib/structure-engine/types";
import { qlabel } from "@/lib/priority-engine/types";

export function StructureBoard({ structure, compact = false }: { structure: StructureResult; compact?: boolean }) {
  const days = compact ? structure.weekly_schedule.filter((s) => s.kind !== "REST") : structure.weekly_schedule;
  return (
    <div className="font-sans text-sm">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
        <dt className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Sessions</dt>
        <dd>
          {structure.recommended_sessions_per_week} prescribed · {structure.weekly_training_minutes} min structured
          {structure.weekly_available_minutes ? ` · ${structure.weekly_available_minutes} min available` : ""}
        </dd>
        <dt className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Split</dt>
        <dd>{slabel(structure.session_split)}</dd>
        <dt className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Budget used</dt>
        <dd>{structure.effective_training_budget} min effective</dd>
      </dl>
      {structure.constraint_flags.length > 0 && (
        <p className="mt-2 text-xs text-[#8a4b00]">{structure.constraint_flags.join(" · ").replaceAll("_", " ")}</p>
      )}
      <ul className="mt-3 space-y-1">
        {days.map((s) => (
          <li key={s.day} className="flex flex-wrap gap-x-2">
            <span className="min-w-[88px] text-[var(--muted)]">{DAY_LABEL[s.day]}</span>
            <span>
              {s.kind === "REST" ? "Rest" : s.label}
              {s.kind === "PRESCRIBED" ? ` · ${s.duration_minutes} min` : s.kind === "OPTIONAL" ? " · optional" : ""}
            </span>
          </li>
        ))}
      </ul>
      {!compact && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Weekly emphasis</p>
          <ul className="mt-1 space-y-1">
            {structure.priority_time_allocation
              .filter((a) => a.percent > 0)
              .sort((a, b) => b.percent - a.percent)
              .slice(0, 8)
              .map((a) => (
                <li key={a.quality}>
                  {qlabel(a.quality)} — {a.emphasis} ({a.percent}% · ~{a.minutes} min)
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
