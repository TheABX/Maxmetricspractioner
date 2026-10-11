import { AppShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ForcePlateImporter } from "./importer";
import { GenerateReportButton, TrialTable } from "./controls";
import { setReportStatus } from "@/app/program-actions";
import { ActionButton, StatusPill } from "@/components/action-button";
import { IsometricEntry } from "./isometric-entry";
import { GripEntry } from "./grip-entry";
import { MobilityEntry } from "./mobility-entry";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const MODULES = [
  { key: "body", label: "Body composition (scale)", match: (t: string) => t.startsWith("DEXA") || t.startsWith("BODY") },
  { key: "grip", label: "Grip Strength", match: (t: string) => t.startsWith("GRIP") },
  { key: "force", label: "Force Plates", match: (t: string) => t.startsWith("FORCE_PLATE_") && t !== "FORCE_PLATE_FREE_TRAINING" },
  { key: "iso", label: "Isometric Strength", match: (t: string) => t.startsWith("ISO_") },
  { key: "mob", label: "Mobility", match: (t: string) => t.startsWith("MOBILITY") },
  { key: "func", label: "Functional Capacity", match: (t: string) => t.startsWith("FUNCTIONAL") },
  { key: "cardio", label: "Cardiorespiratory Fitness", match: (t: string) => t.startsWith("VO2") || t.startsWith("CARDIO") },
  { key: "rec", label: "Recovery / Wearable", match: (t: string) => t.startsWith("WEARABLE") },
];

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const { data: session } = await supabase
    .from("assessment_sessions")
    .select("*, clients(*)")
    .eq("id", id)
    .single();
  if (!session) notFound();
  const client = Array.isArray(session.clients) ? session.clients[0] : session.clients;

  const { data: tests } = await supabase
    .from("test_instances")
    .select(
      "*, force_plate_trials(*), force_plate_results(*), isometric_results(*), isometric_trials(*), mobility_results(*), mobility_trials(*), mobility_observations(*)",
    )
    .eq("assessment_session_id", id)
    .order("created_at");

  const [{ data: files }, { data: reports }] = await Promise.all([
    supabase
      .from("uploaded_files")
      .select("original_name")
      .eq("assessment_session_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("generated_reports")
      .select("id, title, status, generated_at, storage_path")
      .eq("assessment_session_id", id)
      .order("generated_at", { ascending: false }),
  ]);

  const types = (tests ?? []).map((t) => String(t.test_type));
  const forceTests = (tests ?? []).filter((t) => String(t.test_type).startsWith("FORCE_PLATE_"));
  const isoTests = (tests ?? []).filter(
    (t) => String(t.test_type).startsWith("ISO_") && t.test_type !== "GRIP_STRENGTH",
  );
  const gripTests = (tests ?? []).filter((t) => String(t.test_type) === "GRIP_STRENGTH");
  const mobilityTests = (tests ?? []).filter((t) => String(t.test_type).startsWith("MOBILITY_"));

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <Link href={`/clients/${client.id}`} className="font-sans text-sm underline">
        ← {client.first_name} {client.last_name}
      </Link>
      <h1 className="mt-3 text-4xl">
        {session.assessment_type.replaceAll("_", " ")} · {session.assessment_date}
      </h1>
      <p className="mt-2 font-sans text-[var(--muted)]">
        Session bodyweight {session.bodyweight_kg} kg · height {session.height_cm} cm · {session.practitioner_name} ·{" "}
        {session.status.replaceAll("_", " ")}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map((mod) => {
          const done = types.some((t) => mod.match(t));
          return (
            <div key={mod.key} className="rounded-lg border border-[var(--line)] bg-white px-4 py-3 font-sans text-sm">
              <div className="uppercase tracking-wide text-[10px] text-[var(--muted)]">{mod.label}</div>
              <div className="mt-1">{done ? "Complete ✓" : "Not completed"}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <ForcePlateImporter assessmentId={id} />
      </div>

      {forceTests.map((force) => {
        const trials = ((force.force_plate_trials as Record<string, unknown>[] | undefined) ?? []).sort(
          (a, b) => Number(a.trial_number) - Number(b.trial_number),
        );
        const result = Array.isArray(force.force_plate_results)
          ? force.force_plate_results[0]
          : force.force_plate_results;
        return (
          <section key={String(force.id)} className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
            <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              {String(force.movement_name ?? force.test_type)}
            </h2>
            <p className="mt-2 font-sans text-sm">
              {String(files?.[0]?.original_name ?? "saved")} · QC: {String(result?.trial_consistency_status ?? "—")}
            </p>
            <p className="font-sans text-xs text-[var(--muted)]">
              Headline = best valid combined peak force. Mean / RFD intervals / impulse / time-to-peak stay technical.
            </p>
            <TrialTable
              assessmentId={id}
              testId={String(force.id)}
              movementName={(force.movement_name as string | null) ?? null}
              trials={trials as never}
            />
          </section>
        );
      })}

      <div className="mt-8">
        <GripEntry assessmentId={id} />
      </div>

      {gripTests.map((test) => {
        const result = Array.isArray(test.isometric_results) ? test.isometric_results[0] : test.isometric_results;
        const trials = (test.isometric_trials as { side: string; trial_number: number; peak_force: number; selected_as_best: boolean }[]) ?? [];
        return (
          <section key={String(test.id)} className="mt-6 rounded-xl border border-[var(--line)] bg-white p-5 font-sans text-sm">
            <h3 className="uppercase tracking-wide text-xs text-[var(--muted)]">Grip strength</h3>
            <p className="mt-2">
              Best L {result?.best_left_peak_force ?? "—"} kg · Best R {result?.best_right_peak_force ?? "—"} kg ·
              Asymmetry {result?.asymmetry_percent ?? "—"}% · {String(result?.symmetry_status ?? "")}
            </p>
            {result?.high_variability && (
              <p className="mt-1 text-[var(--accent-2)]">⚠ High trial variability — practitioner review recommended</p>
            )}
            <p className="mt-2 text-xs text-[var(--muted)]">
              {trials.map((t) => `${t.side} T${t.trial_number} ${t.peak_force}${t.selected_as_best ? "*" : ""}`).join(" · ")}
            </p>
          </section>
        );
      })}

      <div className="mt-8">
        <IsometricEntry assessmentId={id} />
      </div>

      <div className="mt-8">
        <MobilityEntry assessmentId={id} />
      </div>

      {mobilityTests.map((test) => {
        const result = Array.isArray(test.mobility_results) ? test.mobility_results[0] : test.mobility_results;
        const obs = Array.isArray(test.mobility_observations)
          ? test.mobility_observations[0]
          : test.mobility_observations;
        return (
          <section key={String(test.id)} className="mt-6 rounded-xl border border-[var(--line)] bg-white p-5 font-sans text-sm">
            <h3 className="uppercase tracking-wide text-xs text-[var(--muted)]">{String(test.movement_name)}</h3>
            {result && String(test.test_type) !== "MOBILITY_OVERHEAD_SQUAT" ? (
              <p className="mt-2">
                L {result.left_value ?? "—"} {result.unit} · R {result.right_value ?? "—"} {result.unit} · Δ{" "}
                {result.absolute_difference ?? "—"} · lower {String(result.lower_side ?? "—")} ·{" "}
                {result.reference_available ? "reference loaded" : "reference pending"}
              </p>
            ) : null}
            {obs ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Depth {obs.depth_achieved ?? "—"} · heels {obs.heel_contact ?? "—"} · shift{" "}
                {obs.left_right_weight_shift ?? "—"} · pain {obs.pain_reported ?? "—"}
              </p>
            ) : null}
          </section>
        );
      })}

      {isoTests.map((test) => {
        const result = Array.isArray(test.isometric_results) ? test.isometric_results[0] : test.isometric_results;
        const trials = (test.isometric_trials as { side: string; trial_number: number; peak_force: number; selected_as_best: boolean }[]) ?? [];
        return (
          <section key={String(test.id)} className="mt-6 rounded-xl border border-[var(--line)] bg-white p-5 font-sans text-sm">
            <h3 className="uppercase tracking-wide text-xs text-[var(--muted)]">{String(test.movement_name)}</h3>
            <p className="mt-2">
              Best L {result?.best_left_peak_force ?? "—"} · Best R {result?.best_right_peak_force ?? "—"} · Best
              bilateral {result?.best_bilateral_peak_force ?? "—"} · Asymmetry {result?.asymmetry_percent ?? "—"}% ·{" "}
              {String(result?.symmetry_status ?? "")} · strength {String(result?.population_strength_status ?? "")}
            </p>
            {result?.high_variability && (
              <p className="mt-1 text-[var(--accent-2)]">⚠ High trial variability — practitioner review recommended</p>
            )}
            <p className="mt-2 text-xs text-[var(--muted)]">
              {trials.map((t) => `${t.side} T${t.trial_number} ${t.peak_force}${t.selected_as_best ? "*" : ""}`).join(" · ")}
            </p>
          </section>
        );
      })}

      <section className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Generate report</h2>
        <p className="mt-2 font-sans text-sm text-[var(--muted)]">
          Combined PDF from stored results. Incomplete modules can still generate a partial report.
        </p>
        <div className="mt-4">
          <GenerateReportButton assessmentId={id} />
        </div>
        {(reports ?? []).length > 0 && (
          <ul className="mt-5 space-y-3 font-sans text-sm">
            {(reports ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-3">
                <StatusPill status={r.status} />
                <span>{r.title}</span>
                <span className="text-[var(--muted)]">{new Date(r.generated_at).toLocaleString("en-AU")}</span>
                <span className="ml-auto flex gap-2">
                  {r.status === "draft" && (
                    <ActionButton action={setReportStatus} fields={{ report_id: r.id, status: "approved" }} label="Approve" ghost />
                  )}
                  {r.status !== "sent" && (
                    <ActionButton
                      action={setReportStatus}
                      fields={{ report_id: r.id, status: "sent" }}
                      label="Send to client"
                      confirm="Release this report to the client portal (and email if configured)?"
                    />
                  )}
                  {r.status === "sent" && (
                    <ActionButton action={setReportStatus} fields={{ report_id: r.id, status: "draft" }} label="Withdraw" ghost />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
