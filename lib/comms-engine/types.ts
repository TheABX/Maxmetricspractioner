/**
 * Layer 7 — who needs a message, what it should say, and who must approve it.
 * Coaching assistant, not a clinician. Age is not an input.
 */

import type { AdaptationResult, MessageType as L6MessageType, Traffic } from "@/lib/adaptation-engine/types";

export const EVENT_TYPES = [
  "PROGRESS_POSITIVE",
  "PROGRESSION_UNLOCKED",
  "MISSED_SESSIONS",
  "LOW_ADHERENCE",
  "REPEATED_MISSED_REPS",
  "HIGH_RPE_TREND",
  "LOW_RPE_TREND",
  "PAIN_REPORTED",
  "PAIN_WORSENING",
  "RECOVERY_DECLINE",
  "PROGRAM_ADJUSTED",
  "TECHNIQUE_FEEDBACK",
  "TECHNIQUE_MASTERY",
  "PLATEAU",
  "RETEST_DUE",
  "CHECK_IN_REQUIRED",
  "GENERAL_ENCOURAGEMENT",
  "INACTIVITY",
  "CLIENT_REPLY",
  "COACH_REPLY",
  "PRACTITIONER_MANUAL",
  "OTHER",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const COMM_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type CommPriority = (typeof COMM_PRIORITIES)[number];

export const CHANNELS = ["IN_APP", "EMAIL", "PUSH_NOTIFICATION", "SMS_FUTURE"] as const;
export type Channel = (typeof CHANNELS)[number];

export const GENERATORS = ["AI", "PRACTITIONER", "TEMPLATE", "CLIENT"] as const;
export type Generator = (typeof GENERATORS)[number];

export const MESSAGE_STATUSES = ["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "SENT", "CANCELLED"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const COMM_AUTOMATION = ["LEVEL_0_MANUAL", "LEVEL_1_ROUTINE_AUTO", "LEVEL_2_EXPANDED_AUTO"] as const;
export type CommAutomation = (typeof COMM_AUTOMATION)[number];

export const TONES = ["concise", "professional", "casual_professional", "encouraging"] as const;
export type Tone = (typeof TONES)[number];

export const FREQUENCIES = ["MINIMAL", "STANDARD", "HIGH_SUPPORT"] as const;
export type ContactFrequency = (typeof FREQUENCIES)[number];

export const FORTNIGHTLY = [
  "NO_MESSAGE",
  "ENCOURAGEMENT",
  "CHECK_IN",
  "SPECIFIC_QUESTION",
  "PROGRAM_CHANGE_NOTICE",
  "PRACTITIONER_REVIEW",
] as const;
export type FortnightlyComms = (typeof FORTNIGHTLY)[number];

export type ClientCommsPrefs = {
  preferred_name: string;
  preferred_contact_method: Channel;
  allow_automated_email: boolean;
  allow_push_notifications: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  contact_frequency: ContactFrequency;
  communication_style_preference: Tone;
  quiet_hours: string;
  explained_absence: boolean;
  absence_note: string;
};

export type PractitionerComms = {
  tone: Tone;
  automation: CommAutomation;
  max_routine_messages_per_week: number;
  minimum_days_between_encouragement: number;
};

export type RecentMessage = {
  id: string;
  event_type: EventType;
  body: string;
  status: MessageStatus;
  created_at: string;
  sent_at: string | null;
  direction: "OUT" | "IN";
};

export type PlannedMessage = {
  event_type: EventType;
  priority: CommPriority;
  channel: Channel;
  body: string;
  generated_by: Generator;
  status: MessageStatus;
  requires_approval: boolean;
  auto_send: boolean;
  why: string[];
  trigger_data: Record<string, unknown>;
  related_exercise: string | null;
};

export type FollowUp = {
  id: string;
  issue: string;
  due_on: string;
  status: "OPEN" | "DONE" | "OVERDUE";
};

export type TimelineEvent = {
  date: string;
  kind: string;
  label: string;
};

export type CommsPlan = {
  messages: PlannedMessage[];
  fortnightly: FortnightlyComms;
  traffic: Traffic;
  why_no_message: string | null;
  digest: string;
  weights_id: string;
};

export type CommsInput = {
  adaptation: AdaptationResult;
  prefs: ClientCommsPrefs;
  practitioner: PractitionerComms;
  recent: RecentMessage[];
  first_name: string;
  last_training_date: string | null;
  as_of?: string;
};

export const WEIGHTS_ID = "v1_comms_framework";

export const DEFAULT_PREFS: ClientCommsPrefs = {
  preferred_name: "",
  preferred_contact_method: "IN_APP",
  allow_automated_email: true,
  allow_push_notifications: false,
  email_enabled: true,
  push_enabled: false,
  contact_frequency: "STANDARD",
  communication_style_preference: "casual_professional",
  quiet_hours: "",
  explained_absence: false,
  absence_note: "",
};

export const DEFAULT_PRACTITIONER: PractitionerComms = {
  tone: "casual_professional",
  automation: "LEVEL_1_ROUTINE_AUTO",
  max_routine_messages_per_week: 2,
  minimum_days_between_encouragement: 10,
};

export function mapL6Type(t: L6MessageType): EventType {
  if (t === "ENCOURAGEMENT") return "GENERAL_ENCOURAGEMENT";
  if (t === "CHECK_IN") return "REPEATED_MISSED_REPS";
  if (t === "PROGRESSION_NOTICE") return "PROGRESS_POSITIVE";
  if (t === "PROGRAM_ADJUSTMENT") return "PROGRAM_ADJUSTED";
  if (t === "PAIN_FOLLOWUP") return "PAIN_REPORTED";
  if (t === "ADHERENCE_CHECK") return "MISSED_SESSIONS";
  if (t === "RETEST_REMINDER") return "RETEST_DUE";
  return "OTHER";
}
