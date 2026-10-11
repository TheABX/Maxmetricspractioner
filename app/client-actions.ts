"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveViewer } from "@/lib/auth/role";
import { nutritionComplete } from "@/lib/nutrition/questionnaire";
import { upsertNutritionProfile } from "@/lib/nutrition/load";
import { QUESTIONNAIRE_SECTIONS, QUESTIONNAIRE_VERSION, deriveLoadBucket } from "@/lib/questionnaire/schema";

async function requireClient() {
  const supabase = await createClient();
  const viewer = await resolveViewer(supabase);
  if (viewer.role === "anonymous") redirect("/join");
  if (viewer.role === "unlinked") redirect("/join?unlinked=1");
  if (viewer.role !== "client") redirect("/");
  return { supabase, viewer };
}

export async function clientSignUp(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: "client",
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      },
    },
  });
  if (error) return { error: error.message };
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    return { error: "Check your email to confirm your address, then sign in." };
  }
  const { data: claimed, error: claimError } = await supabase.rpc("claim_client_profile");
  if (claimError) return { error: claimError.message };
  if (!claimed) {
    return {
      error:
        "Your login was created. If the clinic is not set up yet, ask your practitioner to sign in on the website first, then try again.",
    };
  }
  redirect("/me");
}

export async function clientSignIn(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  const viewer = await resolveViewer(supabase);
  if (viewer.role === "client") redirect("/me");
  if (viewer.role === "practitioner") redirect("/");
  const { data: claimed } = await supabase.rpc("claim_client_profile");
  if (claimed) redirect("/me");
  await supabase.auth.signOut();
  return {
    error:
      "Your login exists, but no client record could be created. Sign in once as the clinic practitioner on the website, then try again.",
  };
}

export async function clientSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/join");
}

export async function submitQuestionnaire(formData: FormData) {
  const { supabase, viewer } = await requireClient();
  const answers: Record<string, unknown> = {};
  for (const section of QUESTIONNAIRE_SECTIONS) {
    for (const field of section.fields) {
      if (field.type === "multi") {
        answers[field.key] = formData.getAll(field.key).map(String).filter(Boolean);
      } else {
        const v = String(formData.get(field.key) ?? "").trim();
        answers[field.key] = v || null;
      }
    }
  }
  const { data: client } = await supabase
    .from("clients")
    .select("practitioner_id")
    .eq("id", viewer.clientId)
    .single();
  if (!client) return { error: "Client record not found." };

  const existingId = String(formData.get("response_id") ?? "");
  const payload = {
    practitioner_id: client.practitioner_id,
    client_id: viewer.clientId,
    questionnaire_version: QUESTIONNAIRE_VERSION,
    answers,
    load_bucket: deriveLoadBucket(answers),
    submitted_at: new Date().toISOString(),
  };
  const { data: saved, error } = existingId
    ? await supabase.from("questionnaire_responses").update(payload).eq("id", existingId).select("id").single()
    : await supabase.from("questionnaire_responses").insert(payload).select("id").single();
  if (error) return { error: error.message };
  if (nutritionComplete(answers)) {
    await upsertNutritionProfile(supabase, {
      clientId: viewer.clientId,
      practitionerId: client.practitioner_id,
      answers,
      questionnaireResponseId: saved?.id ?? existingId ?? null,
    });
  }
  revalidatePath("/me");
  revalidatePath("/me/questionnaire");
  revalidatePath("/me/nutrition");
  redirect("/me");
}

export async function logSets(formData: FormData) {
  const { supabase, viewer } = await requireClient();
  const programExerciseId = String(formData.get("program_exercise_id"));
  const sessionId = String(formData.get("program_session_id"));
  const rows: {
    client_id: string;
    program_exercise_id: string;
    set_number: number;
    side: "both" | "left" | "right";
    reps_done: number | null;
    load_used: number | null;
    rpe: number | null;
    rir: number | null;
    pain_0_10: number | null;
    notes: string | null;
    logged_at: string;
  }[] = [];
  const num = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const sets = Number(formData.get("set_count") ?? 0);
  const sides = String(formData.get("sides") ?? "both").split(",") as ("both" | "left" | "right")[];
  const notes = String(formData.get("exercise_notes") ?? "").trim() || null;
  for (let s = 1; s <= sets; s += 1) {
    for (const side of sides) {
      const key = `${side}__${s}`;
      const reps = num(formData.get(`reps__${key}`));
      const load = num(formData.get(`load__${key}`));
      const rpe = num(formData.get(`rpe__${key}`));
      const rir = num(formData.get(`rir__${key}`));
      const pain = num(formData.get(`pain__${key}`));
      if (reps == null && load == null && rpe == null && rir == null && pain == null) continue;
      rows.push({
        client_id: viewer.clientId,
        program_exercise_id: programExerciseId,
        set_number: s,
        side,
        reps_done: reps == null ? null : Math.round(reps),
        load_used: load,
        rpe,
        rir,
        pain_0_10: pain == null ? null : Math.max(0, Math.min(10, Math.round(pain))),
        notes: s === 1 && side === sides[0] ? notes : null,
        logged_at: new Date().toISOString(),
      });
    }
  }
  if (rows.length) {
    const { error } = await supabase
      .from("set_logs")
      .upsert(rows, { onConflict: "client_id,program_exercise_id,set_number,side" });
    if (error) return { error: error.message };
  }
  // Ensure a session_log exists so the day shows as started.
  await supabase
    .from("session_logs")
    .upsert(
      { client_id: viewer.clientId, program_session_id: sessionId },
      { onConflict: "client_id,program_session_id", ignoreDuplicates: true },
    );
  revalidatePath(`/me/session/${sessionId}`);
  revalidatePath("/me");
  return { ok: true };
}

