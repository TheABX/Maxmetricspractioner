/**
 * Draft client messages from real numbers. Brief, specific, not fake-enthusiastic.
 */

import type { DraftMessage, MessageType } from "./types";

export function draft(type: MessageType, priority: DraftMessage["priority"], body: string, send = true): DraftMessage {
  return { type, priority, body: body.trim(), send };
}

export function encourage(name: string, bits: string[]): DraftMessage {
  const who = name || "there";
  const detail = bits.filter(Boolean).join(" ");
  return draft(
    "ENCOURAGEMENT",
    "LOW",
    `Hey ${who}, great work over the last couple of weeks.${detail ? ` ${detail}` : " You've been consistent with the program."} Keep it up — sing out if you need any help.`,
    true,
  );
}

export function missedSessions(name: string, missed: number): DraftMessage {
  return draft(
    "ADHERENCE_CHECK",
    "NORMAL",
    `Hey ${name || "there"}, I noticed you've missed ${missed} session${missed === 1 ? "" : "s"} recently. Just checking everything's going okay and whether the current schedule is still working for you.`,
    true,
  );
}

export function missedReps(name: string, exercise: string): DraftMessage {
  return draft(
    "CHECK_IN",
    "NORMAL",
    `Hey ${name || "there"}, I noticed you've been a few reps short on your ${exercise} over the last couple of sessions. Just checking whether everything feels okay there, or whether they're simply getting quite challenging.`,
    true,
  );
}

export function painFollowup(name: string, exercise: string, location?: string | null): DraftMessage {
  const where = location ? ` (${pretty(location)})` : "";
  return draft(
    "PAIN_FOLLOWUP",
    "HIGH",
    `Hey ${name || "there"}, I saw some discomfort noted on ${exercise}${where}. I haven't changed the program yet — can you tell me whether it's settling, or whether we should modify that movement?`,
    true,
  );
}

export function strongProgress(name: string, exercise: string, from: string, to: string): DraftMessage {
  return draft(
    "PROGRESSION_NOTICE",
    "LOW",
    `Great work, ${name || "there"}. ${exercise} has moved from ${from} to ${to} while you're still hitting the prescribed reps, which is a strong progression.`,
    true,
  );
}

export function adjustmentNotice(exercise: string, change: string): DraftMessage {
  return draft("PROGRAM_ADJUSTMENT", "NORMAL", `${exercise}: ${change}`, false);
}

export function retestReminder(name: string, week: number): DraftMessage {
  return draft(
    "RETEST_REMINDER",
    "NORMAL",
    `Hey ${name || "there"}, you're in week ${week} — a good time to book a retest so we can see what's changed and update the program from the new results.`,
    true,
  );
}

function pretty(v: string) {
  return v.replaceAll("_", " ").toLowerCase();
}
