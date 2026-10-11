import type { Day } from "@/lib/programming-profile/types";
import { DAY_LABEL } from "@/lib/structure-engine/types";
import type { SelectedSession } from "@/lib/exercise-kb/types";

export function SelectionBoard({ sessions, compact = false }: { sessions: SelectedSession[]; compact?: boolean }) {
  return (
    <div className="grid gap-4">
      {sessions.map((s) => (
        <div key={s.day}>
          <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
            {DAY_LABEL[s.day as Day] ?? s.day}
            {s.duration_minutes ? ` · ${s.duration_minutes} min` : ""} · {s.label}
          </p>
          {s.exercises.length === 0 ? (
            <p className="mt-1 font-sans text-sm text-[var(--muted)]">{s.session_type === "OPTIONAL_ACTIVITY" ? "Optional activity — no prescribed exercises." : "No exercises selected."}</p>
          ) : (
            <ol className="mt-1 list-decimal space-y-1 pl-5 font-sans text-sm">
              {s.exercises.map((e) => (
                <li key={e.slot_id}>
                  <span className="font-medium">{e.name}</span>
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {e.intent.replaceAll("_", " ").toLowerCase()}
                    {e.priority && e.priority !== "MAINTAIN" ? ` · ${e.priority.replaceAll("_", " ")}` : ""}
                    {e.practitioner_locked ? " · locked" : ""}
                  </span>
                  {!compact && e.selection_reason[0] ? <p className="text-xs text-[var(--muted)]">{e.selection_reason[0]}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}
