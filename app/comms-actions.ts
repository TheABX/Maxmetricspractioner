"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { appUrl, coachingEmail, sendEmail } from "@/lib/email";
import { loadProgramComms, toMessageInsert } from "@/lib/comms-engine/load";
import type { ClientCommsPrefs, MessageStatus, PractitionerComms } from "@/lib/comms-engine/types";

async function requirePractitioner() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login");
  const meta = data.claims.user_metadata as { role?: string } | undefined;
  if (meta?.role === "client") redirect("/me");
  return { supabase, userId: String(data.claims.sub) };
}

async function audit(supabase: Awaited<ReturnType<typeof createClient>>, practitionerId: string, clientId: string | null, event: string, detail: Record<string, unknown>) {
  await supabase.from("comms_audit").insert({ practitioner_id: practitionerId, client_id: clientId, event, detail });
}

export async function generateClientComms(clientId: string): Promise<{ ok: true; created: number } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const loaded = await loadProgramComms(supabase, clientId);
  const { data: program } = await supabase.from("programs").select("id").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: client } = await supabase.from("clients").select("email, first_name").eq("id", clientId).maybeSingle();
  let created = 0;
  for (const planned of loaded.plan.messages) {
    const key = `${planned.event_type}:${planned.body.slice(0, 60)}`;
    if (loaded.messages.some((m) => `${m.event_type}:${m.message_text.slice(0, 60)}` === key && m.automation_status !== "CANCELLED")) continue;
    const sendNow = planned.auto_send;
    const row = toMessageInsert(userId, clientId, program?.id ?? null, planned, sendNow);
    const { data, error } = await supabase.from("client_messages").insert(row).select("id").single();
    if (error) return { error: error.message };
    created += 1;
    if (sendNow && planned.channel === "EMAIL" && client?.email && loaded.prefs.allow_automated_email) {
      const mail = coachingEmail(client.first_name, planned.body, appUrl("/me/messages"));
      const result = await sendEmail({ to: client.email, ...mail });
      await supabase.from("notifications").insert({
        practitioner_id: userId,
        client_id: clientId,
        type: "coaching_message",
        to_email: client.email,
        subject: mail.subject,
        provider: result.provider,
        provider_id: result.sent ? result.id : null,
        status: result.sent ? "sent" : "not_sent",
        error: result.sent ? null : result.error,
      });
    }
    await audit(supabase, userId, clientId, sendNow ? "message_auto_sent" : "message_drafted", { id: data?.id, event: planned.event_type, why: planned.why });
  }
  revalidatePath(`/clients/${clientId}/messages`);
  revalidatePath("/adaptations");
  revalidatePath("/me/messages");
  return { ok: true, created };
}

export async function updateClientMessage(input: {
  id: string;
  client_id: string;
  text?: string;
  status?: MessageStatus;
  notes?: string;
}): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const patch: Record<string, unknown> = { practitioner_reviewed: true };
  if (input.text != null) patch.message_text = input.text;
  if (input.status) patch.automation_status = input.status;
  if (input.notes != null) patch.practitioner_notes = input.notes;
  if (input.status === "SENT") patch.sent_at = new Date().toISOString();
  const { error } = await supabase.from("client_messages").update(patch).eq("id", input.id);
  if (error) return { error: error.message };
  if (input.status === "SENT") {
    const { data: msg } = await supabase.from("client_messages").select("message_text, message_channel").eq("id", input.id).single();
    const { data: client } = await supabase.from("clients").select("email, first_name").eq("id", input.client_id).single();
    if (msg?.message_channel === "EMAIL" && client?.email) {
      const mail = coachingEmail(client.first_name, String(msg.message_text), appUrl("/me/messages"));
      await sendEmail({ to: client.email, ...mail });
    }
  }
  await audit(supabase, userId, input.client_id, "message_updated", { id: input.id, status: input.status });
  revalidatePath(`/clients/${input.client_id}/messages`);
  revalidatePath("/adaptations");
  revalidatePath("/me/messages");
  return { ok: true };
}

export async function saveCommsPrefs(input: { client_id: string; prefs: Partial<ClientCommsPrefs> }): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const { error } = await supabase.from("comms_preferences").upsert(
    { practitioner_id: userId, client_id: input.client_id, ...input.prefs },
    { onConflict: "client_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/clients/${input.client_id}/messages`);
  return { ok: true };
}

export async function savePractitionerComms(input: Partial<PractitionerComms>): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const { error } = await supabase.from("practitioner_comms").upsert({ practitioner_id: userId, ...input }, { onConflict: "practitioner_id" });
  if (error) return { error: error.message };
  revalidatePath("/adaptations");
  return { ok: true };
}

export async function createFollowUp(input: { client_id: string; issue: string; due_on: string; related_message_id?: string | null }): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const { error } = await supabase.from("comms_follow_ups").insert({
    practitioner_id: userId,
    client_id: input.client_id,
    issue: input.issue,
    due_on: input.due_on,
    related_message_id: input.related_message_id ?? null,
    status: "OPEN",
  });
  if (error) return { error: error.message };
  revalidatePath(`/clients/${input.client_id}/messages`);
  revalidatePath("/adaptations");
  return { ok: true };
}

export async function closeFollowUp(id: string, clientId: string): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await requirePractitioner();
  const { error } = await supabase.from("comms_follow_ups").update({ status: "DONE" }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/clients/${clientId}/messages`);
  revalidatePath("/adaptations");
  return { ok: true };
}

export async function sendManualMessage(input: { client_id: string; text: string; channel?: "IN_APP" | "EMAIL" }): Promise<{ ok: true } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const { data: client } = await supabase.from("clients").select("email, first_name").eq("id", input.client_id).single();
  const channel = input.channel ?? "IN_APP";
  const { error } = await supabase.from("client_messages").insert({
    practitioner_id: userId,
    client_id: input.client_id,
    event_type: "PRACTITIONER_MANUAL",
    priority: "NORMAL",
    message_channel: channel,
    message_text: input.text,
    generated_by: "PRACTITIONER",
    automation_status: "SENT",
    direction: "OUT",
    practitioner_reviewed: true,
    sent_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  if (channel === "EMAIL" && client?.email) {
    const mail = coachingEmail(client.first_name, input.text, appUrl("/me/messages"));
    await sendEmail({ to: client.email, ...mail });
  }
  revalidatePath(`/clients/${input.client_id}/messages`);
  revalidatePath("/me/messages");
  return { ok: true };
}
