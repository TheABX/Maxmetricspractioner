/**
 * Layer 7 — communicate from events, not a timer.
 * Safety and pain never auto-send medical advice.
 */

import { extractNotes } from "@/lib/adaptation-engine/notes";
import type { AdaptationResult } from "@/lib/adaptation-engine/types";
import {
  DEFAULT_PRACTITIONER,
  DEFAULT_PREFS,
  WEIGHTS_ID,
  mapL6Type,
  type Channel,
  type CommAutomation,
  type CommPriority,
  type CommsInput,
  type CommsPlan,
  type EventType,
  type FortnightlyComms,
  type PlannedMessage,
  type RecentMessage,
} from "./types";

const SAFETY: EventType[] = ["PAIN_REPORTED", "PAIN_WORSENING"];
const ROUTINE: EventType[] = [
  "GENERAL_ENCOURAGEMENT",
  "PROGRESS_POSITIVE",
  "PROGRESSION_UNLOCKED",
  "RETEST_DUE",
  "PROGRAM_ADJUSTED",
  "MISSED_SESSIONS",
];

export function planCommunications(input: CommsInput): CommsPlan {
  const asOf = input.as_of ? new Date(input.as_of) : new Date();
  const prefs = { ...DEFAULT_PREFS, ...input.prefs };
  const prac = { ...DEFAULT_PRACTITIONER, ...input.practitioner };
  const name = prefs.preferred_name || input.first_name || "there";
  const adaptation = input.adaptation;
  const messages: PlannedMessage[] = [];

  for (const draft of adaptation.client.messages) {
    const event = mapL6Type(draft.type);
    const priority = toPriority(draft.priority, event, adaptation);
    if (shouldSkip(event, draft.body, input.recent, asOf, prac, prefs)) continue;
    messages.push(build(event, priority, safetyBody(personalise(draft.body, name), event, priority, name, adaptation), draft.body, adaptation, prac, prefs, relatedFrom(draft.body)));
  }

  if (adaptation.client.pain_status === "SEVERE" && !messages.some((m) => SAFETY.includes(m.event_type))) {
    const exercise = adaptation.exercises.find((e) => e.pain_level === "SEVERE");
    const loc = "";
    messages.push(
      build(
        "PAIN_REPORTED",
        "URGENT",
        painDraft(name, exercise?.name ?? "a recent exercise", loc),
        "severe pain",
        adaptation,
        prac,
        prefs,
        exercise?.name ?? null,
      ),
    );
  }

  const inactive = inactivityDays(input.last_training_date, asOf);
  if (inactive >= 7 && !prefs.explained_absence && !recentEvent(input.recent, ["INACTIVITY", "MISSED_SESSIONS"], asOf, 6)) {
    messages.push(
      build(
        "INACTIVITY",
        inactive >= 14 ? "NORMAL" : "LOW",
        `Hey ${name}, I noticed there hasn't been a logged session for ${inactive} days. Just checking the current plan still fits, or whether we should pause things for a bit.`,
        `${inactive} days inactive`,
        adaptation,
        prac,
        prefs,
        null,
      ),
    );
  }

  const capped = applyFrequency(messages, input.recent, asOf, prac, prefs);
  const fortnightly = fortnightlyOutcome(adaptation, capped);
  const why_no_message = capped.length ? null : skipReason(adaptation, input.recent, prefs);

  return {
    messages: capped,
    fortnightly,
    traffic: adaptation.client.traffic,
    why_no_message,
    digest: digestLine(adaptation, name),
    weights_id: WEIGHTS_ID,
  };
}

function build(
  event: EventType,
  priority: CommPriority,
  body: string,
  trigger: string,
  adaptation: AdaptationResult,
  prac: CommsInput["practitioner"],
  prefs: CommsInput["prefs"],
  related_exercise: string | null,
): PlannedMessage {
  const approval = requiresApproval(event, priority);
  const auto = canAutoSend(event, priority, approval, prac.automation, adaptation);
  const channel: Channel = prefs.preferred_contact_method === "EMAIL" && prefs.email_enabled && prefs.allow_automated_email ? "EMAIL" : "IN_APP";
  return {
    event_type: event,
    priority,
    channel,
    body: toneBody(body, prac.tone ?? prefs.communication_style_preference),
    generated_by: "TEMPLATE",
    status: auto ? "SENT" : approval ? "PENDING_APPROVAL" : "DRAFT",
    requires_approval: approval,
    auto_send: auto,
    why: whyFor(event, trigger, adaptation),
    trigger_data: { trigger, traffic: adaptation.client.traffic, fortnightly: adaptation.client.fortnightly_outcome },
    related_exercise,
  };
}

export function requiresApproval(event: EventType, priority: CommPriority) {
  if (SAFETY.includes(event) || priority === "URGENT" || priority === "HIGH") return true;
  return false;
}

