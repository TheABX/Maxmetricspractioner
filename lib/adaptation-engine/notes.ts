/**
 * Lightweight note extraction. Rules decide action. Does not diagnose.
 */

import { RED_FLAG_TERMS } from "./weights";
import type { PainLevel } from "./types";

const LOCATIONS: { match: RegExp; value: string }[] = [
  { match: /right knee|r knee/i, value: "RIGHT_KNEE" },
  { match: /left knee|l knee/i, value: "LEFT_KNEE" },
  { match: /\bknee/i, value: "KNEE" },
  { match: /right shoulder/i, value: "RIGHT_SHOULDER" },
  { match: /left shoulder/i, value: "LEFT_SHOULDER" },
  { match: /low(er)? back|lumbar/i, value: "LOWER_BACK" },
  { match: /\bhip/i, value: "HIP" },
  { match: /\bankle/i, value: "ANKLE" },
];

export type NoteExtract = {
  pain_present: boolean;
  severity: PainLevel | null;
  location: string | null;
  red_flag: boolean;
  just_hard: boolean;
  context: "DURING_EXERCISE" | "AFTER" | "UNKNOWN";
};

export function extractNotes(text: string | null | undefined): NoteExtract {
  const raw = (text ?? "").trim();
  const empty: NoteExtract = {
    pain_present: false,
    severity: null,
    location: null,
    red_flag: false,
    just_hard: false,
    context: "UNKNOWN",
  };
  if (!raw) return empty;

  const lower = raw.toLowerCase();
  const red_flag = RED_FLAG_TERMS.some((t) => lower.includes(t));
  const denied = /\bno pain\b|\bnot (in )?pain\b|\bisn'?t (painful|sore)\b/.test(lower);
  const pain_present = !denied && (red_flag || /\b(pain|sore|soreness|hurt|hurting|discomfort|ache|aching|tender)\b/i.test(raw));
  const just_hard = (!pain_present || denied) && /\b(just hard|hard|heavy|challenging|tough|fatigue|tired)\b/i.test(raw);
  let severity: PainLevel | null = null;
  if (/\b(severe|unbearable|worst|excruciating)\b/i.test(raw) || red_flag) severity = "SEVERE";
  else if (/\b(moderate|quite sore|pretty sore)\b/i.test(raw)) severity = "MODERATE";
  else if (pain_present) severity = /\bmild|a bit|slight|little sore/i.test(raw) ? "MILD" : "MODERATE";
  const loc = LOCATIONS.find((l) => l.match.test(raw));
  const context = /during|doing|on the/i.test(raw) ? "DURING_EXERCISE" : /after|next day|later/i.test(raw) ? "AFTER" : "UNKNOWN";
  return { pain_present, severity, location: loc?.value ?? null, red_flag, just_hard, context };
}
