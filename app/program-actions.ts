"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { appUrl, inviteEmail, programSentEmail, questionnaireRequestEmail, reportSentEmail, sendEmail } from "@/lib/email";
import { QUESTIONNAIRE_VERSION } from "@/lib/questionnaire/schema";
import { loadLatestQuestionnaire } from "@/lib/questionnaire/access";
import type { ExerciseRow } from "@/lib/programs/types";

async function requirePractitioner() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login");
  const meta = data.claims.user_metadata as { role?: string } | undefined;
  if (meta?.role === "client") redirect("/me");
  return { supabase, userId: String(data.claims.sub) };
}

async function recordNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: {
    practitioner_id: string;
    client_id: string;
    type: string;
    to_email: string | null;
    subject: string;
    result: Awaited<ReturnType<typeof sendEmail>>;
  },
) {
  await supabase.from("notifications").insert({
    practitioner_id: row.practitioner_id,
    client_id: row.client_id,
    type: row.type,
    to_email: row.to_email,
    subject: row.subject,
    provider: row.result.provider,
    provider_id: row.result.sent ? row.result.id : null,
    status: row.result.sent ? "sent" : "not_sent",
    error: row.result.sent ? null : row.result.error,
  });
}

// ---------------------------------------------------------------------------
// Client portal invite
// ---------------------------------------------------------------------------
export async function inviteClientToPortal(formData: FormData) {
  const { supabase, userId } = await requirePractitioner();
  const clientId = String(formData.get("client_id"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Add an email address to the client first." };
  const { data: client, error } = await supabase
    .from("clients")
    .update({ email, invited_at: new Date().toISOString() })
    .eq("id", clientId)
    .select("first_name")
    .single();
  if (error || !client) return { error: error?.message ?? "Client not found" };
  const joinUrl = appUrl(`/join?email=${encodeURIComponent(email)}`);
  const mail = inviteEmail(client.first_name, joinUrl);
  const result = await sendEmail({ to: email, ...mail });
  await recordNotification(supabase, {
    practitioner_id: userId,
    client_id: clientId,
    type: "portal_invite",
    to_email: email,
    subject: mail.subject,
    result,
  });
  revalidatePath(`/clients/${clientId}`);
  return result.sent
    ? { ok: true, message: `Invite emailed to ${email}.` }
    : { ok: true, message: `Email not sent (${result.error}). Share this link manually: ${joinUrl}`, joinUrl };
}

export async function requestQuestionnaire(clientId: string): Promise<{ ok: true; message: string } | { error: string }> {
  const { supabase, userId } = await requirePractitioner();
  const latest = await loadLatestQuestionnaire(supabase, clientId);
  if (!latest) return { error: "The first questionnaire already appears in their portal after they join. No need to send it again yet." };
  if (!latest.submitted_at) return { error: "They already have a questionnaire waiting." };
  const { data: client } = await supabase.from("clients").select("first_name, email").eq("id", clientId).single();
  if (!client) return { error: "Client not found." };
  const { error } = await supabase.from("questionnaire_responses").insert({
    practitioner_id: userId,
    client_id: clientId,
    questionnaire_version: QUESTIONNAIRE_VERSION,
    answers: latest.answers ?? {},
    submitted_at: null,
  });
  if (error) return { error: error.message };
  const portalUrl = appUrl("/me/questionnaire");
  const mail = questionnaireRequestEmail(client.first_name, portalUrl);
  if (client.email) {
    const result = await sendEmail({ to: client.email, ...mail });
    await recordNotification(supabase, {
      practitioner_id: userId,
      client_id: clientId,
      type: "questionnaire_request",
      to_email: client.email,
      subject: mail.subject,
      result,
    });
    revalidatePath(`/clients/${clientId}`);
    revalidatePath("/me");
    revalidatePath("/me/questionnaire");
    return result.sent
      ? { ok: true, message: `Update requested. Email sent to ${client.email}.` }
      : { ok: true, message: `Update is now in their portal. Email not sent (${result.error}).` };
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/me");
  revalidatePath("/me/questionnaire");
  return { ok: true, message: "Update is now in their portal. Add an email if you want it sent as well." };
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------
export async function createProgram(formData: FormData) {
  const { supabase, userId } = await requirePractitioner();
  const clientId = String(formData.get("client_id"));
  const weeks = Math.max(1, Math.min(52, Number(formData.get("weeks") ?? 12)));
  const daysPerWeek = Math.max(1, Math.min(7, Number(formData.get("days_per_week") ?? 3)));
  const sessionId = String(formData.get("assessment_session_id") ?? "") || null;
  const responseId = String(formData.get("questionnaire_response_id") ?? "") || null;
  const parentId = String(formData.get("parent_program_id") ?? "") || null;

  let version = 1;
  if (parentId) {
    const { data: parent } = await supabase.from("programs").select("version").eq("id", parentId).single();
    version = (parent?.version ?? 0) + 1;
  }

  const startDate = String(formData.get("start_date") ?? "") || null;
  let expected: string | null = null;
  if (startDate) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + weeks * 7);
    expected = d.toISOString().slice(0, 10);
  }

  const { data: program, error } = await supabase
    .from("programs")
    .insert({
      practitioner_id: userId,
      client_id: clientId,
      assessment_session_id: sessionId,
      questionnaire_response_id: responseId,
      parent_program_id: parentId,
      version,
      title: String(formData.get("title") ?? "") || `${weeks}-week program`,
      weeks,
      days_per_week: daysPerWeek,
      start_date: startDate,
      expected_retest_date: expected,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !program) throw new Error(error?.message ?? "Could not create program");

  const sessions = [];
  for (let w = 1; w <= weeks; w += 1) {
    for (let d = 1; d <= daysPerWeek; d += 1) {
      sessions.push({ program_id: program.id, week: w, day: d, title: `Day ${d}` });
    }
  }
  const { error: sessError } = await supabase.from("program_sessions").insert(sessions);
  if (sessError) throw new Error(sessError.message);

  // Copy exercises from parent (new version starts from the previous plan).
  if (parentId) {
    const { data: parentSessions } = await supabase
      .from("program_sessions")
      .select("week, day, title, focus, notes, program_exercises(*)")
      .eq("program_id", parentId);
    const { data: newSessions } = await supabase
      .from("program_sessions")
      .select("id, week, day")
      .eq("program_id", program.id);
    const map = new Map((newSessions ?? []).map((s) => [`${s.week}-${s.day}`, s.id]));
    for (const ps of parentSessions ?? []) {
      const target = map.get(`${ps.week}-${ps.day}`);
      if (!target) continue;
      await supabase
        .from("program_sessions")
        .update({ title: ps.title, focus: ps.focus, notes: ps.notes })
        .eq("id", target);
      const ex = (ps.program_exercises as ExerciseRow[] | null) ?? [];
      if (ex.length) {
        await supabase.from("program_exercises").insert(
          ex.map((e) => ({
            program_session_id: target,
            position: e.position,
            exercise_id: e.exercise_id,
            exercise_name: e.exercise_name,
            side: e.side,
            sets: e.sets,
            reps: e.reps,
            load_prescription: e.load_prescription,
            rpe_target: e.rpe_target,
            tempo: e.tempo,
            rest_seconds: e.rest_seconds,
            notes: e.notes,
          })),
        );
      }
    }
  }

  redirect(`/programs/${program.id}`);
}

export async function updateProgramMeta(formData: FormData) {
  const { supabase } = await requirePractitioner();
  const id = String(formData.get("program_id"));
  const { error } = await supabase
    .from("programs")
    .update({
      title: String(formData.get("title") ?? "").trim() || "Program",
      start_date: String(formData.get("start_date") ?? "") || null,
      practitioner_notes: String(formData.get("practitioner_notes") ?? "").trim() || null,
      client_message: String(formData.get("client_message") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/programs/${id}`);
}

export async function saveSession(input: {
  programId: string;
  sessionId: string;
  title: string;
  focus: string | null;
  notes: string | null;
  exercises: ExerciseRow[];
}) {
  const { supabase } = await requirePractitioner();
  const { error: sErr } = await supabase
    .from("program_sessions")
    .update({ title: input.title, focus: input.focus, notes: input.notes })
    .eq("id", input.sessionId);
  if (sErr) return { error: sErr.message };

  // Replace exercise rows for this session. Existing rows with logs are
  // preserved by id where the client kept them.
  const keepIds = input.exercises.map((e) => e.id).filter((x): x is string => Boolean(x));
  const del = supabase.from("program_exercises").delete().eq("program_session_id", input.sessionId);
  const { error: dErr } = keepIds.length ? await del.not("id", "in", `(${keepIds.join(",")})`) : await del;
  if (dErr) return { error: dErr.message };

  const rows = input.exercises.map((e, i) => ({
    ...(e.id ? { id: e.id } : {}),
    program_session_id: input.sessionId,
    position: i,
    exercise_id: e.exercise_id,
    exercise_name: e.exercise_name.trim() || "Exercise",
    side: e.side,
    sets: Math.max(1, Number(e.sets) || 1),
    reps: String(e.reps || "8"),
    load_prescription: e.load_prescription?.trim() || null,
    rpe_target: e.rpe_target == null || Number.isNaN(Number(e.rpe_target)) ? null : Number(e.rpe_target),
    tempo: e.tempo?.trim() || null,
    rest_seconds: e.rest_seconds == null || Number.isNaN(Number(e.rest_seconds)) ? null : Number(e.rest_seconds),
    notes: e.notes?.trim() || null,
  }));
  if (rows.length) {
    const { error } = await supabase.from("program_exercises").upsert(rows, { onConflict: "id" });
    if (error) return { error: error.message };
  }
  revalidatePath(`/programs/${input.programId}`);
  return { ok: true };
}

export async function copyWeek(formData: FormData) {
  const { supabase } = await requirePractitioner();
  const programId = String(formData.get("program_id"));
  const from = Number(formData.get("from_week"));
  const to = Number(formData.get("to_week"));
  const { data: sessions } = await supabase
    .from("program_sessions")
    .select("id, week, day, title, focus, notes, program_exercises(*)")
    .eq("program_id", programId)
    .in("week", [from, to]);
  const src = (sessions ?? []).filter((s) => s.week === from);
  const dst = (sessions ?? []).filter((s) => s.week === to);
  for (const s of src) {
    const target = dst.find((d) => d.day === s.day);
    if (!target) continue;
    await supabase.from("program_exercises").delete().eq("program_session_id", target.id);
    await supabase
      .from("program_sessions")
      .update({ title: s.title, focus: s.focus, notes: s.notes })
      .eq("id", target.id);
    const ex = (s.program_exercises as ExerciseRow[] | null) ?? [];
    if (ex.length) {
      await supabase.from("program_exercises").insert(
        ex.map((e) => ({
          program_session_id: target.id,
          position: e.position,
          exercise_id: e.exercise_id,
          exercise_name: e.exercise_name,
          side: e.side,
          sets: e.sets,
          reps: e.reps,
          load_prescription: e.load_prescription,
          rpe_target: e.rpe_target,
          tempo: e.tempo,
          rest_seconds: e.rest_seconds,
          notes: e.notes,
        })),
      );
    }
  }
  revalidatePath(`/programs/${programId}`);
}

export async function copyWeekToAll(formData: FormData) {
  const { supabase } = await requirePractitioner();
  const programId = String(formData.get("program_id"));
  const from = Number(formData.get("from_week"));
  const { data: program } = await supabase.from("programs").select("weeks").eq("id", programId).single();
  for (let w = 1; w <= (program?.weeks ?? 0); w += 1) {
    if (w === from) continue;
    const fd = new FormData();
    fd.set("program_id", programId);
    fd.set("from_week", String(from));
    fd.set("to_week", String(w));
    await copyWeek(fd);
  }
}

export async function setProgramStatus(formData: FormData) {
  const { supabase, userId } = await requirePractitioner();
  const id = String(formData.get("program_id"));
  const status = String(formData.get("status"));
  const allowed = ["draft", "approved", "sent", "active", "completed", "archived"];
  if (!allowed.includes(status)) return { error: "Invalid status" };

  const patch: Record<string, unknown> = { status };
  if (status === "approved") patch.approved_at = new Date().toISOString();
  if (status === "sent") patch.sent_at = new Date().toISOString();

  const { data: program, error } = await supabase
    .from("programs")
    .update(patch)
    .eq("id", id)
    .select("id, title, client_id, client_message, assessment_session_id, clients(first_name, email)")
    .single();
  if (error || !program) return { error: error?.message ?? "Program not found" };

  let message = `Status: ${status}.`;
  if (status === "sent") {
    // Also release the report from the same session so the client sees both.
    if (program.assessment_session_id) {
      await supabase
        .from("generated_reports")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("assessment_session_id", program.assessment_session_id)
        .eq("client_id", program.client_id);
    }
    // Archive older sent/active programs for this client.
    await supabase
      .from("programs")
      .update({ status: "archived" })
      .eq("client_id", program.client_id)
      .neq("id", id)
      .in("status", ["sent", "active"]);

    const client = Array.isArray(program.clients) ? program.clients[0] : program.clients;
    const email = client?.email as string | null | undefined;
    const mail = programSentEmail(client?.first_name ?? "there", program.title, appUrl("/me"), program.client_message);
    const result = email
      ? await sendEmail({ to: email, ...mail })
      : ({ sent: false, provider: "none", error: "Client has no email on file" } as const);
    await recordNotification(supabase, {
      practitioner_id: userId,
      client_id: program.client_id,
      type: "program_sent",
      to_email: email ?? null,
      subject: mail.subject,
      result,
    });
    message = result.sent
      ? `Sent. Email delivered to ${email}.`
      : `Marked as sent and visible in the portal. Email not sent: ${result.error}.`;
  }
  revalidatePath(`/programs/${id}`);
  revalidatePath(`/clients/${program.client_id}`);
  return { ok: true, message };
}

export async function setReportStatus(formData: FormData) {
  const { supabase, userId } = await requirePractitioner();
  const id = String(formData.get("report_id"));
  const status = String(formData.get("status"));
  if (!["draft", "approved", "sent"].includes(status)) return { error: "Invalid status" };
  const patch: Record<string, unknown> = { status };
  if (status === "approved") patch.approved_at = new Date().toISOString();
  if (status === "sent") patch.sent_at = new Date().toISOString();
  const { data: report, error } = await supabase
    .from("generated_reports")
    .update(patch)
    .eq("id", id)
    .select("id, client_id, assessment_session_id, clients(first_name, email)")
    .single();
  if (error || !report) return { error: error?.message ?? "Report not found" };
  if (status === "sent") {
    const client = Array.isArray(report.clients) ? report.clients[0] : report.clients;
    const email = client?.email as string | null | undefined;
    const mail = reportSentEmail(client?.first_name ?? "there", appUrl("/me/report"));
    const result = email
      ? await sendEmail({ to: email, ...mail })
      : ({ sent: false, provider: "none", error: "Client has no email on file" } as const);
    await recordNotification(supabase, {
      practitioner_id: userId,
      client_id: report.client_id,
      type: "report_sent",
      to_email: email ?? null,
      subject: mail.subject,
      result,
    });
  }
  revalidatePath(`/assessments/${report.assessment_session_id}`);
  revalidatePath(`/clients/${report.client_id}`);
  return { ok: true };
}

export async function addExerciseToLibrary(formData: FormData) {
  const { supabase, userId } = await requirePractitioner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name required");
  const { error } = await supabase.from("exercises").insert({
    practitioner_id: userId,
    name,
    pattern: String(formData.get("pattern") ?? "other"),
    equipment: String(formData.get("equipment") ?? "").trim() || null,
    unilateral: String(formData.get("unilateral") ?? "") === "on",
    video_url: String(formData.get("video_url") ?? "").trim() || null,
    cues: String(formData.get("cues") ?? "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/programs");
}
