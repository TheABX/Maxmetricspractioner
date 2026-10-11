/**
 * In-app coach answers from known program data. Does not invent or diagnose.
 */

import { extractNotes } from "@/lib/adaptation-engine/notes";
import type { AdaptationResult } from "@/lib/adaptation-engine/types";
import type { SelectionResult } from "@/lib/exercise-kb/types";
import type { StructureResult } from "@/lib/structure-engine/types";
import { parseReply } from "./engine";

export type CoachContext = {
  first_name: string;
  adaptation: AdaptationResult;
  selection?: SelectionResult | null;
  structure?: StructureResult | null;
};

export type CoachAnswer = {
  body: string;
  event: "COACH_REPLY" | "PAIN_REPORTED" | "CHECK_IN_REQUIRED";
  requires_approval: boolean;
  escalate: boolean;
  why: string[];
};

const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function answerCoach(question: string, ctx: CoachContext): CoachAnswer {
  const q = question.trim();
  const name = ctx.first_name || "there";
  const parsed = parseReply(q);
  const notes = extractNotes(q);

  if (/\bpush through\b|\btrain through\b|\bignore (the )?pain\b/i.test(q) && (notes.pain_present || /\bknee|shoulder|back|pain|hurt\b/i.test(q))) {
    return {
      body: `I wouldn't push through significant discomfort, ${name}. Pause that movement and let your practitioner review it. If pain is severe, worsening, or affecting daily activity, it is appropriate to have it assessed by a qualified health professional. I can't diagnose this.`,
      event: "PAIN_REPORTED",
      requires_approval: true,
      escalate: true,
      why: ["Client asked to push through symptoms. Safety rules override convenience."],
    };
  }

  if (parsed.escalate || notes.red_flag || notes.severity === "SEVERE") {
    return {
      body: `Thanks for flagging that. I won't change the program from here in a way that could be read as medical advice. Your practitioner will review this. If symptoms persist, worsen, or affect daily activity, please have them assessed by a qualified health professional.`,
      event: "PAIN_REPORTED",
      requires_approval: true,
      escalate: true,
      why: ["Pain or concerning language. Draft only — practitioner review."],
    };
  }

  if (parsed.clarify) {
    return {
      body: `Can you tell me a little more about what feels weird — is it pain, tightness, instability, or just difficulty with the movement?`,
      event: "CHECK_IN_REQUIRED",
      requires_approval: false,
      escalate: false,
      why: ["Meaning is unclear. Ask, don't infer."],
    };
  }

  if (parsed.pain && parsed.repeated) {
    return {
      body: `Thanks — repeated discomfort is worth a proper look. I've flagged this for your practitioner rather than guessing. Hold that exercise if it keeps bothering you.`,
      event: "PAIN_REPORTED",
      requires_approval: true,
      escalate: true,
      why: ["Repeated pain language. Do not auto-clear."],
    };
  }

  if (parsed.issue_type === "training_difficulty") {
    return {
      body: `Got it — hard is fine if there's no pain. We'll hold the current load unless the next sessions show a clear trend. No need to change the exercise just because it feels challenging.`,
      event: "COACH_REPLY",
      requires_approval: false,
      escalate: false,
      why: ["Client said the work is hard, not painful."],
    };
  }

  if (parsed.issue_type === "frustration") {
    const wins = ctx.adaptation.exercises.filter((e) => e.state === "PROGRESS").map((e) => e.name);
    const extra = wins.length
      ? ` You may not feel it day to day, but ${wins.slice(0, 2).join(" and ")} ${wins.length === 1 ? "is" : "are"} flagged as progressing from the logs.`
      : ` I can only talk about what's in your logs — I won't invent progress.`;
    return {
      body: `That's a fair feeling, ${name}.${extra} If you want, your practitioner can walk through the last fortnight with you.`,
      event: "COACH_REPLY",
      requires_approval: false,
      escalate: false,
      why: ["Frustration is not automatically poor adherence."],
    };
  }

  const swap = parseSwap(q);
  if (swap && ctx.structure) {
    return scheduleAnswer(name, swap, ctx);
  }

  const sub = q.match(/can i (?:do|swap|use) (.+?) instead of (.+?)[.?]?$/i) || q.match(/instead of (.+)/i);
  if (sub && ctx.selection) {
    return substituteAnswer(name, sub[1] ?? "", sub[2] ?? sub[1], ctx);
  }

  if (/\bwhy am i doing\b|\bwhy .* split squat|\bwhy .* squat|\bwhy this exercise\b/i.test(q) && ctx.selection) {
    const hit = ctx.selection.sessions.flatMap((s) => s.exercises).find((e) => q.toLowerCase().includes(e.name.toLowerCase()) || q.toLowerCase().includes(e.slug.replaceAll("_", " ")));
    const pick = hit ?? ctx.selection.sessions.flatMap((s) => s.exercises).find((e) => e.intent.includes("UNILATERAL") || e.slug.includes("split"));
    if (pick) {
      return {
        body: pick.client_reason || `That movement is in the week because it matches a current training priority (${pick.quality.replaceAll("_", " ").toLowerCase()}). I won't add extra reasons that aren't in your program.`,
        event: "COACH_REPLY",
        requires_approval: false,
        escalate: false,
        why: ["Answered from Layer 4 client-facing reason only."],
      };
    }
  }

  if (/\btoo easy\b|\bfeels easy\b/i.test(q)) {
    return {
      body: `If a set is finishing with plenty left, log the actual reps and how many you had in reserve. Your practitioner can progress load from that — I won't invent a new prescription in chat.`,
      event: "COACH_REPLY",
      requires_approval: false,
      escalate: false,
      why: ["Too-easy report: point at logging, don't rewrite the program here."],
    };
  }

  if (/\bleft.?side first|weaker side\b/i.test(q)) {
    return {
      body: `You may notice the lower-performing side is trained first. That's so it gets the work while you're fresher. Same planned reps — not double volume.`,
      event: "COACH_REPLY",
      requires_approval: false,
      escalate: false,
      why: ["Short education, only when asked."],
    };
  }

  return {
    body: `I can help with what's in your current program, recent logs, and simple schedule questions. I don't have enough known detail to answer that without guessing. Try asking about a specific session or exercise, or send a note to your practitioner.`,
    event: "COACH_REPLY",
    requires_approval: false,
    escalate: false,
    why: ["Out of known data. Do not invent."],
  };
}

