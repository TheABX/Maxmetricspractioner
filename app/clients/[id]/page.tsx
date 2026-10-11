import { createAssessment } from "@/app/actions";
import { createProgram, setReportStatus } from "@/app/program-actions";
import { ActionButton, StatusPill } from "@/components/action-button";
import { InviteForm } from "./invite-form";
import { RequestQuestionnaire } from "./request-questionnaire";
import { ProfileChips, QuestionnaireSummary } from "@/components/questionnaire-summary";
import { AppShell, buttonClass, Field, ghostButtonClass, inputClass } from "@/components/ui";
import { ProgrammingSummary } from "@/components/programming-summary";
import { PriorityBoard } from "@/components/priority-board";
import { StructureBoard } from "@/components/structure-board";
import { SelectionBoard } from "@/components/selection-board";
import { DosageBoard } from "@/components/dosage-board";
import { AdaptationBoard } from "@/components/adaptation-board";
import { loadProgrammingProfile } from "@/lib/programming-profile/load";
import { loadProgramAdaptation } from "@/lib/adaptation-engine/load";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

function ageYears(dob: string) {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

const MODULES: { name: string; match: (t: string) => boolean }[] = [
  { name: "Body composition (scale)", match: (t) => t.startsWith("BODY") || t.startsWith("DEXA") },
  { name: "Grip Strength", match: (t) => t.startsWith("GRIP") },
  { name: "Force Plates", match: (t) => t.startsWith("FORCE_PLATE_") && t !== "FORCE_PLATE_FREE_TRAINING" },
  { name: "Isometric Strength", match: (t) => t.startsWith("ISO_") },
  { name: "Mobility & Movement", match: (t) => t.startsWith("MOBILITY_") },
  { name: "Cardiorespiratory Fitness", match: (t) => t.startsWith("VO2") || t.startsWith("CARDIO") },
];

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).single();
  if (!client) notFound();
  const [{ data: sessions }, { data: responses }, { data: programs }, { data: reports }, profile, adaptation] = await Promise.all([
    supabase
      .from("assessment_sessions")
      .select("*, test_instances(test_type, status)")
      .eq("client_id", id)
      .order("assessment_date", { ascending: false }),
    supabase
      .from("questionnaire_responses")
      .select("*")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("programs")
      .select("id, title, version, status, weeks, days_per_week, start_date, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("generated_reports")
      .select("id, title, status, generated_at, assessment_session_id")
      .eq("client_id", id)
      .order("generated_at", { ascending: false }),
    loadProgrammingProfile(supabase, id),
    loadProgramAdaptation(supabase, id),
  ]);
  const dosage = adaptation.dosage;
  const selection = dosage.selection;
  const priorities = selection.structure.priorities;
  const structure = selection.structure;

  const current = sessions?.[0];
  const latestResponse = responses?.[0];

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Client record</p>
      <h1 className="mt-2 text-4xl">
        {client.first_name} {client.last_name}
      </h1>
      <p className="mt-2 font-sans text-[var(--muted)]">
        Age {ageYears(client.dob)} · {client.sex} · {client.height_cm} cm · profile weight {client.bodyweight_kg} kg
      </p>
      {current && (
        <p className="mt-1 font-sans text-sm">
          Current assessment: {current.assessment_type.replaceAll("_", " ")} — {current.assessment_date}
        </p>
      )}

      {/* Portal + questionnaire */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Client portal</h2>
          <p className="mt-2 font-sans text-sm">
            {client.auth_user_id
              ? `Activated${client.portal_activated_at ? ` · ${new Date(client.portal_activated_at).toLocaleDateString("en-AU")}` : ""}`
              : client.invited_at
                ? `Invited ${new Date(client.invited_at).toLocaleDateString("en-AU")} · not yet activated`
                : "Not invited yet"}
          </p>
          <InviteForm clientId={client.id} email={client.email ?? ""} invited={Boolean(client.invited_at)} />
          <p className="mt-2 font-sans text-xs text-[var(--muted)]">
            The client creates a login at <code>/join</code> with this email. Drafts stay hidden until you approve and send.
          </p>
        </div>

        <div id="intake" className="scroll-mt-6 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Intake questionnaire</h2>
          {latestResponse ? (
            <>
              <p className="mt-2 font-sans text-sm">
                Submitted{" "}
                {latestResponse.submitted_at
                  ? new Date(latestResponse.submitted_at).toLocaleDateString("en-AU")
                  : "— in progress"}{" "}
                · v{latestResponse.questionnaire_version}
                {latestResponse.load_bucket ? (
                  <>
                    {" · "}
                    <span className="rounded-full bg-[#e6eef9] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[#1f3f6e]">
                      {String(latestResponse.load_bucket).replaceAll("_", " ")}
                    </span>
                  </>
                ) : null}
              </p>
              <div className="mt-3">
                <ProfileChips answers={(latestResponse.answers as Record<string, unknown>) ?? {}} />
              </div>
              {latestResponse.submitted_at && (
                <p className="mt-3">
                  <Link className={ghostButtonClass} href={`/clients/${client.id}/intake`}>
                    Review questionnaire
                  </Link>
                </p>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer font-sans text-sm underline">View all answers</summary>
                <div className="mt-3">
                  <QuestionnaireSummary answers={(latestResponse.answers as Record<string, unknown>) ?? {}} compact />
                </div>
              </details>
              {latestResponse.submitted_at ? (
                <RequestQuestionnaire clientId={client.id} />
              ) : (
                <p className="mt-3 font-sans text-xs text-[var(--muted)]">Waiting for the client to submit. It is in their portal now.</p>
              )}
            </>
          ) : (
            <p className="mt-2 font-sans text-sm text-[var(--muted)]">
              Not completed. It appears in their portal after they activate — only then, or if you request an update later.
            </p>
          )}
        </div>
      </div>

      {/* Programming profile */}
      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Programming profile</h2>
            <p className="mt-1 font-sans text-xs text-[var(--muted)]">
              {profile.seeded
                ? latestResponse
                  ? "Not saved yet — preview below is seeded from the intake questionnaire."
                  : "Not created yet. Create it manually or wait for the intake questionnaire."
                : profile.row?.confirmed_at
                  ? `Confirmed ${new Date(profile.row.confirmed_at).toLocaleDateString("en-AU")}${profile.effective.overridden.length ? ` · ${profile.effective.overridden.length} override(s)` : ""}`
                  : `Saved ${new Date(profile.row!.updated_at).toLocaleDateString("en-AU")} · not yet confirmed`}
            </p>
          </div>
          <Link className={ghostButtonClass} href={`/clients/${id}/profile`}>
            {profile.seeded ? "Create profile" : "Edit profile"}
          </Link>
        </div>
        <div className="mt-4">
          <ProgrammingSummary summary={profile.summary} />
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Programming priorities</h2>
            <Link className={ghostButtonClass} href={`/clients/${id}/priorities`}>
              {priorities.seeded ? "Review" : "Edit"}
            </Link>
          </div>
          <div className="mt-3">
            <PriorityBoard priorities={priorities.result.priorities} compact hideIrrelevant />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Program structure</h2>
            <Link className={ghostButtonClass} href={`/clients/${id}/structure`}>
              {structure.seeded ? "Review" : "Edit"}
            </Link>
          </div>
          <div className="mt-3">
            <StructureBoard structure={structure.effective} compact />
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Exercise selection</h2>
          <Link className={ghostButtonClass} href={`/clients/${id}/selection`}>
            {selection.seeded ? "Review" : "Edit"}
          </Link>
        </div>
        <div className="mt-3">
          <SelectionBoard sessions={selection.effective.sessions} compact />
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Prescription &amp; dosage</h2>
          <Link className={ghostButtonClass} href={`/clients/${id}/dosage`}>
            {dosage.seeded ? "Review" : "Edit"}
          </Link>
        </div>
        <div className="mt-3">
          <DosageBoard result={dosage.effective} compact />
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Progression &amp; adaptation</h2>
          <Link className={ghostButtonClass} href={`/clients/${id}/adaptation`}>
            {adaptation.seeded ? "Review" : "Edit"}
          </Link>
        </div>
        <div className="mt-3">
          <AdaptationBoard result={adaptation.effective} compact />
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Nutrition</h2>
          <Link className={ghostButtonClass} href={`/clients/${id}/nutrition`}>
            Open nutrition
          </Link>
        </div>
        <p className="mt-3 font-sans text-sm text-[var(--muted)]">
          Energy target and meal plan/log from the nutrition questions on intake. Plan and log stay separate.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Communication</h2>
          <Link className={ghostButtonClass} href={`/clients/${id}/messages`}>
            Open inbox
          </Link>
        </div>
        <p className="mt-3 font-sans text-sm text-[var(--muted)]">
          Layer 7 drafts from logged training. Routine encouragement may send itself. Pain and red cases stay with you.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Retest &amp; next block</h2>
          <Link className={ghostButtonClass} href={`/clients/${id}/retest`}>
            Open review
          </Link>
        </div>
        <p className="mt-3 font-sans text-sm text-[var(--muted)]">
          Compare assessments, classify meaningful change, and send updated priorities back through Layers 2–6. Do not copy the previous program.
        </p>
      </div>

      {/* Assessments */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">New assessment</h2>
          <form action={createAssessment} className="mt-4 grid gap-3">
            <input type="hidden" name="client_id" value={client.id} />
            <Field label="Type">
              <select className={inputClass} name="assessment_type" defaultValue="baseline">
                <option value="baseline">Baseline</option>
                <option value="twelve_week_retest">12-week retest</option>
                <option value="follow_up">Follow-up</option>
                <option value="partial">Partial assessment</option>
              </select>
            </Field>
            <Field label="Date">
              <input
                className={inputClass}
                type="date"
                name="assessment_date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Session bodyweight (kg)">
                <input className={inputClass} type="number" step="0.1" name="bodyweight_kg" defaultValue={client.bodyweight_kg} required />
              </Field>
              <Field label="Session height (cm)">
                <input className={inputClass} type="number" step="0.1" name="height_cm" defaultValue={client.height_cm} required />
              </Field>
            </div>
            <Field label="Practitioner">
              <input className={inputClass} name="practitioner_name" defaultValue="Deon Kenzie" />
            </Field>
            <button className={buttonClass}>Create session</button>
          </form>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Assessments</h2>
          <ul className="mt-4 space-y-3 font-sans text-sm">
            {(sessions ?? []).length === 0 && <li>No sessions yet.</li>}
            {(sessions ?? []).map((s) => (
              <li key={s.id}>
                <Link className="underline" href={`/assessments/${s.id}`}>
                  {s.assessment_date} — {s.assessment_type.replaceAll("_", " ")}
                </Link>
                <div className="text-[var(--muted)]">
                  {s.status.replaceAll("_", " ")} · {s.bodyweight_kg} kg
                </div>
              </li>
            ))}
          </ul>
          {current && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {MODULES.map((m) => {
                const types =
                  (current.test_instances as { test_type: string }[] | undefined)?.map((t) => t.test_type) ?? [];
                const done = types.some(m.match);
                return (
                  <div key={m.name} className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 font-sans text-xs">
                    {done ? "✓ " : "○ "}
                    {m.name}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Reports */}
      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Reports</h2>
        <p className="mt-2 font-sans text-sm text-[var(--muted)]">
          Reports stay private until approved and sent. Sending a program also releases the report from the same
          session.
        </p>
        <ul className="mt-3 space-y-3 font-sans text-sm">
          {(reports ?? []).length === 0 && <li>No reports generated yet.</li>}
          {(reports ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-3">
              <StatusPill status={r.status} />
              <Link className="underline" href={`/assessments/${r.assessment_session_id}`}>
                {r.title}
              </Link>
              <span className="text-[var(--muted)]">{new Date(r.generated_at).toLocaleDateString("en-AU")}</span>
              <span className="ml-auto flex gap-2">
                {r.status === "draft" && (
                  <ActionButton action={setReportStatus} fields={{ report_id: r.id, status: "approved" }} label="Approve" ghost />
                )}
                {r.status !== "sent" && (
                  <ActionButton
                    action={setReportStatus}
                    fields={{ report_id: r.id, status: "sent" }}
                    label="Send to client"
                    confirm="Send this report to the client portal (and email if configured)?"
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Programs */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">New program</h2>
          <form action={createProgram} className="mt-4 grid gap-3">
            <input type="hidden" name="client_id" value={client.id} />
            <Field label="Title">
              <input className={inputClass} name="title" defaultValue="12-week program" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Weeks">
                <input className={inputClass} type="number" name="weeks" min={1} max={52} defaultValue={12} />
              </Field>
              <Field label="Days per week">
                <input
                  className={inputClass}
                  type="number"
                  name="days_per_week"
                  min={1}
                  max={7}
                  defaultValue={Number((latestResponse?.answers as { days_per_week?: string } | null)?.days_per_week ?? 3)}
                />
              </Field>
            </div>
            <Field label="Start date">
              <input className={inputClass} type="date" name="start_date" />
            </Field>
            <Field label="Built from assessment">
              <select className={inputClass} name="assessment_session_id" defaultValue={current?.id ?? ""}>
                <option value="">— none —</option>
                {(sessions ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.assessment_date} · {s.assessment_type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Questionnaire response">
              <select className={inputClass} name="questionnaire_response_id" defaultValue={latestResponse?.id ?? ""}>
                <option value="">— none —</option>
                {(responses ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-AU") : "in progress"} · v
                    {r.questionnaire_version}
                  </option>
                ))}
              </select>
            </Field>
            <button className={buttonClass}>Create draft program</button>
          </form>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Programs</h2>
          <ul className="mt-4 space-y-3 font-sans text-sm">
            {(programs ?? []).length === 0 && <li>No programs yet.</li>}
            {(programs ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <StatusPill status={p.status} />
                <Link className="underline" href={`/programs/${p.id}`}>
                  {p.title} · v{p.version}
                </Link>
                <span className="text-[var(--muted)]">
                  {p.weeks} wk × {p.days_per_week}/wk{p.start_date ? ` · from ${p.start_date}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