export async function completeSession(formData: FormData) {
  const { supabase, viewer } = await requireClient();
  const sessionId = String(formData.get("program_session_id"));
  const skipped = String(formData.get("skipped") ?? "false") === "true";
  const rpeRaw = String(formData.get("overall_rpe") ?? "").trim();
  const durRaw = String(formData.get("duration_minutes") ?? "").trim();
  const { error } = await supabase.from("session_logs").upsert(
    {
      client_id: viewer.clientId,
      program_session_id: sessionId,
      completed_at: skipped ? null : new Date().toISOString(),
      skipped,
      overall_rpe: rpeRaw ? Number(rpeRaw) : null,
      duration_minutes: durRaw ? Number(durRaw) : null,
      energy_0_10: optionalTen(formData.get("energy_0_10")),
      motivation_0_10: optionalTen(formData.get("motivation_0_10")),
      sleep_quality_0_10: optionalTen(formData.get("sleep_quality_0_10")),
      soreness_0_10: optionalTen(formData.get("soreness_0_10")),
      fatigue_0_10: optionalTen(formData.get("fatigue_0_10")),
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
    { onConflict: "client_id,program_session_id" },
  );
  if (error) return { error: error.message };
  revalidatePath(`/me/session/${sessionId}`);
  revalidatePath("/me");
  return { ok: true };
}

function optionalTen(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n)));
}

export async function askCoach(question: string): Promise<{ ok: true; reply: string } | { error: string }> {
  const { supabase, viewer } = await requireClient();
  const text = question.trim();
  if (!text) return { error: "Write a question first." };
  const { data: client } = await supabase.from("clients").select("first_name, practitioner_id").eq("id", viewer.clientId).single();
  if (!client) return { error: "Client record not found." };
  const { answerCoach } = await import("@/lib/comms-engine/coach");
  const { loadProgramAdaptation } = await import("@/lib/adaptation-engine/load");
  let adaptation = null;
  let selection = null;
  let structure = null;
  try {
    const loaded = await loadProgramAdaptation(supabase, viewer.clientId);
    adaptation = loaded.effective;
    selection = loaded.dosage.selection.effective;
    structure = loaded.dosage.selection.structure.effective;
  } catch {
    adaptation = null;
  }
  const { error: inErr } = await supabase.from("client_messages").insert({
    practitioner_id: client.practitioner_id,
    client_id: viewer.clientId,
    event_type: "CLIENT_REPLY",
    priority: "NORMAL",
    message_channel: "IN_APP",
    message_text: text,
    generated_by: "CLIENT",
    automation_status: "SENT",
    direction: "IN",
    sent_at: new Date().toISOString(),
  });
  if (inErr) return { error: inErr.message };
  const emptyAdapt = adaptation ?? {
    exercises: [],
    client: {
      window_days: 14,
      sessions_prescribed: 0,
      sessions_completed: 0,
      sessions_skipped: 0,
      adherence_percent: 0,
      adherence_band: "MODERATE",
      pain_status: "NONE",
      recovery_trend: "INSUFFICIENT_DATA",
      strength_trend: "INSUFFICIENT_DATA",
      duration_mismatch: false,
      retest_due: false,
      traffic: "GREEN",
      fortnightly_outcome: "NO_ACTION",
      summary: "",
      messages: [],
      queue: [],
      possible_adherence_reasons: [],
    },
    rationale: [],
    flags: [],
    automation_level: "LEVEL_1_SUGGEST",
    weights_id: "v1",
  };
  const reply = answerCoach(text, {
    first_name: client.first_name,
    adaptation: emptyAdapt as never,
    selection,
    structure,
  });
  const { error: outErr } = await supabase.from("client_messages").insert({
    practitioner_id: client.practitioner_id,
    client_id: viewer.clientId,
    event_type: reply.event,
    priority: reply.escalate ? "HIGH" : "NORMAL",
    message_channel: "IN_APP",
    message_text: reply.body,
    generated_by: "TEMPLATE",
    automation_status: "SENT",
    practitioner_notes: reply.why.join(" · "),
    direction: "OUT",
    sent_at: new Date().toISOString(),
    practitioner_reviewed: !reply.requires_approval,
    trigger_data: { why: reply.why },
  });
  if (outErr) return { error: outErr.message };
  revalidatePath("/me/messages");
  return { ok: true, reply: reply.body };
}

export async function reportSignedUrl(reportId: string) {
  const { supabase } = await requireClient();
  const { data: report } = await supabase
    .from("generated_reports")
    .select("storage_path")
    .eq("id", reportId)
    .maybeSingle();
  if (!report?.storage_path) return { error: "Report not available." };
  const { data, error } = await supabase.storage
    .from("assessment-files")
    .createSignedUrl(report.storage_path, 60 * 10);
  if (error || !data) return { error: error?.message ?? "Could not open report." };
  return { url: data.signedUrl };
}
