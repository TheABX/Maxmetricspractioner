export type HrSample = {
  at: string;
  bpm: number;
  source?: "scheduled" | "minute" | "live" | "manual";
};

export function cleanHrSamples(rows: Array<{ at?: string; recorded_at?: string; bpm?: number | null; source?: HrSample["source"] }>): HrSample[] {
  const seen = new Set<string>();
  const out: HrSample[] = [];
  for (const row of rows) {
    const at = row.at ?? row.recorded_at ?? "";
    const bpm = Number(row.bpm);
    if (!at || !Number.isFinite(bpm) || bpm < 30 || bpm > 220) continue;
    if (seen.has(at)) continue;
    seen.add(at);
    out.push({ at, bpm, source: row.source });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export function downsampleHr(samples: HrSample[], max = 96): HrSample[] {
  if (samples.length <= max) return samples;
  const out: HrSample[] = [];
  const step = (samples.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    out.push(samples[Math.round(i * step)]!);
  }
  return out;
}

export function hrSpanMs(samples: HrSample[]): number {
  if (samples.length < 2) return 0;
  const first = Date.parse(samples[0]!.at);
  const last = Date.parse(samples[samples.length - 1]!.at);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;
  return Math.max(0, last - first);
}

export function formatHrTick(iso: string, spanMs: number): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  if (spanMs < 3 * 60 * 60 * 1000) {
    return d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  }
  if (spanMs < 48 * 60 * 60 * 1000) {
    return d.toLocaleString("en-AU", { weekday: "short", hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

export function hrWindowCopy(samples: HrSample[]): string {
  if (samples.length === 0) return "Wear the band, then sync. The graph fills from the first reading — five minutes or five days.";
  if (samples.length === 1) return "First reading is in. Keep wearing it and the line will grow.";
  const span = hrSpanMs(samples);
  if (span < 10 * 60 * 1000) return `Heart rate over the last ${Math.max(1, Math.round(span / 60000))} minutes`;
  if (span < 3 * 60 * 60 * 1000) return `Heart rate over the last ${Math.round(span / 60000)} minutes`;
  if (span < 36 * 60 * 60 * 1000) return `Heart rate over the last ${Math.max(1, Math.round(span / 3600000))} hours`;
  return `Heart rate over the last ${Math.max(1, Math.round(span / 86400000))} days`;
}

export function hrStats(samples: HrSample[]): { latest: number | null; min: number | null; max: number | null } {
  if (!samples.length) return { latest: null, min: null, max: null };
  let min = samples[0]!.bpm;
  let max = samples[0]!.bpm;
  for (const s of samples) {
    if (s.bpm < min) min = s.bpm;
    if (s.bpm > max) max = s.bpm;
  }
  return { latest: samples[samples.length - 1]!.bpm, min, max };
}
