import { resolveMovement, type MovementProfile } from "./movements";

export const NUMERIC_FIELDS = [
  "peak_force_kg",
  "peak_force_percent",
  "relative_peak_force",
  "time_to_peak_force_ms",
  "mean_force_kg",
  "mean_force_percent",
  "force_at_peak_kg",
  "force_100ms_kg",
  "force_200ms_kg",
  "force_300ms_kg",
  "rfd_peak_ns",
  "rfd_100ms_ns",
  "rfd_200ms_ns",
  "rfd_300ms_ns",
  "impulse_peak_ns",
  "impulse_100ms_ns",
  "impulse_200ms_ns",
  "impulse_300ms_ns",
  "mean_force_at_peak_kg",
  "mean_force_100ms_kg",
  "mean_force_200ms_kg",
  "mean_force_300ms_kg",
] as const;

export type NumericField = (typeof NUMERIC_FIELDS)[number];

export type DeviceRow = {
  performed_at: string | null;
  athlete_name: string | null;
  movement_name: string | null;
  side: "L+R" | "L" | "R" | string;
} & Record<NumericField, number | null>;

export type ForcePlateTrialPreview = {
  trial: number;
  performed_at: string | null;
  athlete_name: string | null;
  movement_name: string | null;
  movement: MovementProfile;
  combined: DeviceRow | null;
  left: DeviceRow | null;
  right: DeviceRow | null;
  warnings: string[];
};

export type ImportWarning = {
  level: "error" | "warning";
  message: string;
};

export type ForcePlateParseResult = {
  fileType: "FORCE_PLATE_EXPORT_V1" | "UNKNOWN";
  athleteName: string | null;
  movements: string[];
  dateRange: { start: string | null; end: string | null };
  hasLrData: boolean;
  testsDetected: number;
  trials: ForcePlateTrialPreview[];
  warnings: ImportWarning[];
};

type HeaderField = NumericField | "athlete_name" | "movement_name" | "side";

const HEADER_ALIASES: { field: HeaderField; match: RegExp }[] = [
  { field: "athlete_name", match: /^(名称|name|athlete|athletename)$/i },
  { field: "movement_name", match: /^(动作|movement|action|exercise|test)$/i },
  { field: "side", match: /^(l\/r|lr|side)$/i },
  { field: "peak_force_kg", match: /^(峰值力\(kg\)|peakforce\(kg\)|peakforcekg)$/i },
  { field: "peak_force_percent", match: /^(峰值力\(%\)|peakforce\(%\)|peakforce%)$/i },
  { field: "relative_peak_force", match: /^(相对峰值力量|relativepeakforce|relativepeakstrength)$/i },
  { field: "time_to_peak_force_ms", match: /^(峰值到达时间\(ms\)|timetopeakforce\(ms\)|timetopeak)$/i },
  { field: "mean_force_kg", match: /^(均值力\(kg\)|meanforce\(kg\)|meanforcekg)$/i },
  { field: "mean_force_percent", match: /^(均值力\(%\)|meanforce\(%\)|meanforce%)$/i },
  { field: "force_at_peak_kg", match: /^(力@峰值\(kg\)|force@peak\(kg\)|forceatpeak)$/i },
  { field: "force_100ms_kg", match: /^(力@100ms|force@100ms|force100ms)$/i },
  { field: "force_200ms_kg", match: /^(力@200ms|force@200ms|force200ms)$/i },
  { field: "force_300ms_kg", match: /^(力@300ms|force@300ms|force300ms)$/i },
  { field: "rfd_peak_ns", match: /^(rfd@峰值\(n\/s\)|rfd@peak\(n\/s\)|rfd@peak|rfdpeak)$/i },
  { field: "rfd_100ms_ns", match: /^(rfd@100ms)$/i },
  { field: "rfd_200ms_ns", match: /^(rfd@200ms)$/i },
  { field: "rfd_300ms_ns", match: /^(rfd@300ms)$/i },
  { field: "impulse_peak_ns", match: /^(冲量@峰值\(ns\)|impulse@peak\(ns\)|impulse@peak|impulsepeak)$/i },
  { field: "impulse_100ms_ns", match: /^(冲量@100ms|impulse@100ms)$/i },
  { field: "impulse_200ms_ns", match: /^(冲量@200ms|impulse@200ms)$/i },
  { field: "impulse_300ms_ns", match: /^(冲量@300ms|impulse@300ms)$/i },
  { field: "mean_force_at_peak_kg", match: /^(均值力@峰值\(kg\)|meanforce@peak\(kg\)|meanforce@peak)$/i },
  { field: "mean_force_100ms_kg", match: /^(均值力@100ms|meanforce@100ms)$/i },
  { field: "mean_force_200ms_kg", match: /^(均值力@200ms|meanforce@200ms)$/i },
  { field: "mean_force_300ms_kg", match: /^(均值力@300ms|meanforce@300ms)$/i },
];

export function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) return null;
  const raw = String(value).trim().replace(/,/g, "");
  if (!raw) return null;
  const percent = raw.endsWith("%");
  const n = Number.parseFloat(percent ? raw.slice(0, -1) : raw);
  return Number.isFinite(n) ? n : null;
}

function compactHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .trim();
}

function resolveHeaderField(header: string): HeaderField | null {
  const compact = compactHeader(header);
  if (!compact) return null;
  const hit = HEADER_ALIASES.find((item) => item.match.test(compact));
  return hit?.field ?? null;
}

function cellToDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + value * 86400000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  return null;
}

