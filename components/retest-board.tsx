import { qlabel } from "@/lib/priority-engine/types";
import type { BodyRegion, ChangeStatus, MetricChange, RetestResult } from "@/lib/retest-engine/types";

const STATUS_TONE: Record<ChangeStatus, string> = {
  IMPROVED: "text-emerald-800",
  STABLE: "text-[var(--muted)]",
  DECLINED: "text-amber-800",
  UNCERTAIN: "text-[var(--muted)]",
  NOT_COMPARABLE: "text-[var(--muted)]",
};

export function RetestBoard({ result, compact = false }: { result: RetestResult; compact?: boolean }) {
  return (
    <div>
      <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{result.compare_label}</p>
      <p className="mt-1 font-sans text-sm">
        Improved {result.counts.IMPROVED} · Stable {result.counts.STABLE} · Declined {result.counts.DECLINED} · Not comparable{" "}
        {result.counts.NOT_COMPARABLE}
      </p>
      {!compact && (
        <ul className="mt-3 space-y-1 font-sans text-sm">
          {result.priority_outcomes.slice(0, 6).map((o) => (
            <li key={`${o.quality}-${o.laterality ?? ""}`}>
              {qlabel(o.quality)} — {o.outcome.replaceAll("_", " ").toLowerCase()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChangeLine({ row }: { row: MetricChange }) {
  return (
    <div className="font-sans text-sm">
      <p>
        <span className="font-medium">{row.label}</span>
        {row.previous_value != null && row.current_value != null && (
          <span className="text-[var(--muted)]">
            {" "}
            {fmt(row.previous_value)} → {fmt(row.current_value)} {row.unit}
            {row.domain === "SYMMETRY"
              ? ""
              : row.percentage_change != null
                ? ` (${signed(row.percentage_change)}%)`
                : ""}
          </span>
        )}
        <span className={`ml-2 text-xs uppercase tracking-[0.12em] ${STATUS_TONE[row.change_status]}`}>
          {row.change_status.replaceAll("_", " ")}
        </span>
      </p>
      {row.percentile_change != null && (
        <p className="text-xs text-[var(--muted)]">
          {fmt(row.previous_percentile)}th → {fmt(row.current_percentile)}th percentile ({signed(row.percentile_change)} points, not a{" "}
          {fmt(row.percentile_change)}% change)
        </p>
      )}
    </div>
  );
}

export function BodyMapGrid({ title, previous, current }: { title: string; previous: BodyRegion[]; current: BodyRegion[] }) {
  return (
    <div>
      <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <MapCol label="Previous" regions={previous} />
        <MapCol label="Current" regions={current} />
      </div>
    </div>
  );
}

function MapCol({ label, regions }: { label: string; regions: BodyRegion[] }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-3">
      <p className="font-sans text-xs text-[var(--muted)]">{label}</p>
      <ul className="mt-2 space-y-1">
        {regions.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 font-sans text-xs">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: heatHex(r.heat) }} />
              {r.label}
            </span>
            <span className="text-[var(--muted)]">{r.change ? r.change.replaceAll("_", " ").toLowerCase() : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function heatHex(t: number | null) {
  if (t == null) return "#d9d1c6";
  const x = Math.max(0, Math.min(1, t));
  if (x < 0.28) return "#b42318";
  if (x < 0.5) return "#e85d4c";
  if (x < 0.72) return "#e3b23c";
  if (x < 0.9) return "#7eb24b";
  return "#1f7a4d";
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(1);
}

function signed(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
}