export function canAutoSend(
  event: EventType,
  priority: CommPriority,
  approval: boolean,
  automation: CommAutomation,
  adaptation: AdaptationResult,
) {
  if (approval) return false;
  if (adaptation.client.traffic === "RED") return false;
  if (adaptation.client.pain_status === "SEVERE" || adaptation.client.pain_status === "MODERATE") return false;
  if (automation === "LEVEL_0_MANUAL") return false;
  if (automation === "LEVEL_1_ROUTINE_AUTO") return ROUTINE.includes(event) && (priority === "LOW" || priority === "NORMAL");
  return !SAFETY.includes(event) && priority !== "URGENT";
}

function toPriority(p: "LOW" | "NORMAL" | "HIGH", event: EventType, adaptation: AdaptationResult): CommPriority {
  if (event === "PAIN_WORSENING" || adaptation.client.pain_status === "SEVERE") return "URGENT";
  if (event === "PAIN_REPORTED" || p === "HIGH") return "HIGH";
  if (p === "LOW") return "LOW";
  return "NORMAL";
}

function shouldSkip(event: EventType, body: string, recent: RecentMessage[], asOf: Date, prac: CommsInput["practitioner"], prefs: CommsInput["prefs"]) {
  if (prefs.contact_frequency === "MINIMAL" && ROUTINE.includes(event) && !SAFETY.includes(event)) {
    if (recentEvent(recent, [event], asOf, prac.minimum_days_between_encouragement)) return true;
  }
  if (event === "GENERAL_ENCOURAGEMENT" && recentEvent(recent, ["GENERAL_ENCOURAGEMENT", "PROGRESS_POSITIVE"], asOf, prac.minimum_days_between_encouragement)) {
    return true;
  }
  const similar = recent.find((m) => m.event_type === event && daysBetween(m.sent_at ?? m.created_at, asOf) <= 3 && overlap(m.body, body));
  return Boolean(similar);
}

function applyFrequency(messages: PlannedMessage[], recent: RecentMessage[], asOf: Date, prac: CommsInput["practitioner"], prefs: CommsInput["prefs"]) {
  const weekCount = recent.filter((m) => m.direction === "OUT" && ["SENT", "SCHEDULED"].includes(m.status) && daysBetween(m.sent_at ?? m.created_at, asOf) <= 7).length;
  const out: PlannedMessage[] = [];
  let routine = weekCount;
  const cap = prefs.contact_frequency === "MINIMAL" ? 1 : prefs.contact_frequency === "HIGH_SUPPORT" ? prac.max_routine_messages_per_week + 2 : prac.max_routine_messages_per_week;
  for (const m of messages) {
    if (SAFETY.includes(m.event_type) || m.priority === "URGENT") {
      out.push(m);
      continue;
    }
    if (ROUTINE.includes(m.event_type) && routine >= cap) continue;
    if (ROUTINE.includes(m.event_type)) routine += 1;
    out.push(m);
  }
  return dedupe(out);
}

function fortnightlyOutcome(adaptation: AdaptationResult, messages: PlannedMessage[]): FortnightlyComms {
  if (adaptation.client.traffic === "RED" || messages.some((m) => m.priority === "URGENT")) return "PRACTITIONER_REVIEW";
  if (messages.some((m) => m.event_type === "PAIN_REPORTED" || m.event_type === "REPEATED_MISSED_REPS")) return "SPECIFIC_QUESTION";
  if (messages.some((m) => m.event_type === "PROGRAM_ADJUSTED")) return "PROGRAM_CHANGE_NOTICE";
  if (messages.some((m) => m.event_type === "MISSED_SESSIONS" || m.event_type === "INACTIVITY" || m.event_type === "CHECK_IN_REQUIRED")) return "CHECK_IN";
  if (messages.some((m) => m.event_type === "GENERAL_ENCOURAGEMENT" || m.event_type === "PROGRESS_POSITIVE")) return "ENCOURAGEMENT";
  if (adaptation.client.fortnightly_outcome === "NO_ACTION") return "NO_MESSAGE";
  return "NO_MESSAGE";
}

function skipReason(adaptation: AdaptationResult, recent: RecentMessage[], prefs: CommsInput["prefs"]) {
  if (prefs.explained_absence) return "Absence already explained — no repeated check-in.";
  if (recent.some((m) => daysBetween(m.sent_at ?? m.created_at, new Date()) <= 2)) return "A message went out recently. Avoid repeating the same question.";
  if (adaptation.client.fortnightly_outcome === "NO_ACTION" && adaptation.client.traffic === "GREEN") {
    return "No meaningful event this window. Time passing is not a reason to write.";
  }
  return "Nothing new to say without inventing progress.";
}

