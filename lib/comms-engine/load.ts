import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProgramAdaptation, type LoadedAdaptation } from "@/lib/adaptation-engine/load";
import { planCommunications } from "./engine";
import {
  DEFAULT_PRACTITIONER,
  DEFAULT_PREFS,
  type ClientCommsPrefs,
  type CommsPlan,
  type EventType,
  type MessageStatus,
  type PlannedMessage,
  type PractitionerComms,
  type RecentMessage,
} from "./types";

export type MessageRow = {
  id: string;
  client_id: string;
  practitioner_id: string;
  program_id: string | null;
  event_type: EventType;
  priority: string;
  message_channel: string;
  message_text: string;
  generated_by: string;
  automation_status: MessageStatus;
  trigger_data: Record<string, unknown> | null;
  practitioner_reviewed: boolean;
  practitioner_notes: string | null;
  created_at: string;
  sent_at: string | null;
  direction: "OUT" | "IN";
};

export type FollowUpRow = {
  id: string;
  client_id: string;
  issue: string;
  due_on: string;
  status: string;
  related_message_id: string | null;
};

export type LoadedComms = {
  adaptation: LoadedAdaptation;
  plan: CommsPlan;
  prefs: ClientCommsPrefs;
  practitioner: PractitionerComms;
  messages: MessageRow[];
  followUps: FollowUpRow[];
};

export async function loadProgramComms(supabase: SupabaseClient, clientId: string): Promise<LoadedComms> {
  const [adaptation, { data: prefRow }, { data: messageRows }, { data: followRows }, { data: lastLog }, { data: client }] = await Promise.all([
    loadProgramAdaptation(supabase, clientId),
    supabase.from("comms_preferences").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("client_messages").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(80),
    supabase.from("comms_follow_ups").select("*").eq("client_id", clientId).order("due_on", { ascending: true }),
    supabase.from("session_logs").select("completed_at").eq("client_id", clientId).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("clients").select("first_name, practitioner_id").eq("id", clientId).maybeSingle(),
  ]);

  const { data: pracSettings } = client?.practitioner_id
    ? await supabase.from("practitioner_comms").select("*").eq("practitioner_id", client.practitioner_id).maybeSingle()
    : { data: null };

  const prefs: ClientCommsPrefs = {
    ...DEFAULT_PREFS,
    preferred_name: String(prefRow?.preferred_name || client?.first_name || ""),
    preferred_contact_method: (prefRow?.preferred_contact_method as ClientCommsPrefs["preferred_contact_method"]) || "IN_APP",
    allow_automated_email: prefRow?.allow_automated_email !== false,
    allow_push_notifications: Boolean(prefRow?.allow_push_notifications),
    email_enabled: prefRow?.email_enabled !== false,
    push_enabled: Boolean(prefRow?.push_enabled),
    contact_frequency: (prefRow?.contact_frequency as ClientCommsPrefs["contact_frequency"]) || "STANDARD",
    communication_style_preference: (prefRow?.communication_style_preference as ClientCommsPrefs["communication_style_preference"]) || "casual_professional",
    quiet_hours: String(prefRow?.quiet_hours ?? ""),
    explained_absence: Boolean(prefRow?.explained_absence),
    absence_note: String(prefRow?.absence_note ?? ""),
  };

  const practitioner: PractitionerComms = pracSettings
    ? {
        tone: (pracSettings.tone as PractitionerComms["tone"]) || "casual_professional",
        automation: (pracSettings.automation as PractitionerComms["automation"]) || "LEVEL_1_ROUTINE_AUTO",
        max_routine_messages_per_week: Number(pracSettings.max_routine_messages_per_week ?? 2),
        minimum_days_between_encouragement: Number(pracSettings.minimum_days_between_encouragement ?? 10),
      }
    : DEFAULT_PRACTITIONER;

  const messages = (messageRows ?? []) as MessageRow[];
  const recent: RecentMessage[] = messages.map((m) => ({
    id: m.id,
    event_type: m.event_type,
    body: m.message_text,
    status: m.automation_status,
    created_at: m.created_at,
    sent_at: m.sent_at,
    direction: m.direction ?? "OUT",
  }));

  const plan = planCommunications({
    adaptation: adaptation.effective,
    prefs,
    practitioner,
    recent,
    first_name: prefs.preferred_name,
    last_training_date: lastLog?.completed_at ?? null,
  });

  return { adaptation, plan, prefs, practitioner, messages, followUps: (followRows ?? []) as FollowUpRow[] };
}

export function toMessageInsert(practitionerId: string, clientId: string, programId: string | null, m: PlannedMessage, sentNow: boolean) {
  return {
    practitioner_id: practitionerId,
    client_id: clientId,
    program_id: programId,
    event_type: m.event_type,
    priority: m.priority,
    message_channel: m.channel,
    message_text: m.body,
    generated_by: m.generated_by,
    automation_status: sentNow ? "SENT" : m.requires_approval ? "PENDING_APPROVAL" : "DRAFT",
    trigger_data: { ...m.trigger_data, why: m.why },
    practitioner_reviewed: false,
    practitioner_notes: m.why.join(" · "),
    sent_at: sentNow ? new Date().toISOString() : null,
    direction: "OUT" as const,
  };
}
