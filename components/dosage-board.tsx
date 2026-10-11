import { DAY_LABEL } from "@/lib/structure-engine/types";
import type { Day } from "@/lib/programming-profile/types";
import { formatDose, formatEffort } from "@/lib/dosage-engine/engine";
import type { DosageResult, VolumeRegion } from "@/lib/dosage-engine/types";

const REGION_ORDER: VolumeRegion[] = [
  "QUADRICEPS",
  "HAMSTRINGS",
  "GLUTES",
  "CHEST",
  "BACK",
  "SHOULDERS",
  "BICEPS",
  "TRICEPS",
  "CALVES",
  "TRUNK",
];

export function DosageBoard({ result, compact = false }: { result: DosageResult; compact?: boolean }) {
  return (
    <div className="grid gap-4">
      <WeeklySummary result={result} compact={compact} />
      {!compact &&
        result.sessions.map((s) => (
          <div key={s.day}>
            <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
              {DAY_LABEL[s.day as Day] ?? s.day}
              {s.duration_minutes ? ` · ${s.duration_minutes} min` : ""} · {s.label}
              {s.flags.length ? ` · ${s.flags.join(" · ")}` : ""}
            </p>
            {s.exercises.length === 0 ? (
              <p className="mt-1 font-sans text-sm text-[var(--muted)]">No prescribed work.</p>
            ) : (
              <ol className="mt-1 list-decimal space-y-1 pl-5 font-sans text-sm">
                {s.exercises.map((e) => (
                  <li key={e.slot_id}>
                    <span className="font-medium">{e.name}</span>
                    <span className="text-[var(--muted)]">
                      {" "}
                      · {formatDose(e)} · {formatEffort(e)} · rest {restLabel(e.rest_seconds_min, e.rest_seconds_max)}
                      {e.practitioner_overridden ? " · override" : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
    </div>
  );
}

export function WeeklySummary({ result, compact = false }: { result: DosageResult; compact?: boolean }) {
  const w = result.weekly;
  return (
    <div>
      <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Weekly dosage</p>
      <p className="mt-1 font-sans text-sm">
        Resistance {w.resistance_sessions} · {w.total_working_sets} working sets · Power {w.power_exposures} · Aerobic{" "}
        {w.aerobic_minutes} min · Mobility {w.mobility_exposures}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-sans text-xs sm:grid-cols-3">
        {REGION_ORDER.filter((r) => w.region_sets[r] > 0 || !compact).map((r) => (
          <div key={r} className="flex justify-between gap-2">
            <dt className="text-[var(--muted)]">{pretty(r)}</dt>
            <dd>{w.region_sets[r]}</dd>
          </div>
        ))}
      </dl>
      {result.flags.length > 0 && (
        <p className="mt-2 font-sans text-xs text-[var(--muted)]">Flags: {result.flags.join(" · ")}</p>
      )}
    </div>
  );
}

function restLabel(min: number, max: number) {
  if (!min && !max) return "—";
  if (min >= 60 && max >= 60) return `${min / 60}–${max / 60} min`;
  if (min === max) return min >= 60 ? `${min / 60} min` : `${min}s`;
  return `${min}–${max}s`;
}

function pretty(v: string) {
  return v.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