function whyFor(event: EventType, trigger: string, adaptation: AdaptationResult) {
  const why = [`Triggered by ${event.replaceAll("_", " ").toLowerCase()}, not a calendar reminder.`];
  if (trigger) why.push(trigger);
  why.push(`${adaptation.client.sessions_completed} sessions logged in ${adaptation.client.window_days} days · ${adaptation.client.adherence_band.toLowerCase()} adherence.`);
  if (adaptation.client.pain_status !== "NONE") why.push(`Pain status ${adaptation.client.pain_status.toLowerCase()} — not a diagnosis.`);
  return why;
}

function digestLine(adaptation: AdaptationResult, name: string) {
  const c = adaptation.client;
  const progress = adaptation.exercises.filter((e) => e.state === "PROGRESS").map((e) => e.name);
  const issues = adaptation.exercises.filter((e) => e.state === "REVIEW" || e.state === "REGRESS" || e.state === "PAUSE").map((e) => e.name);
  return [
    `${name.toUpperCase()} · last ${c.window_days} days`,
    `Sessions: ${c.sessions_completed}/${c.sessions_prescribed || "—"}`,
    progress.length ? `Progress: ${progress.join(", ")}` : "Progress: none flagged",
    issues.length ? `Issues: ${issues.join(", ")}` : "Issues: none",
    `Pain: ${c.pain_status.toLowerCase()}`,
    `Recovery: ${c.recovery_trend.toLowerCase()}`,
    `Suggested: ${c.fortnightly_outcome.replaceAll("_", " ").toLowerCase()}`,
  ].join("\n");
}

function safetyBody(body: string, event: EventType, priority: CommPriority, name: string, adaptation: AdaptationResult) {
  if (!SAFETY.includes(event) && priority !== "URGENT") return body;
  if (/health professional/i.test(body)) return body;
  if (adaptation.client.pain_status !== "SEVERE" && priority !== "URGENT") return body;
  void name;
  return `${body} If the pain persists, worsens, or is affecting normal daily activity, it would be appropriate to have it assessed by a qualified health professional.`;
}

function painDraft(name: string, exercise: string, location: string) {
  const where = location ? ` (${location})` : "";
  return `Hi ${name}, I noticed you reported significant discomfort during ${exercise}${where}. I've paused progression on that exercise for now. Please don't continue it if it is causing significant discomfort. If the pain persists, worsens, or is affecting normal daily activity, it would be appropriate to have it assessed by a qualified health professional.`;
}

function personalise(body: string, name: string) {
  return body.replace(/\b(there)\b/g, name);
}

function toneBody(body: string, tone: string) {
  const cleaned = body.replace(/!{2,}/g, ".").replace(/\b(crushing it|smashing it|absolutely smashed)\b/gi, "progressing well");
  if (tone === "concise") return cleaned.split(/(?<=\.)\s+/).slice(0, 2).join(" ");
  return cleaned;
}

function inactivityDays(last: string | null, asOf: Date) {
  if (!last) return 99;
  return Math.floor((asOf.getTime() - new Date(last).getTime()) / 86400000);
}

function recentEvent(recent: RecentMessage[], types: EventType[], asOf: Date, days: number) {
  return recent.some((m) => types.includes(m.event_type) && daysBetween(m.sent_at ?? m.created_at, asOf) <= days);
}

function daysBetween(from: string, asOf: Date) {
  return Math.floor((asOf.getTime() - new Date(from).getTime()) / 86400000);
}

function overlap(a: string, b: string) {
  const words = (s: string) => new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
  const A = words(a);
  const B = words(b);
  let n = 0;
  for (const w of A) if (B.has(w)) n += 1;
  return n >= 4;
}

function relatedFrom(body: string) {
  const m = body.match(/on your ([^.]+?)(?: over| with| so |,|\.)/i) || body.match(/your ([A-Za-z ]+?) (?:has|have|load)/i);
  return m?.[1]?.trim() ?? null;
}

function dedupe(msgs: PlannedMessage[]) {
  const seen = new Set<string>();
  return msgs.filter((m) => {
    const k = `${m.event_type}:${m.body.slice(0, 80)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function parseReply(text: string) {
  const notes = extractNotes(text);
  const lower = text.toLowerCase();
  const denied = /\bno pain\b|\bnot (in )?pain\b/.test(lower);
  const justHard = notes.just_hard || denied;
  const frustrated = /\b(getting nowhere|pointless|giving up|frustrated|useless)\b/.test(lower);
  const pain = notes.pain_present && !denied && !justHard;
  const uncertain = /\b(weird|odd|strange|not sure|dunno)\b/.test(lower) && !pain;
  return {
    pain,
    repeated: /\bevery time|keeps|again|still sore\b/.test(lower),
    difficulty: justHard ? "high" : null,
    issue_type: justHard ? "training_difficulty" : pain ? "pain" : frustrated ? "frustration" : uncertain ? "unclear" : "other",
    red_flag: notes.red_flag,
    location: notes.location,
    severity: denied ? null : notes.severity,
    escalate: Boolean(pain && (notes.severity === "SEVERE" || notes.red_flag || /\bevery time|still sore\b/.test(lower))),
    clarify: uncertain,
  };
}