function emptyDeviceRow(side: string): DeviceRow {
  const row = {
    performed_at: null,
    athlete_name: null,
    movement_name: null,
    side,
  } as DeviceRow;
  for (const field of NUMERIC_FIELDS) row[field] = null;
  return row;
}

export function classifyForcePlateHeaders(headers: string[]): boolean {
  const fields = new Set(headers.map(resolveHeaderField).filter(Boolean));
  return fields.has("side") && fields.has("peak_force_kg") && fields.has("rfd_100ms_ns");
}

export function parseForcePlateSheet(rows: unknown[][]): ForcePlateParseResult {
  const warnings: ImportWarning[] = [];
  if (rows.length < 2) {
    return {
      fileType: "UNKNOWN",
      athleteName: null,
      movements: [],
      dateRange: { start: null, end: null },
      hasLrData: false,
      testsDetected: 0,
      trials: [],
      warnings: [{ level: "error", message: "Spreadsheet has no data rows." }],
    };
  }

  const headerFields = rows[0].map((h) => resolveHeaderField(String(h ?? "")));
  if (!classifyForcePlateHeaders(rows[0].map((h) => String(h ?? "")))) {
    return {
      fileType: "UNKNOWN",
      athleteName: null,
      movements: [],
      dateRange: { start: null, end: null },
      hasLrData: false,
      testsDetected: 0,
      trials: [],
      warnings: [
        {
          level: "error",
          message:
            "File not recognised as a force-plate export. Expected English or Chinese headings such as Name/名称, Movement/动作, L/R, Peak Force (KG)/峰值力(KG), RFD@100ms.",
        },
      ],
    };
  }

  const indexOf = (field: HeaderField, fallback: number) => {
    const idx = headerFields.findIndex((value) => value === field);
    return idx >= 0 ? idx : fallback;
  };

  const parsedRows: DeviceRow[] = [];
  let lastPerformed: string | null = null;
  let lastAthlete: string | null = null;
  let lastMovement: string | null = null;

  for (let r = 1; r < rows.length; r += 1) {
    const raw = rows[r] ?? [];
    if (raw.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;

    const fromCell = cellToDate(raw[0]);
    const performed: string | null = fromCell ?? lastPerformed;
    const athleteIdx = indexOf("athlete_name", 1);
    const movementIdx = indexOf("movement_name", 2);
    const sideIdx = indexOf("side", 3);
    const athlete: string | null = String(raw[athleteIdx] ?? "").trim() || lastAthlete;
    const movementRaw: string | null = String(raw[movementIdx] ?? "").trim() || lastMovement;
    const movement = resolveMovement(movementRaw).displayName;
    const side = String(raw[sideIdx] ?? "").trim();

    if (fromCell) lastPerformed = fromCell;
    if (String(raw[athleteIdx] ?? "").trim()) lastAthlete = athlete;
    if (String(raw[movementIdx] ?? "").trim()) lastMovement = movementRaw;

    const row = emptyDeviceRow(side || "unknown");
    row.performed_at = performed;
    row.athlete_name = athlete;
    row.movement_name = movement;

    headerFields.forEach((field, idx) => {
      if (!field || field === "athlete_name" || field === "movement_name" || field === "side") return;
      row[field] = parseNumeric(raw[idx]);
    });
    parsedRows.push(row);
  }

  const trials: ForcePlateTrialPreview[] = [];
  const perMovementCount = new Map<string, number>();
  let i = 0;
  while (i < parsedRows.length) {
    const start = parsedRows[i];
    if (start.side !== "L+R") {
      warnings.push({
        level: "warning",
        message: `A row was skipped because it was not an L+R header (side="${start.side}").`,
      });
      i += 1;
      continue;
    }

    const profile = resolveMovement(start.movement_name);
    const nextNumber = (perMovementCount.get(profile.testType) ?? 0) + 1;
    perMovementCount.set(profile.testType, nextNumber);

    let left: DeviceRow | null = null;
    let right: DeviceRow | null = null;
    const trialWarnings: string[] = [];
    if (parsedRows[i + 1]?.side === "L") left = parsedRows[i + 1];
    if (parsedRows[i + 2]?.side === "R") right = parsedRows[i + 2];
    if (!left) trialWarnings.push(`Missing L row for ${profile.displayName} trial ${nextNumber}`);
    if (!right) trialWarnings.push(`Missing R row for ${profile.displayName} trial ${nextNumber}`);
    if (start.peak_force_kg === null) {
      trialWarnings.push(`Peak-force values contain invalid values on ${profile.displayName} trial ${nextNumber}`);
    }

    trials.push({
      trial: nextNumber,
      performed_at: start.performed_at,
      athlete_name: start.athlete_name,
      movement_name: profile.displayName,
      movement: profile,
      combined: start,
      left,
      right,
      warnings: trialWarnings,
    });
    warnings.push(...trialWarnings.map((message) => ({ level: "warning" as const, message })));

    i += left && right ? 3 : right || left ? 2 : 1;
    if (!left && parsedRows[i]?.side === "R") i += 1;
  }

  const movements = [...new Set(trials.map((t) => t.movement_name).filter(Boolean))] as string[];
  const dates = trials.map((t) => t.performed_at).filter(Boolean) as string[];

  return {
    fileType: "FORCE_PLATE_EXPORT_V1",
    athleteName: trials[0]?.athlete_name ?? null,
    movements,
    dateRange: { start: dates[0] ?? null, end: dates[dates.length - 1] ?? null },
    hasLrData: trials.some((t) => t.left && t.right),
    testsDetected: parsedRows.length,
    trials,
    warnings,
  };
}
