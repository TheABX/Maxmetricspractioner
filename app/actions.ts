"use server";

import { createHash } from "crypto";
import ExcelJS from "exceljs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseForcePlateSheet } from "@/lib/force-plate/parse";
import {
  deriveTrial,
  coefficientOfVariation,
  selectBestTrialIndex,
  trialRowColumns,
  round,
} from "@/lib/force-plate/derive";
import { consistencyStatus, interpretForcePlate } from "@/lib/force-plate/interpret";
import { renderCombinedReport } from "@/lib/report/combined-pdf";
import { isometricTest } from "@/lib/isometric/tests";
import { symmetryLabel, type SymmetryStatus } from "@/lib/metrics/stats";

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login");
  const userId = data.claims.sub as string;
  const meta = data.claims.user_metadata as { role?: string } | undefined;
  if (meta?.role === "client") redirect("/me");
  await supabase.from("practitioners").upsert({ id: userId }, { onConflict: "id" });
  return { supabase, userId };
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "Deon Kenzie");
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createClientProfile(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const payload = {
    practitioner_id: userId,
    first_name: String(formData.get("first_name") ?? "").trim(),
    last_name: String(formData.get("last_name") ?? "").trim(),
    dob: String(formData.get("dob") ?? ""),
    sex: String(formData.get("sex") ?? "unspecified"),
    height_cm: Number(formData.get("height_cm")),
    bodyweight_kg: Number(formData.get("bodyweight_kg")),
    dominant_hand: String(formData.get("dominant_hand") ?? "unknown"),
    dominant_leg: String(formData.get("dominant_leg") ?? "unknown"),
    email: String(formData.get("email") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    goals: String(formData.get("goals") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  };
  const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  redirect(`/clients/${data.id}`);
}

export async function createAssessment(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const clientId = String(formData.get("client_id"));
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();
  if (clientError || !client) throw new Error(clientError?.message ?? "Client not found");

  const bodyweight = Number(formData.get("bodyweight_kg") || client.bodyweight_kg);
  const height = Number(formData.get("height_cm") || client.height_cm);
  const { data, error } = await supabase
    .from("assessment_sessions")
    .insert({
      practitioner_id: userId,
      client_id: clientId,
      assessment_type: String(formData.get("assessment_type") ?? "baseline"),
      assessment_date: String(formData.get("assessment_date")),
      bodyweight_kg: bodyweight,
      height_cm: height,
      practitioner_name: String(formData.get("practitioner_name") ?? "Deon Kenzie"),
      status: "in_progress",
      notes: String(formData.get("notes") ?? "") || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/assessments/${data.id}`);
}

export async function previewForcePlateFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose an Excel file." };
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { error: "Workbook has no worksheets." };
  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    rows.push(row.values as unknown[]);
  });
  const normalised = rows.map((row) => {
    const values = Array.isArray(row) ? row.slice(1) : [];
    return values;
  });
  const parsed = parseForcePlateSheet(normalised);
  return { parsed, fileName: file.name, byteSize: file.size };
}

function storagePath(userId: string, clientId: string, assessmentId: string, name: string) {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${clientId}/${assessmentId}/raw/${safe}`;
}

export async function commitForcePlateImport(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const assessmentId = String(formData.get("assessment_id"));
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Missing file." };

  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("*, clients(*)")
    .eq("id", assessmentId)
    .single();
  if (sessionError || !session) return { error: sessionError?.message ?? "Assessment not found" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha = createHash("sha256").update(buffer).digest("hex");

  const { data: existing } = await supabase
    .from("uploaded_files")
    .select("id")
    .eq("assessment_session_id", assessmentId)
    .eq("content_sha256", sha)
    .maybeSingle();
  if (existing) {
    return { error: "Duplicate file already uploaded for this assessment." };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    rows.push((row.values as unknown[]).slice(1));
  });
  const parsed = parseForcePlateSheet(rows);
  if (parsed.fileType !== "FORCE_PLATE_EXPORT_V1") {
    return { error: parsed.warnings[0]?.message ?? "Unrecognised file." };
  }

  const path = storagePath(userId, session.client_id, assessmentId, file.name);
  const { error: uploadError } = await supabase.storage.from("assessment-files").upload(path, buffer, {
    contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });
  if (uploadError) return { error: `Storage upload failed: ${uploadError.message}` };

  await supabase.from("uploaded_files").insert({
    practitioner_id: userId,
    client_id: session.client_id,
    assessment_session_id: assessmentId,
    original_name: file.name,
    storage_path: path,
    file_type: "FORCE_PLATE_EXPORT_V1",
    content_sha256: sha,
    byte_size: file.size,
  });

  const grouped = new Map<string, typeof parsed.trials>();
  for (const trial of parsed.trials) {
    const key = trial.movement.testType;
    const list = grouped.get(key) ?? [];
    list.push(trial);
    grouped.set(key, list);
  }

  const bodyweight = Number(session.bodyweight_kg);
  let firstTestId: string | null = null;

  for (const [testType, trials] of grouped) {
    const displayName = trials[0]?.movement.displayName ?? "Force plate test";
    const { data: test, error: testError } = await supabase
      .from("test_instances")
      .upsert(
        {
          practitioner_id: userId,
          assessment_session_id: assessmentId,
          test_type: testType,
          movement_name: displayName,
          status: "imported",
        },
        { onConflict: "assessment_session_id,test_type" },
      )
      .select()
      .single();
    if (testError || !test) return { error: testError?.message ?? "Could not create test" };
    firstTestId ??= test.id;

    await supabase.from("force_plate_trials").delete().eq("test_instance_id", test.id);
    await supabase.from("metric_values").delete().eq("test_instance_id", test.id);

    const derivedTrials = trials.map((trial) => ({
      trial,
      derived: deriveTrial(trial, bodyweight),
    }));
    const bestIndex = selectBestTrialIndex(
      derivedTrials.map(({ trial }) => ({
        combinedPeak: trial.combined?.peak_force_kg ?? null,
        excluded: false,
      })),
    );

    const inserts = derivedTrials.map(({ trial, derived }, idx) => {
      const columns = trialRowColumns(trial, derived);
      return {
        practitioner_id: userId,
        assessment_session_id: assessmentId,
        test_instance_id: test.id,
        is_best_trial: idx === bestIndex,
        is_excluded: false,
        is_valid: trial.warnings.length === 0,
        ...columns,
        trial_number: trial.trial,
        performed_at: trial.performed_at,
        athlete_name: trial.athlete_name,
        movement_name: trial.movement_name,
        raw_rows: { combined: trial.combined, left: trial.left, right: trial.right },
      };
    });

    const { data: savedTrials, error: trialError } = await supabase
      .from("force_plate_trials")
      .insert(inserts)
      .select();
    if (trialError) return { error: trialError.message };

    await refreshForcePlateResult(test.id, assessmentId, userId, savedTrials ?? [], session, displayName);
  }

  revalidatePath(`/assessments/${assessmentId}`);
  return { ok: true, testId: firstTestId, parsed };
}

async function refreshForcePlateResult(
  testId: string,
  assessmentId: string,
  userId: string,
  trials: Record<string, unknown>[],
  session: { bodyweight_kg: number; clients?: { first_name?: string } | { first_name?: string }[] },
  movementName: string,
) {
  const supabase = await createClient();
  const included = trials.filter((t) => !t.is_excluded);
  const peaks = included
    .map((t) => Number(t.combined_peak_force_kg))
    .filter((n) => Number.isFinite(n));
  const cv = coefficientOfVariation(peaks);
  const consistency = consistencyStatus(cv);
  const selected =
    included.find((t) => t.is_best_trial) ??
    included.sort(
      (a, b) => Number(b.combined_peak_force_kg ?? 0) - Number(a.combined_peak_force_kg ?? 0),
    )[0];

  const clientName = Array.isArray(session.clients)
    ? session.clients[0]?.first_name
    : session.clients?.first_name;

  const interpretation = interpretForcePlate({
    clientFirstName: clientName ?? "You",
    movementName,
    peakForceKg: selected ? Number(selected.combined_peak_force_kg) : null,
    relativePeakForce: selected ? Number(selected.calculated_relative_peak_force) : null,
    force200msKg: selected ? Number(selected.combined_force_200ms_kg) : null,
    rfdPeakNs: selected ? Number(selected.combined_rfd_peak_ns) : null,
    leftContribution: selected ? Number(selected.calculated_left_contribution) : null,
    rightContribution: selected ? Number(selected.calculated_right_contribution) : null,
    asymmetryPercent: selected ? Number(selected.peak_force_asymmetry_percent) : null,
    weakerSide: (selected?.weaker_side as "L" | "R" | null) ?? null,
    referenceAvailable: false,
  });

  const { error } = await supabase.from("force_plate_results").upsert(
    {
      practitioner_id: userId,
      assessment_session_id: assessmentId,
      test_instance_id: testId,
      best_trial_id: selected?.id ?? null,
      selected_trial_id: selected?.id ?? null,
      selection_mode: "algorithm",
      trial_count: trials.length,
      valid_trial_count: included.length,
      trial_consistency_cv_percent: cv,
      trial_consistency_status: consistency.label,
      peak_force_kg: selected?.combined_peak_force_kg ?? null,
      relative_peak_force: selected?.calculated_relative_peak_force ?? null,
      force_200ms_kg: selected?.combined_force_200ms_kg ?? null,
      rfd_peak_ns: selected?.combined_rfd_peak_ns ?? null,
      time_to_peak_force_ms: selected?.combined_time_to_peak_force_ms ?? null,
      peak_force_asymmetry_percent: selected?.peak_force_asymmetry_percent ?? null,
      weaker_side: selected?.weaker_side ?? null,
      stronger_side: selected?.stronger_side ?? null,
      left_contribution: selected?.calculated_left_contribution ?? null,
      right_contribution: selected?.calculated_right_contribution ?? null,
      interpretation,
      body_map: interpretation.bodyMap,
    },
    { onConflict: "test_instance_id" },
  );
  if (error) throw new Error(error.message);

  if (selected?.id) {
    const metrics = [
      {
        key: "peak_force_kg",
        value: selected.combined_peak_force_kg,
        unit: "kgf",
        source: "device_measured",
      },
      {
        key: "calculated_relative_peak_force",
        value: selected.calculated_relative_peak_force,
        unit: "xBW",
        source: "derived",
      },
      {
        key: "peak_force_asymmetry_percent",
        value: selected.peak_force_asymmetry_percent,
        unit: "%",
        source: "derived",
      },
      {
        key: "force_200ms_kg",
        value: selected.combined_force_200ms_kg,
        unit: "kgf",
        source: "device_measured",
      },
    ];
    await supabase.from("metric_values").delete().eq("test_instance_id", testId);
    await supabase.from("metric_values").insert(
      metrics.map((m) => ({
        practitioner_id: userId,
        test_instance_id: testId,
        trial_id: selected.id,
        metric_key: m.key,
        value: m.value,
        unit: m.unit,
        source_type: m.source,
        reference_available: false,
      })),
    );
  }

  void round;
}

export async function updateTrialOverride(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const trialId = String(formData.get("trial_id"));
  const assessmentId = String(formData.get("assessment_id"));
  const excluded = String(formData.get("is_excluded")) === "true";
  const reason = String(formData.get("exclusion_reason") ?? "") || null;
  const makeBest = String(formData.get("make_best")) === "true";
  const movement = String(formData.get("movement_name") ?? "") || null;

  const { data: trial, error } = await supabase
    .from("force_plate_trials")
    .update({
      is_excluded: excluded,
      exclusion_reason: reason,
      movement_name: movement ?? undefined,
    })
    .eq("id", trialId)
    .select()
    .single();
  if (error || !trial) return { error: error?.message ?? "Trial not found" };

  const { data: trials } = await supabase
    .from("force_plate_trials")
    .select("*")
    .eq("test_instance_id", trial.test_instance_id)
    .order("trial_number");

  if (trials) {
    let next = trials.map((t) => ({ ...t, is_best_trial: false }));
    if (makeBest && !excluded) {
      next = next.map((t) => ({ ...t, is_best_trial: t.id === trialId }));
    } else {
      const idx = selectBestTrialIndex(
        next.map((t) => ({
          combinedPeak: t.combined_peak_force_kg === null ? null : Number(t.combined_peak_force_kg),
          excluded: Boolean(t.is_excluded),
        })),
      );
      next = next.map((t, i) => ({ ...t, is_best_trial: i === idx }));
    }
    for (const t of next) {
      await supabase
        .from("force_plate_trials")
        .update({ is_best_trial: t.is_best_trial, is_excluded: t.is_excluded })
        .eq("id", t.id);
    }

    if (movement) {
      await supabase
        .from("test_instances")
        .update({ movement_name: movement })
        .eq("id", trial.test_instance_id);
    }

    const { data: session } = await supabase
      .from("assessment_sessions")
      .select("*, clients(*)")
      .eq("id", assessmentId)
      .single();
    if (session) {
      await refreshForcePlateResult(
        trial.test_instance_id,
        assessmentId,
        userId,
        next,
        session,
        String(trial.movement_name ?? "Force plate test"),
      );
    }
  }

  revalidatePath(`/assessments/${assessmentId}`);
  return { ok: true };
}

export async function markTestInvalid(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const testId = String(formData.get("test_id"));
  const assessmentId = String(formData.get("assessment_id"));
  await supabase
    .from("test_instances")
    .update({
      is_invalid: String(formData.get("is_invalid")) === "true",
      invalid_reason: String(formData.get("invalid_reason") ?? "") || null,
    })
    .eq("id", testId);
  revalidatePath(`/assessments/${assessmentId}`);
}

export async function saveIsometricBattery(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const assessmentId = String(formData.get("assessment_id"));
  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("*, clients(*)")
    .eq("id", assessmentId)
    .single();
  if (sessionError || !session) return { error: sessionError?.message ?? "Assessment not found" };

  const { ISOMETRIC_BATTERY } = await import("@/lib/isometric/tests");
  const { deriveIsometric } = await import("@/lib/isometric/derive");
  const { interpretIsometric } = await import("@/lib/isometric/interpret");
  const { DEFAULT_CV_REVIEW_PERCENT } = await import("@/lib/metrics/stats");
  const bodyweight = Number(session.bodyweight_kg);

  for (const test of ISOMETRIC_BATTERY) {
    const sides = test.laterality === "bilateral" ? (["BILATERAL"] as const) : (["L", "R"] as const);
    const inputs: { side: "L" | "R" | "BILATERAL"; trial_number: number; peak_force: number; excluded: boolean }[] = [];
    for (const side of sides) {
      for (const n of [1, 2, 3]) {
        const raw = String(formData.get(`${test.testType}__${side}__${n}`) ?? "").trim();
        if (!raw) continue;
        const peak = Number(raw);
        if (!Number.isFinite(peak)) continue;
        inputs.push({ side, trial_number: n, peak_force: peak, excluded: false });
      }
    }
    if (inputs.length === 0) continue;

    const { data: instance, error: instanceError } = await supabase
      .from("test_instances")
      .upsert(
        {
          practitioner_id: userId,
          assessment_session_id: assessmentId,
          test_type: test.testType,
          movement_name: test.displayName,
          status: "imported",
        },
        { onConflict: "assessment_session_id,test_type" },
      )
      .select()
      .single();
    if (instanceError || !instance) return { error: instanceError?.message ?? "Could not save isometric test" };

    await supabase.from("isometric_trials").delete().eq("test_instance_id", instance.id);
    const derived = deriveIsometric(inputs, bodyweight, DEFAULT_CV_REVIEW_PERCENT);
    const inserts = inputs.map((row) => ({
      practitioner_id: userId,
      assessment_session_id: assessmentId,
      test_instance_id: instance.id,
      movement: test.displayName,
      side: row.side,
      trial_number: row.trial_number,
      peak_force: row.peak_force,
      relative_peak_force: bodyweight > 0 ? row.peak_force / bodyweight : null,
      valid: true,
      selected_as_best:
        row.side === "BILATERAL"
          ? row.peak_force === derived.best_bilateral_peak_force
          : row.side === "L"
            ? row.peak_force === derived.best_left_peak_force
            : row.peak_force === derived.best_right_peak_force,
      source_type: "practitioner_entered",
      raw_source_data: {},
    }));
    const { error: trialError } = await supabase.from("isometric_trials").insert(inserts);
    if (trialError) return { error: trialError.message };

    const clientName = Array.isArray(session.clients)
      ? session.clients[0]?.first_name
      : session.clients?.first_name;
    const copy = interpretIsometric({
      firstName: clientName ?? "You",
      testType: test.testType,
      derived,
    });
    const { error: resultError } = await supabase.from("isometric_results").upsert(
      {
        practitioner_id: userId,
        assessment_session_id: assessmentId,
        test_instance_id: instance.id,
        ...derived,
        interpretation: copy,
      },
      { onConflict: "test_instance_id" },
    );
    if (resultError) return { error: resultError.message };
  }

  revalidatePath(`/assessments/${assessmentId}`);
  return { ok: true };
}

export async function saveGripStrength(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const assessmentId = String(formData.get("assessment_id"));
  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("*, clients(*)")
    .eq("id", assessmentId)
    .single();
  if (sessionError || !session) return { error: sessionError?.message ?? "Assessment not found" };

  const { GRIP_TEST } = await import("@/lib/grip/meta");
  const { deriveIsometric } = await import("@/lib/isometric/derive");
  const { DEFAULT_CV_REVIEW_PERCENT } = await import("@/lib/metrics/stats");
  const bodyweight = Number(session.bodyweight_kg);
  const inputs: { side: "L" | "R"; trial_number: number; peak_force: number; excluded: boolean }[] = [];
  for (const side of ["L", "R"] as const) {
    for (const n of [1, 2, 3]) {
      const raw = String(formData.get(`${GRIP_TEST.testType}__${side}__${n}`) ?? "").trim();
      if (!raw) continue;
      const peak = Number(raw);
      if (!Number.isFinite(peak)) continue;
      inputs.push({ side, trial_number: n, peak_force: peak, excluded: false });
    }
  }
  if (inputs.length === 0) return { error: "Enter at least one left or right grip trial." };

  const { data: instance, error: instanceError } = await supabase
    .from("test_instances")
    .upsert(
      {
        practitioner_id: userId,
        assessment_session_id: assessmentId,
        test_type: GRIP_TEST.testType,
        movement_name: GRIP_TEST.displayName,
        status: "imported",
      },
      { onConflict: "assessment_session_id,test_type" },
    )
    .select()
    .single();
  if (instanceError || !instance) return { error: instanceError?.message ?? "Could not save grip test" };

  await supabase.from("isometric_trials").delete().eq("test_instance_id", instance.id);
  const derived = deriveIsometric(inputs, bodyweight, DEFAULT_CV_REVIEW_PERCENT);
  const { error: trialError } = await supabase.from("isometric_trials").insert(
    inputs.map((row) => ({
      practitioner_id: userId,
      assessment_session_id: assessmentId,
      test_instance_id: instance.id,
      movement: GRIP_TEST.displayName,
      side: row.side,
      trial_number: row.trial_number,
      peak_force: row.peak_force,
      relative_peak_force: bodyweight > 0 ? row.peak_force / bodyweight : null,
      valid: true,
      selected_as_best:
        row.side === "L"
          ? row.peak_force === derived.best_left_peak_force
          : row.peak_force === derived.best_right_peak_force,
      source_type: "practitioner_entered",
      raw_source_data: {},
    })),
  );
  if (trialError) return { error: trialError.message };

  const copy = {
    whatThisMeasures: GRIP_TEST.whatThisMeasures,
    whyItMatters: GRIP_TEST.whyItMatters,
    interpretation: `Grip: left ${derived.best_left_peak_force?.toFixed(1) ?? "—"} kg, right ${derived.best_right_peak_force?.toFixed(1) ?? "—"} kg.${
      derived.asymmetry_percent != null
        ? ` Side-to-side difference ${derived.asymmetry_percent.toFixed(1)}%. This is a symmetry finding, not a population-strength rating.`
        : ""
    }`,
    programming:
      derived.symmetry_status === "priority"
        ? "Consider extra grip and carrying work on the lower side while building whole-body strength."
        : "Keep loading both hands in daily carrying and training, then retest.",
  };
  const { error: resultError } = await supabase.from("isometric_results").upsert(
    {
      practitioner_id: userId,
      assessment_session_id: assessmentId,
      test_instance_id: instance.id,
      ...derived,
      interpretation: copy,
    },
    { onConflict: "test_instance_id" },
  );
  if (resultError) return { error: resultError.message };

  revalidatePath(`/assessments/${assessmentId}`);
  return { ok: true };
}

function ageYearsFromDob(dob: string | null | undefined) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function numOrNull(raw: string) {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export async function saveMobilityBattery(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const assessmentId = String(formData.get("assessment_id"));
  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("*, clients(*)")
    .eq("id", assessmentId)
    .single();
  if (sessionError || !session) return { error: sessionError?.message ?? "Assessment not found" };

  const { MOBILITY_BATTERY, OVERHEAD_SQUAT } = await import("@/lib/mobility/tests");
  const { deriveMobility } = await import("@/lib/mobility/derive");
  const { interpretMobility, interpretOverheadSquat } = await import("@/lib/mobility/interpret");
  const { hitFromRow, matchReferenceRow } = await import("@/lib/mobility/reference");
  type ReferenceValueRow = import("@/lib/mobility/reference").ReferenceValueRow;

  const client = Array.isArray(session.clients) ? session.clients[0] : session.clients;
  const ageYears = ageYearsFromDob(client?.dob);
  const sex = client?.sex ?? null;

  const { data: refRows } = await supabase
    .from("reference_values")
    .select(
      "dataset_id, metric_key, protocol, sex, age_min, age_max, side, mean_value, standard_deviation, percentile_5, percentile_10, percentile_25, percentile_50, percentile_75, percentile_90, percentile_95",
    )
    .in(
      "metric_key",
      MOBILITY_BATTERY.map((t) => t.testKey),
    );
  const refs = (refRows ?? []) as ReferenceValueRow[];

  let saved = 0;
  for (const test of MOBILITY_BATTERY) {
    const trials: { side: "L" | "R"; trial_number: number; value: number | null; excluded: boolean }[] = [];
    for (const side of ["L", "R"] as const) {
      for (const n of [1, 2, 3]) {
        const value = numOrNull(String(formData.get(`${test.testKey}__${side}__${n}`) ?? ""));
        if (value == null) continue;
        trials.push({ side, trial_number: n, value, excluded: false });
      }
    }
    const practitionerLeft = numOrNull(String(formData.get(`${test.testKey}__L__result`) ?? ""));
    const practitionerRight = numOrNull(String(formData.get(`${test.testKey}__R__result`) ?? ""));
    if (trials.length === 0 && practitionerLeft == null && practitionerRight == null) continue;

    const derived = deriveMobility({
      trials,
      method: test.trialSelectionMethod,
      practitionerLeft,
      practitionerRight,
    });
    const protocolSnapshot = {
      protocol_id: test.protocolId,
      protocol_version: String(formData.get(`${test.testKey}__protocol_version`) ?? test.protocolVersion),
      testing_position: String(formData.get(`${test.testKey}__testing_position`) ?? test.testingPosition ?? ""),
      hip_angle: String(formData.get(`${test.testKey}__hip_angle`) ?? test.hipAngle ?? ""),
      measurement_method: String(formData.get(`${test.testKey}__measurement_method`) ?? test.measurementMethod ?? ""),
      device_used: String(formData.get(`${test.testKey}__device_used`) ?? ""),
    };
    const leftRow = matchReferenceRow(refs, {
      metricKey: test.testKey,
      protocol: test.protocolId,
      sex,
      ageYears,
      side: "L",
    });
    const rightRow = matchReferenceRow(refs, {
      metricKey: test.testKey,
      protocol: test.protocolId,
      sex,
      ageYears,
      side: "R",
    });
    const leftRef = hitFromRow(leftRow, derived.left_value);
    const rightRef = hitFromRow(rightRow, derived.right_value);
    const copy = interpretMobility({ def: test, derived, leftRef, rightRef });
    const notes = String(formData.get(`${test.testKey}__notes`) ?? "").trim();

    const { data: instance, error: instanceError } = await supabase
      .from("test_instances")
      .upsert(
        {
          practitioner_id: userId,
          assessment_session_id: assessmentId,
          test_type: test.testKey,
          movement_name: test.displayName,
          status: "imported",
        },
        { onConflict: "assessment_session_id,test_type" },
      )
      .select()
      .single();
    if (instanceError || !instance) return { error: instanceError?.message ?? "Could not save mobility test" };

    await supabase.from("mobility_trials").delete().eq("test_instance_id", instance.id);
    if (trials.length) {
      const { error: trialError } = await supabase.from("mobility_trials").insert(
        trials.map((row) => ({
          practitioner_id: userId,
          assessment_session_id: assessmentId,
          test_instance_id: instance.id,
          test_key: test.testKey,
          side: row.side,
          trial_number: row.trial_number,
          value: row.value,
          unit: test.unit,
          valid: true,
          selected:
            (row.side === "L" && row.trial_number === derived.selected_left_trial) ||
            (row.side === "R" && row.trial_number === derived.selected_right_trial),
          source_type: "practitioner_entered",
          raw_source_data: {},
        })),
      );
      if (trialError) return { error: trialError.message };
    }

    const { error: resultError } = await supabase.from("mobility_results").upsert(
      {
        practitioner_id: userId,
        assessment_session_id: assessmentId,
        test_instance_id: instance.id,
        test_key: test.testKey,
        protocol_id: test.protocolId,
        protocol_snapshot: protocolSnapshot,
        unit: test.unit,
        left_value: derived.left_value,
        right_value: derived.right_value,
        absolute_difference: derived.absolute_difference,
        percentage_difference: derived.percentage_difference,
        lower_side: derived.lower_side,
        trial_selection_method: derived.trial_selection_method,
        left_percentile: leftRef?.percentile ?? null,
        right_percentile: rightRef?.percentile ?? null,
        left_reference_mean: leftRef?.mean ?? null,
        right_reference_mean: rightRef?.mean ?? null,
        left_reference_category: leftRef?.category ?? null,
        right_reference_category: rightRef?.category ?? null,
        reference_dataset_id: leftRef?.datasetId ?? rightRef?.datasetId ?? null,
        reference_available: Boolean(leftRef || rightRef),
        population_status: leftRef || rightRef ? "loaded" : "reference_pending",
        symmetry_status: derived.symmetry_status,
        higher_is_favourable: test.higherIsFavourable,
        interpretation: { ...copy, notes: notes || null },
      },
      { onConflict: "test_instance_id" },
    );
    if (resultError) return { error: resultError.message };
    saved += 1;
  }

  const ohsFields = [
    "depth_achieved",
    "heel_contact",
    "left_right_weight_shift",
    "knee_tracking",
    "trunk_control",
    "overhead_arm_position",
    "pain_reported",
    "practitioner_notes",
  ] as const;
  const ohs: Record<string, string | null> = {};
  for (const key of ohsFields) {
    const v = String(formData.get(`OHS__${key}`) ?? "").trim();
    ohs[key] = v || null;
  }
  const ohsHasAny = ohsFields.some((k) => ohs[k]);
  if (ohsHasAny) {
    const { data: instance, error: instanceError } = await supabase
      .from("test_instances")
      .upsert(
        {
          practitioner_id: userId,
          assessment_session_id: assessmentId,
          test_type: OVERHEAD_SQUAT.testKey,
          movement_name: OVERHEAD_SQUAT.displayName,
          status: "imported",
        },
        { onConflict: "assessment_session_id,test_type" },
      )
      .select()
      .single();
    if (instanceError || !instance) return { error: instanceError?.message ?? "Could not save squat observation" };
    const copy = interpretOverheadSquat({
      depth_achieved: ohs.depth_achieved,
      heel_contact: ohs.heel_contact,
      left_right_weight_shift: ohs.left_right_weight_shift,
      knee_tracking: ohs.knee_tracking,
      trunk_control: ohs.trunk_control,
      overhead_arm_position: ohs.overhead_arm_position,
      pain_reported: ohs.pain_reported,
      practitioner_notes: ohs.practitioner_notes,
    });
    const { error: obsError } = await supabase.from("mobility_observations").upsert(
      {
        practitioner_id: userId,
        assessment_session_id: assessmentId,
        test_instance_id: instance.id,
        test_key: OVERHEAD_SQUAT.testKey,
        ...ohs,
      },
      { onConflict: "test_instance_id" },
    );
    if (obsError) return { error: obsError.message };
    await supabase.from("mobility_results").upsert(
      {
        practitioner_id: userId,
        assessment_session_id: assessmentId,
        test_instance_id: instance.id,
        test_key: OVERHEAD_SQUAT.testKey,
        protocol_id: OVERHEAD_SQUAT.protocolId,
        protocol_snapshot: { protocol_id: OVERHEAD_SQUAT.protocolId, protocol_version: OVERHEAD_SQUAT.protocolVersion },
        trial_selection_method: "SINGLE",
        reference_available: false,
        population_status: "not_applicable",
        symmetry_status: "unavailable",
        interpretation: copy,
      },
      { onConflict: "test_instance_id" },
    );
    saved += 1;
  }

  if (saved === 0) return { error: "Enter at least one mobility result or squat observation." };
  revalidatePath(`/assessments/${assessmentId}`);
  return { ok: true };
}

export async function generateForcePlateReport(assessmentId: string) {
  const { supabase, userId } = await requireUser();
  const { data: session, error } = await supabase
    .from("assessment_sessions")
    .select("*, clients(*), test_instances(*, force_plate_results(*), force_plate_trials(*))")
    .eq("id", assessmentId)
    .single();
  if (error || !session) return { error: error?.message ?? "Assessment not found" };

  const client = session.clients as {
    id: string;
    first_name: string;
    last_name: string;
    dob: string;
    sex: string;
  };
  const tests = (session.test_instances ?? []) as Record<string, unknown>[];
  const forceTests = tests.filter(
    (t) => String(t.test_type ?? "").startsWith("FORCE_PLATE_") && t.test_type !== "FORCE_PLATE_FREE_TRAINING" && !t.is_invalid,
  );
  const { data: isoRows } = await supabase
    .from("test_instances")
    .select("test_type, movement_name, isometric_results(*), isometric_trials(*)")
    .eq("assessment_session_id", assessmentId)
    .like("test_type", "ISO_%");
  const { data: previous } = await supabase
    .from("assessment_sessions")
    .select("id, assessment_date")
    .eq("client_id", client.id)
    .neq("id", assessmentId)
    .order("assessment_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: prevIsoRows } = previous?.id
    ? await supabase
        .from("test_instances")
        .select("test_type, isometric_results(*)")
        .eq("assessment_session_id", previous.id)
        .like("test_type", "ISO_%")
    : { data: [] as never[] };

  const { data: gripInst } = await supabase
    .from("test_instances")
    .select("test_type, movement_name, isometric_results(*), isometric_trials(*)")
    .eq("assessment_session_id", assessmentId)
    .eq("test_type", "GRIP_STRENGTH")
    .maybeSingle();
  const { data: prevGripInst } = previous?.id
    ? await supabase
        .from("test_instances")
        .select("isometric_results(*)")
        .eq("assessment_session_id", previous.id)
        .eq("test_type", "GRIP_STRENGTH")
        .maybeSingle()
    : { data: null };

  const { data: mobilityRows } = await supabase
    .from("test_instances")
    .select("test_type, movement_name, mobility_results(*), mobility_trials(*), mobility_observations(*)")
    .eq("assessment_session_id", assessmentId)
    .like("test_type", "MOBILITY_%");
  const { data: prevMobilityRows } = previous?.id
    ? await supabase
        .from("test_instances")
        .select("test_type, mobility_results(*)")
        .eq("assessment_session_id", previous.id)
        .like("test_type", "MOBILITY_%")
    : { data: [] as never[] };

  const missing: string[] = [];
  if (forceTests.length === 0) missing.push("Force Plates");
  if (!isoRows?.length) missing.push("Isometric Strength");
  if (!gripInst) missing.push("Grip Strength");
  if (!mobilityRows?.length) missing.push("Mobility");
  missing.push("Cardiorespiratory Fitness");
  missing.push("Body composition (scale)");

  const imtp = forceTests.find((t) => t.test_type === "FORCE_PLATE_IMTP") ?? forceTests[0];
  const fpResult = imtp
    ? Array.isArray(imtp.force_plate_results)
      ? imtp.force_plate_results[0]
      : imtp.force_plate_results
    : null;
  const fpTrials = (imtp?.force_plate_trials as Record<string, unknown>[] | undefined) ?? [];
  const selected =
    fpTrials.find((t) => t.id === fpResult?.selected_trial_id) ?? fpTrials.find((t) => t.is_best_trial);
  const fpInterp = fpResult
    ? interpretForcePlate({
        clientFirstName: client.first_name,
        movementName: String(imtp?.movement_name ?? "Isometric Mid-Thigh Pull"),
        peakForceKg: fpResult.peak_force_kg ?? null,
        relativePeakForce: fpResult.relative_peak_force ?? null,
        force200msKg: fpResult.force_200ms_kg ?? null,
        rfdPeakNs: fpResult.rfd_peak_ns ?? null,
        leftContribution: fpResult.left_contribution ?? null,
        rightContribution: fpResult.right_contribution ?? null,
        asymmetryPercent: fpResult.peak_force_asymmetry_percent ?? null,
        weakerSide: fpResult.weaker_side ?? null,
        referenceAvailable: false,
      })
    : null;

  const force = fpResult
    ? {
        peakForceKg: Number(fpResult.peak_force_kg) || null,
        relativePeakForce: Number(fpResult.relative_peak_force) || null,
        force200msKg: Number(fpResult.force_200ms_kg) || null,
        leftKg: selected ? Number(selected.left_peak_force_kg) : null,
        rightKg: selected ? Number(selected.right_peak_force_kg) : null,
        leftContribution: Number(fpResult.left_contribution) || null,
        rightContribution: Number(fpResult.right_contribution) || null,
        asymmetryPercent: Number(fpResult.peak_force_asymmetry_percent) || null,
        weakerSide: fpResult.weaker_side === "L" ? "Left" : fpResult.weaker_side === "R" ? "Right" : null,
        whatThisMeasures:
          "Measures maximal lower-body force, force relative to bodyweight, how quickly force appears, and how the two sides share the work.",
        interpretation: fpInterp?.summary ?? "",
        qc: `Trial quality: ${fpResult.trial_consistency_status ?? "—"}. Best valid combined peak force is the headline result.`,
        technical: [
          { label: "Peak force (device)", value: `${Number(selected?.combined_peak_force_kg ?? 0).toFixed(2)} kg` },
          { label: "Force @100 / 200 / 300 ms", value: `${selected?.combined_force_100ms_kg} / ${selected?.combined_force_200ms_kg} / ${selected?.combined_force_300ms_kg} kg` },
          { label: "RFD peak / 100 / 200 / 300", value: `${selected?.combined_rfd_peak_ns} / ${selected?.combined_rfd_100ms_ns} / ${selected?.combined_rfd_200ms_ns} / ${selected?.combined_rfd_300ms_ns} N/s` },
          { label: "Impulse peak / 100 / 200 / 300", value: `${selected?.combined_impulse_peak_ns} / ${selected?.combined_impulse_100ms_ns} / ${selected?.combined_impulse_200ms_ns} / ${selected?.combined_impulse_300ms_ns}` },
          { label: "Time to peak (stored, not headline)", value: `${selected?.combined_time_to_peak_force_ms ?? "—"} ms` },
          { label: "Mean force (stored, not headline)", value: `${selected?.combined_mean_force_kg ?? "—"} kg` },
        ],
      }
    : null;

  const isometric = (isoRows ?? []).map((inst) => {
    const row = Array.isArray(inst.isometric_results) ? inst.isometric_results[0] : inst.isometric_results;
    if (!row) return null;
    const testType = String(inst.test_type ?? "");
    const meta = isometricTest(testType);
    const trials =
      (inst.isometric_trials as {
        side: string;
        trial_number: number;
        peak_force: number;
        selected_as_best: boolean;
      }[]) ?? [];
    const trialText = trials
      .sort((a, b) => a.side.localeCompare(b.side) || a.trial_number - b.trial_number)
      .map((t) => `${t.side} T${t.trial_number} ${t.peak_force}${t.selected_as_best ? "*" : ""}`)
      .join(" · ");
    const interp = row.interpretation as { interpretation?: string; programming?: string } | null;
    return {
      testType,
      name: meta?.displayName ?? String(inst?.movement_name ?? testType),
      whatThisMeasures: meta?.whatThisMeasures ?? "",
      whyItMatters: meta?.whyItMatters ?? "",
      leftKg: row.best_left_peak_force === null ? null : Number(row.best_left_peak_force),
      rightKg: row.best_right_peak_force === null ? null : Number(row.best_right_peak_force),
      bilateralKg: row.best_bilateral_peak_force === null ? null : Number(row.best_bilateral_peak_force),
      relative: row.bilateral_relative_force === null ? null : Number(row.bilateral_relative_force),
      asymmetryPercent: row.asymmetry_percent === null ? null : Number(row.asymmetry_percent),
      weakerSide: row.weaker_side === "L" ? "Left" : row.weaker_side === "R" ? "Right" : null,
      symmetryStatus: (row.symmetry_status as SymmetryStatus) ?? "unavailable",
      strengthStatus: String(row.population_strength_status ?? "reference_pending"),
      interpretation: interp?.interpretation ?? "",
      programming: interp?.programming ?? "",
      qc: row.high_variability
        ? "High trial variability — practitioner review recommended. Mean is stored for QC, not as the headline."
        : "Trial variability acceptable. Headline is best valid peak, not the three-trial mean.",
      trials: trialText || "No trials",
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);

  const { GRIP_TEST } = await import("@/lib/grip/meta");
  const gripResult = gripInst
    ? Array.isArray(gripInst.isometric_results)
      ? gripInst.isometric_results[0]
      : gripInst.isometric_results
    : null;
  const gripTrials =
    (gripInst?.isometric_trials as {
      side: string;
      trial_number: number;
      peak_force: number;
      selected_as_best: boolean;
    }[] | undefined) ?? [];
  const grip = gripResult
    ? {
        leftKg: gripResult.best_left_peak_force == null ? null : Number(gripResult.best_left_peak_force),
        rightKg: gripResult.best_right_peak_force == null ? null : Number(gripResult.best_right_peak_force),
        asymmetryPercent: gripResult.asymmetry_percent == null ? null : Number(gripResult.asymmetry_percent),
        weakerSide: gripResult.weaker_side === "L" ? "Left" : gripResult.weaker_side === "R" ? "Right" : null,
        symmetryStatus: (gripResult.symmetry_status as SymmetryStatus) ?? "unavailable",
        whatThisMeasures: GRIP_TEST.whatThisMeasures,
        whyItMatters: GRIP_TEST.whyItMatters,
        interpretation: (gripResult.interpretation as { interpretation?: string } | null)?.interpretation ?? "",
        qc: gripResult.high_variability
          ? "High trial variability — practitioner review recommended."
          : "Headline is best valid squeeze each side, not the three-trial mean.",
        trials: gripTrials
          .sort((a, b) => a.side.localeCompare(b.side) || a.trial_number - b.trial_number)
          .map((t) => `${t.side} T${t.trial_number} ${t.peak_force}${t.selected_as_best ? "*" : ""}`)
          .join(" · "),
        relativeBest: (() => {
          const bw = Number(session.bodyweight_kg);
          if (!(bw > 0)) return null;
          return Math.max(
            Number(gripResult.best_left_peak_force ?? 0),
            Number(gripResult.best_right_peak_force ?? 0),
          ) / bw;
        })(),
        dominantHand: (client as { dominant_hand?: string }).dominant_hand ?? null,
      }
    : null;

  const { mobilityTest, formatMobilityUnit } = await import("@/lib/mobility/tests");
  const { protocolsMatch } = await import("@/lib/mobility/derive");
  const mobilityTests = (mobilityRows ?? [])
    .map((inst) => {
      const row = Array.isArray(inst.mobility_results) ? inst.mobility_results[0] : inst.mobility_results;
      const obs = Array.isArray(inst.mobility_observations)
        ? inst.mobility_observations[0]
        : inst.mobility_observations;
      const testKey = String(inst.test_type ?? "");
      const meta = mobilityTest(testKey);
      if (!row && !obs) return null;
      const interp = (row?.interpretation as {
        interpretation?: string;
        programming?: string;
        whatThisMeasures?: string;
        whyItMatters?: string;
      } | null) ?? null;
      return {
        testKey,
        name: meta?.displayName ?? String(inst.movement_name ?? testKey),
        clientLabel: meta?.clientLabel ?? String(inst.movement_name ?? testKey),
        unit: (row?.unit as string | null) ?? meta?.unit ?? null,
        whatThisMeasures: interp?.whatThisMeasures ?? meta?.whatThisMeasures ?? "",
        whyItMatters: interp?.whyItMatters ?? meta?.whyItMatters ?? "",
        left: row?.left_value == null ? null : Number(row.left_value),
        right: row?.right_value == null ? null : Number(row.right_value),
        absoluteDifference: row?.absolute_difference == null ? null : Number(row.absolute_difference),
        percentageDifference: row?.percentage_difference == null ? null : Number(row.percentage_difference),
        lowerSide: row?.lower_side === "L" ? "Left" : row?.lower_side === "R" ? "Right" : row?.lower_side === "EQUAL" ? "Equal" : null,
        symmetryStatus: (row?.symmetry_status as SymmetryStatus) ?? "unavailable",
        leftPercentile: row?.left_percentile == null ? null : Number(row.left_percentile),
        rightPercentile: row?.right_percentile == null ? null : Number(row.right_percentile),
        leftCategory: (row?.left_reference_category as string | null) ?? null,
        rightCategory: (row?.right_reference_category as string | null) ?? null,
        leftMean: row?.left_reference_mean == null ? null : Number(row.left_reference_mean),
        rightMean: row?.right_reference_mean == null ? null : Number(row.right_reference_mean),
        referenceAvailable: Boolean(row?.reference_available),
        interpretation: interp?.interpretation ?? "",
        programming: interp?.programming ?? "",
        protocol: (row?.protocol_snapshot as Record<string, unknown> | null) ?? null,
        observational: testKey === "MOBILITY_OVERHEAD_SQUAT",
        squat: obs
          ? {
              depth: String(obs.depth_achieved ?? ""),
              heels: String(obs.heel_contact ?? ""),
              shift: String(obs.left_right_weight_shift ?? ""),
              knees: String(obs.knee_tracking ?? ""),
              trunk: String(obs.trunk_control ?? ""),
              arms: String(obs.overhead_arm_position ?? ""),
              pain: String(obs.pain_reported ?? ""),
              notes: String(obs.practitioner_notes ?? ""),
            }
          : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (!force && isometric.length === 0 && !grip && mobilityTests.length === 0) {
    return { error: "Complete at least one module before generating a report." };
  }

  const findings: string[] = [];
  if (force?.asymmetryPercent != null) {
    findings.push(
      `Force-plate selected trial showed ${force.asymmetryPercent.toFixed(1)}% peak-force asymmetry${force.weakerSide ? `, with lower force on the ${force.weakerSide.toLowerCase()}` : ""}.`,
    );
  }
  for (const t of isometric.filter((x) => x.symmetryStatus === "priority" || x.symmetryStatus === "monitor")) {
    findings.push(
      `${t.name}: ${t.asymmetryPercent?.toFixed(1)}% side-to-side difference (${symmetryLabel(t.symmetryStatus)}). This is a symmetry finding, not a population-strength rating.`,
    );
  }
  if (grip?.leftKg != null && grip.rightKg != null) {
    findings.push(
      `Grip: left ${grip.leftKg.toFixed(1)} kg, right ${grip.rightKg.toFixed(1)} kg${
        grip.asymmetryPercent != null ? `, ${grip.asymmetryPercent.toFixed(1)}% side-to-side` : ""
      }.`,
    );
  }
  for (const t of mobilityTests.filter((x) => !x.observational && (x.symmetryStatus === "priority" || x.symmetryStatus === "monitor"))) {
    findings.push(t.interpretation || `${t.name}: side-to-side difference identified. This is not a diagnosis.`);
  }
  const squat = mobilityTests.find((t) => t.observational);
  if (squat?.interpretation) findings.push(squat.interpretation);
  findings.push("Population percentile ratings will only be added where validated age/sex/test-specific norms are available.");

  const priorities = [
    ...isometric.map((t) => ({ programming: t.programming, symmetryStatus: t.symmetryStatus })),
    ...mobilityTests
      .filter((t) => t.programming && t.symmetryStatus !== "balanced")
      .map((t) => ({ programming: t.programming, symmetryStatus: t.symmetryStatus })),
  ]
    .filter((t) => t.programming)
    .sort((a, b) => {
      const rank = { priority: 0, monitor: 1, balanced: 2, unavailable: 3 };
      return rank[a.symmetryStatus] - rank[b.symmetryStatus];
    })
    .slice(0, 6)
    .map((t) => t.programming);

  const prevByType = new Map(
    (prevIsoRows ?? []).map((inst) => {
      const row = Array.isArray(inst.isometric_results) ? inst.isometric_results[0] : inst.isometric_results;
      return [String(inst.test_type), row as Record<string, unknown> | null];
    }),
  );
  const changes = isometric.flatMap((curr) => {
    const before = prevByType.get(curr.testType);
    if (!before) return [];
    const lines: { label: string; from: string; to: string; change: string }[] = [];
    const pushKg = (label: string, fromRaw: unknown, to: number | null) => {
      if (to == null || fromRaw == null) return;
      const from = Number(fromRaw);
      if (!Number.isFinite(from) || from === 0) return;
      const pct = ((to - from) / from) * 100;
      lines.push({
        label,
        from: `${from.toFixed(1)} kg`,
        to: `${to.toFixed(1)} kg`,
        change: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% ${pct >= 0 ? "↑" : "↓"}`,
      });
    };
    pushKg(`${curr.name} — Left`, before.best_left_peak_force, curr.leftKg);
    pushKg(`${curr.name} — Right`, before.best_right_peak_force, curr.rightKg);
    pushKg(`${curr.name}`, before.best_bilateral_peak_force, curr.bilateralKg);
    if (curr.asymmetryPercent != null && before.asymmetry_percent != null) {
      const from = Number(before.asymmetry_percent);
      const delta = curr.asymmetryPercent - from;
      lines.push({
        label: `${curr.name} L:R asymmetry`,
        from: `${from.toFixed(1)}%`,
        to: `${curr.asymmetryPercent.toFixed(1)}%`,
        change: `${Math.abs(delta).toFixed(1)} percentage points ${delta < 0 ? "↓" : "↑"}`,
      });
    }
    return lines;
  });

  const prevGrip = prevGripInst
    ? Array.isArray(prevGripInst.isometric_results)
      ? prevGripInst.isometric_results[0]
      : prevGripInst.isometric_results
    : null;
  if (grip && prevGrip) {
    const pushGrip = (label: string, fromRaw: unknown, to: number | null) => {
      if (to == null || fromRaw == null) return;
      const from = Number(fromRaw);
      if (!Number.isFinite(from) || from === 0) return;
      const pct = ((to - from) / from) * 100;
      changes.push({
        label,
        from: `${from.toFixed(1)} kg`,
        to: `${to.toFixed(1)} kg`,
        change: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% ${pct >= 0 ? "↑" : "↓"}`,
      });
    };
    pushGrip("Grip — Left", prevGrip.best_left_peak_force, grip.leftKg);
    pushGrip("Grip — Right", prevGrip.best_right_peak_force, grip.rightKg);
  }

  const prevMobByType = new Map(
    (prevMobilityRows ?? []).map((inst) => {
      const row = Array.isArray(inst.mobility_results) ? inst.mobility_results[0] : inst.mobility_results;
      return [String(inst.test_type), row as Record<string, unknown> | null];
    }),
  );
  for (const curr of mobilityTests.filter((t) => !t.observational)) {
    const before = prevMobByType.get(curr.testKey);
    if (!before) continue;
    if (!protocolsMatch(curr.protocol, before.protocol_snapshot as Record<string, unknown> | undefined)) continue;
    const pushMob = (label: string, fromRaw: unknown, to: number | null, unit: string | null) => {
      if (to == null || fromRaw == null) return;
      const from = Number(fromRaw);
      if (!Number.isFinite(from)) return;
      const delta = to - from;
      changes.push({
        label,
        from: formatMobilityUnit(unit, from),
        to: formatMobilityUnit(unit, to),
        change: `${delta >= 0 ? "+" : ""}${unit === "deg" ? `${Math.round(delta)}°` : `${delta.toFixed(1)} ${unit ?? ""}`}`.trim(),
      });
    };
    pushMob(`${curr.clientLabel} — Left`, before.left_value, curr.left, curr.unit);
    pushMob(`${curr.clientLabel} — Right`, before.right_value, curr.right, curr.unit);
    if (curr.absoluteDifference != null && before.absolute_difference != null) {
      const from = Number(before.absolute_difference);
      const delta = curr.absoluteDifference - from;
      changes.push({
        label: `${curr.clientLabel} L:R difference`,
        from: formatMobilityUnit(curr.unit, from),
        to: formatMobilityUnit(curr.unit, curr.absoluteDifference),
        change: `${delta >= 0 ? "+" : ""}${curr.unit === "deg" ? `${Math.round(delta)}°` : `${delta.toFixed(1)} ${curr.unit}`}`,
      });
    }
  }

  const pdf = await renderCombinedReport({
    clientName: `${client.first_name} ${client.last_name}`,
    firstName: client.first_name,
    dob: client.dob,
    sex: client.sex,
    assessmentDate: session.assessment_date,
    assessmentType: session.assessment_type,
    previousDate: previous?.assessment_date ?? null,
    bodyComposition: null,
    force,
    isometric,
    grip,
    mobility: {
      tests: mobilityTests.filter((t) => !t.observational),
      squat: squat
        ? {
            interpretation: squat.interpretation,
            programming: squat.programming,
            ...squat.squat,
          }
        : null,
    },
    findings,
    priorities: priorities.length ? priorities : ["Retest after the next training block and keep loading both sides."],
    changes,
    missingModules: missing,
  });

  const fileName = `${client.last_name}_${client.first_name}_Physical_Capacity_Report_${session.assessment_date}.pdf`.replace(
    /\s+/g,
    "_",
  );
  const path = `${userId}/${client.id}/${assessmentId}/reports/${fileName}`;
  const { error: uploadError } = await supabase.storage.from("assessment-files").upload(path, pdf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) return { error: uploadError.message };

  await supabase.from("generated_reports").insert({
    practitioner_id: userId,
    client_id: client.id,
    assessment_session_id: assessmentId,
    title: fileName,
    storage_path: path,
    warnings: missing,
    report_version: 1,
    calculation_engine_version: "layer8-v1",
  });
  await supabase
    .from("assessment_sessions")
    .update({ status: "report_generated" })
    .eq("id", assessmentId);
  await supabase
    .from("force_plate_results")
    .update({ frozen_at: new Date().toISOString() })
    .eq("assessment_session_id", assessmentId);

  const { data: signed } = await supabase.storage.from("assessment-files").createSignedUrl(path, 60 * 10);
  revalidatePath(`/assessments/${assessmentId}`);
  return { ok: true, url: signed?.signedUrl, warnings: missing, fileName };
}
