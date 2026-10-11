export type Feel = "good" | "off" | "wrecked";
export type Light = "green" | "amber" | "red" | "baseline";

export type WearableDay = {
  day: string;
  resting_hr: number | null;
  sleep_minutes: number | null;
  steps: number | null;
  active_kcal: number | null;
  avg_hr: number | null;
  spo2: number | null;
  sleep_start?: string | null;
  sleep_end?: string | null;
  systolic?: number | null;
  diastolic?: number | null;
  measured_at?: string | null;
  feel: Feel | null;
  synced_at: string | null;
};

export type Recovery = {
  light: Light;
  title: string;
  why: string;
  rhr: number | null;
  rhrDelta: number | null;
  baselineHr: number | null;
  sleepHours: number | null;
  nights: number;
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function wearableDayHasMetrics(day: WearableDay | null | undefined): boolean {
  if (!day) return false;
  return (
    (day.resting_hr != null && Number.isFinite(day.resting_hr)) ||
    (day.sleep_minutes != null && day.sleep_minutes > 0) ||
    (day.steps != null && day.steps > 0) ||
    (day.active_kcal != null && day.active_kcal > 0)
  );
}

export function latestWearableDay(days: WearableDay[], today: string): WearableDay | null {
  const todays = days.find((d) => d.day === today) ?? null;
  if (wearableDayHasMetrics(todays)) return todays;
  const sorted = [...days].sort((a, b) => b.day.localeCompare(a.day));
  return sorted.find(wearableDayHasMetrics) ?? todays;
}

export function labelWearableDay(day: string, today: string): string {
  if (day === today) return "Today";
  const y = new Date(`${today}T12:00:00`);
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  if (day === yesterday) return "Yesterday";
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

export function recoveryFromDays(days: WearableDay[], today: string): Recovery {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const withHr = sorted.filter((d) => num(d.resting_hr) != null);
  const tonight = latestWearableDay(days, today);
  const history = withHr.filter((d) => d.day !== tonight?.day).slice(-28);

  if (history.length < 7 && withHr.length < 14) {
    return {
      light: "baseline",
      title: "Building your baseline",
      why: "Wear the band at night for about two weeks. Until then this is not a recovery call.",
      rhr: num(tonight?.resting_hr),
      rhrDelta: null,
      baselineHr: null,
      sleepHours: tonight?.sleep_minutes != null ? tonight.sleep_minutes / 60 : null,
      nights: withHr.length,
    };
  }

  const hrs = history.map((d) => num(d.resting_hr)!);
  const baselineHr = hrs.reduce((a, b) => a + b, 0) / hrs.length;
  const rhr = num(tonight?.resting_hr);
  const rhrDelta = rhr != null ? rhr - baselineHr : null;
  const sleepHours = tonight?.sleep_minutes != null ? tonight.sleep_minutes / 60 : null;
  const typicalSleep =
    history.filter((d) => d.sleep_minutes != null).reduce((a, d) => a + (d.sleep_minutes ?? 0), 0) /
      Math.max(1, history.filter((d) => d.sleep_minutes != null).length) /
    60;

  const flags: string[] = [];
  let off = 0;
  if (rhrDelta != null && rhrDelta >= 6) {
    off += 1;
    flags.push(`resting HR ${Math.round(rhrDelta)} bpm above your usual`);
  } else if (rhrDelta != null && rhrDelta >= 3.5) {
    off += 1;
    flags.push("resting HR a little high");
  }
  if (sleepHours != null && typicalSleep > 0 && sleepHours <= typicalSleep - 1.5) {
    off += 1;
    flags.push(`short night (${sleepHours.toFixed(1)} h)`);
  } else if (sleepHours != null && sleepHours < 5.5) {
    off += 1;
    flags.push("short night");
  }
  if (tonight?.feel === "wrecked") off += 2;
  else if (tonight?.feel === "off") off += 1;
  if (tonight?.feel === "good" && off === 1) off -= 1;

  const light: Light = off >= 2 ? "red" : off === 1 ? "amber" : "green";
  const title = light === "red" ? "Red day" : light === "amber" ? "Amber day" : "Green day";
  const why =
    flags.length === 0
      ? "Night resting HR and sleep look like your usual. Not a medical diagnosis."
      : `${flags.join(", ")}. Based on last night, not a medical diagnosis.`;

  return {
    light,
    title,
    why,
    rhr,
    rhrDelta,
    baselineHr,
    sleepHours,
    nights: withHr.length,
  };
}