function parseSwap(q: string) {
  const m = q.match(/swap .* (\w+)(?:'s)? (?:session|cardio|day)?(?: to| onto| for) (\w+)/i) || q.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun).*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i);
  if (!m) return null;
  return { from: normDay(m[1]), to: normDay(m[2]) };
}

function normDay(raw: string) {
  const s = raw.toLowerCase().slice(0, 3);
  const map: Record<string, string> = { mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat", sun: "sun" };
  return map[s] ?? raw.toLowerCase();
}

function scheduleAnswer(name: string, swap: { from: string; to: string }, ctx: CoachContext): CoachAnswer {
  const schedule = ctx.structure?.weekly_schedule ?? [];
  const dest = schedule.find((s) => s.day === swap.to);
  const src = schedule.find((s) => s.day === swap.from);
  if (dest && dest.kind === "PRESCRIBED" && dest.session_type !== "REST" && dest.session_type !== "OPTIONAL_ACTIVITY") {
    return {
      body: `Thursday-style swaps are fine when the destination day is light. ${swap.to} already has a prescribed ${dest.session_type.replaceAll("_", " ").toLowerCase()} session, so stacking both may crowd recovery. I'd keep them on separate days unless your practitioner says otherwise.`,
      event: "COACH_REPLY",
      requires_approval: false,
      escalate: false,
      why: ["Destination day already has prescribed work."],
    };
  }
  const gap = ctx.structure?.recovery_spacing.minimum_recovery_hours_between_similar_sessions;
  return {
    body: `Moving a low-intensity session to ${swap.to} is usually reasonable if that day stays easy.${src ? ` ${swap.from} is currently ${src.label}.` : ""}${gap ? ` Keep about ${gap} hours between similar hard sessions.` : ""} Log it on the new day so the record stays honest.`,
    event: "COACH_REPLY",
    requires_approval: false,
    escalate: false,
    why: ["Low-risk schedule question answered from Layer 3 structure."],
  };
}

function substituteAnswer(_name: string, want: string, current: string, ctx: CoachContext): CoachAnswer {
  const all = ctx.selection?.sessions.flatMap((s) => s.exercises) ?? [];
  const ex = all.find((e) => e.name.toLowerCase().includes(current.toLowerCase()) || current.toLowerCase().includes(e.name.toLowerCase()));
  if (!ex) {
    return {
      body: `I can't see ${current || "that exercise"} on this week's selection, so I won't invent a swap.`,
      event: "COACH_REPLY",
      requires_approval: false,
      escalate: false,
      why: ["Unknown exercise — no guess."],
    };
  }
  const alt = ex.eligible_alternatives.find((a) => want && a.name.toLowerCase().includes(want.toLowerCase())) ?? ex.eligible_alternatives[0];
  if (!alt) {
    return {
      body: `${ex.name} doesn't have a listed alternative that matches. Ask your practitioner before swapping — I won't approve a substitute that isn't in the library for this slot.`,
      event: "COACH_REPLY",
      requires_approval: true,
      escalate: false,
      why: ["No Layer 4 alternative on file."],
    };
  }
  return {
    body: `${alt.name} is a listed alternative for ${ex.name} (${alt.why[0] ?? "same slot"}). Your practitioner still confirms substitutions in V1 so we don't bypass the program.`,
    event: "COACH_REPLY",
    requires_approval: true,
    escalate: false,
    why: ["Layer 4 alternative exists; still practitioner-approved."],
  };
}

void DAY_NAMES;
