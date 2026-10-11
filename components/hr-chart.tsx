import { downsampleHr, formatHrTick, hrSpanMs, hrStats, hrWindowCopy, type HrSample } from "@/lib/wearable/hr";

export function HrChart({ samples }: { samples: HrSample[] }) {
  const pts = downsampleHr(samples, 96);
  const stats = hrStats(samples);
  const span = hrSpanMs(samples);
  const w = 320;
  const h = 120;
  const pl = 6;
  const pr = 6;
  const pt = 8;
  const pb = 8;
  const innerW = w - pl - pr;
  const innerH = h - pt - pb;
  const min = Math.max(40, (stats.min ?? 60) - 8);
  const max = Math.min(200, (stats.max ?? 100) + 8);
  const range = Math.max(1, max - min);
  const points = pts
    .map((p, i) => {
      const x = pl + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
      const y = pt + (1 - (p.bpm - min) / range) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
      <p className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Heart rate</p>
      <p className="mt-1 text-2xl">{stats.latest != null ? `${stats.latest} bpm` : "No HR yet"}</p>
      <p className="mt-1 font-sans text-sm text-[var(--muted)]">{hrWindowCopy(samples)}</p>
      {pts.length > 0 ? (
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-32 w-full" role="img" aria-label="Heart-rate graph">
          <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      ) : (
        <div className="mt-3 flex h-32 items-center justify-center rounded-lg border border-dashed border-[var(--line)] px-4">
          <p className="font-sans text-sm text-[var(--muted)]">
            Sync the band from the app. Five minutes of wear draws a short line. Five days draws the week.
          </p>
        </div>
      )}
      {samples.length > 0 ? (
        <div className="mt-1 flex justify-between font-sans text-xs text-[var(--muted)]">
          <span>{formatHrTick(samples[0]!.at, span)}</span>
          <span>{formatHrTick(samples[samples.length - 1]!.at, span)}</span>
        </div>
      ) : null}
      {stats.min != null && stats.max != null ? (
        <p className="mt-2 font-sans text-xs text-[var(--muted)]">
          Low {stats.min} · High {stats.max}. Daytime HR is not used for the recovery light.
        </p>
      ) : null}
    </div>
  );
}
