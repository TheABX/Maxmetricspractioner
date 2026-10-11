import { recoveryFromDays } from "../lib/wearable/recovery";

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const today = ymd(2026, 9, 29);
const baseline = recoveryFromDays(
  [
    {
      day: today,
      resting_hr: 54,
      sleep_minutes: 420,
      steps: 8000,
      active_kcal: 300,
      avg_hr: 72,
      spo2: 97,
      feel: null,
      synced_at: today,
    },
  ],
  today,
);
if (baseline.light !== "baseline") {
  console.error("expected baseline with one night", baseline);
  process.exit(1);
}

const days = Array.from({ length: 16 }, (_, i) => {
  const day = ymd(2026, 9, 14 + i);
  return {
    day,
    resting_hr: day === today ? 62 : 54,
    sleep_minutes: 420,
    steps: 8000,
    active_kcal: 300,
    avg_hr: 72,
    spo2: 97,
    feel: null,
    synced_at: day,
  };
});
const high = recoveryFromDays(days, today);
if (high.light !== "amber" && high.light !== "red") {
  console.error("expected amber/red when RHR is up", high);
  process.exit(1);
}
console.log("qc-band recovery checks ok", high.light);
