import { cleanHrSamples, downsampleHr, hrSpanMs, hrWindowCopy } from "../lib/wearable/hr";

const fiveMin = cleanHrSamples([
  { at: "2026-09-30T02:00:00.000Z", bpm: 72 },
  { at: "2026-09-30T02:01:00.000Z", bpm: 74 },
  { at: "2026-09-30T02:02:00.000Z", bpm: 76 },
  { at: "2026-09-30T02:03:00.000Z", bpm: 73 },
  { at: "2026-09-30T02:04:00.000Z", bpm: 71 },
  { at: "2026-09-30T02:05:00.000Z", bpm: 70 },
]);
if (Math.abs(hrSpanMs(fiveMin) - 5 * 60 * 1000) > 1000) {
  console.error("expected a 5-minute span", hrSpanMs(fiveMin));
  process.exit(1);
}
if (!hrWindowCopy(fiveMin).includes("minutes")) {
  console.error("expected minutes copy", hrWindowCopy(fiveMin));
  process.exit(1);
}

const fiveDays = cleanHrSamples(
  Array.from({ length: 5 * 24 }, (_, i) => ({
    at: new Date(Date.UTC(2026, 8, 25, i)).toISOString(),
    bpm: 60 + (i % 12),
  })),
);
if (Math.abs(hrSpanMs(fiveDays) - 4.96 * 24 * 60 * 60 * 1000) > 2 * 60 * 60 * 1000) {
  console.error("expected a ~5-day span", hrSpanMs(fiveDays), hrWindowCopy(fiveDays));
  process.exit(1);
}
if (!hrWindowCopy(fiveDays).includes("days")) {
  console.error("expected days copy", hrWindowCopy(fiveDays));
  process.exit(1);
}

const down = downsampleHr(fiveDays, 20);
if (down.length !== 20) {
  console.error("expected downsample to 20", down.length);
  process.exit(1);
}

console.log("hr graph checks ok", hrWindowCopy(fiveMin), hrWindowCopy(fiveDays));
