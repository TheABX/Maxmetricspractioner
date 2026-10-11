import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { copyWeek, copyWeekToAll, setProgramStatus, updateProgramMeta } from "@/app/program-actions";
import { ActionButton, StatusPill } from "@/components/action-button";
import { ProfileChips, QuestionnaireSummary } from "@/components/questionnaire-summary";
import { AppShell, Field, ghostButtonClass, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL, type ExerciseRow, type ProgramRow, type SessionRow } from "@/lib/programs/types";
import { ProgramEditor } from "./program-editor";
import { AssessmentSnapshot } from "./assessment-snapshot";
import { ProgrammingSummary } from "@/components/programming-summary";
import { PriorityBoard } from "@/components/priority-board";
import { StructureBoard } from "@/components/structure-board";
import { loadProgrammingProfile } from "@/lib/programming-profile/load";
import { loadProgramStructure } from "@/lib/structure-engine/load";
import { ensureCatalog, loadFamilies } from "@/lib/exercise-kb/load";
import { loadProgramAdaptation } from "@/lib/adaptation-engine/load";
import { SelectionBoard } from "@/components/selection-board";
import { DosageBoard } from "@/components/dosage-board";
import { AdaptationBoard } from "@/components/adaptation-board";

export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id } = await params;
  const { week: weekParam } = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const { data: program } = await supabase
    .from("programs")
    .select("*, clients(id, first_name, last_name, email, auth_user_id)")
    .eq("id", id)
    .single();
  if (!program) notFound();
  const client = Array.isArray(program.clients) ? program.clients[0] : program.clients;

  const [{ data: sessions }, library, families, { data: response }, { data: logs }, { data: setLogs }, profile, structure, adaptation] =
    await Promise.all([
      supabase
        .from("program_sessions")
        .select("*, program_exercises(*)")
        .eq("program_id", id)
        .order("week")
        .order("day"),
      ensureCatalog(supabase),
      loadFamilies(supabase),
      program.questionnaire_response_id
        ? supabase.from("questionnaire_responses").select("*").eq("id", program.questionnaire_response_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("session_logs")
        .select("program_session_id, completed_at, skipped, overall_rpe, notes")
        .eq("client_id", program.client_id),
      supabase
        .from("set_logs")
        .select("program_exercise_id, set_number, side, reps_done, load_used, rpe, pain_0_10, notes")
        .eq("client_id", program.client_id),
      loadProgrammingProfile(supabase, program.client_id),
      loadProgramStructure(supabase, program.client_id),
      loadProgramAdaptation(supabase, program.client_id),
    ]);
  const dosage = adaptation.dosage;
  const selection = dosage.selection;

  const p = program as unknown as ProgramRow;
  const allSessions = (sessions ?? []).map((s) => ({
    ...s,
    program_exercises: ((s.program_exercises as ExerciseRow[]) ?? []).sort((a, b) => a.position - b.position),
  })) as SessionRow[];
  const week = Math.min(Math.max(1, Number(weekParam ?? 1) || 1), p.weeks);
  const weekSessions = allSessions.filter((s) => s.week === week);
  const logBySession = new Map((logs ?? []).map((l) => [l.program_session_id, l]));
  const exerciseIds = new Set(weekSessions.flatMap((s) => (s.program_exercises ?? []).map((e) => e.id)));
  const weekSetLogs = (setLogs ?? []).filter((l) => exerciseIds.has(l.program_exercise_id));

  const completed = (logs ?? []).filter((l) => l.completed_at).length;
  const skipped = (logs ?? []).filter((l) => l.skipped).length;
  const locked = p.status !== "draft";

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link className="underline" href={`/clients/${client?.id}`}>
              {client?.first_name} {client?.last_name}
            </Link>{" "}
            · Program v{p.version}
          </p>
          <h1 className="mt-2 text-4xl">{p.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 font-sans text-sm text-[var(--muted)]">
            <StatusPill status={p.status} /> {STATUS_LABEL[p.status]} · {p.weeks} weeks × {p.days_per_week} days
            {p.start_date ? ` · starts ${p.start_date}` : ""}
            {completed + skipped > 0 ? ` · ${completed} sessions logged, ${skipped} skipped` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.status === "draft" && (
            <ActionButton action={setProgramStatus} fields={{ program_id: p.id, status: "approved" }} label="Approve" ghost />
          )}
          {(p.status === "draft" || p.status === "approved") && (
            <ActionButton
              action={setProgramStatus}
              fields={{ program_id: p.id, status: "sent" }}
              label="Send to client"
              pendingLabel="Sending…"
              confirm={`Send "${p.title}" to ${client?.first_name}? This makes the program and report visible in their portal and emails them if email is configured.`}
            />
          )}
          {p.status !== "draft" && p.status !== "archived" && (
            <ActionButton
              action={setProgramStatus}
              fields={{ program_id: p.id, status: "draft" }}
              label="Back to draft"
              ghost
              confirm="Return to draft? The client will no longer see this program until you send it again."
            />
          )}
          {(p.status === "sent" || p.status === "active") && (
            <ActionButton action={setProgramStatus} fields={{ program_id: p.id, status: "completed" }} label="Mark completed" ghost />
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <form action={updateProgramMeta} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="program_id" value={p.id} />
            <Field label="Title">
              <input className={inputClass} name="title" defaultValue={p.title} />
            </Field>
            <Field label="Start date">
              <input className={inputClass} type="date" name="start_date" defaultValue={p.start_date ?? ""} />
            </Field>
            <Field label="Practitioner notes (private)">
              <textarea className={inputClass} name="practitioner_notes" rows={3} defaultValue={p.practitioner_notes ?? ""} />
            </Field>
            <Field label="Message to client (shown in portal and email)">
              <textarea className={inputClass} name="client_message" rows={3} defaultValue={p.client_message ?? ""} />
            </Field>
            <div>
              <button className={ghostButtonClass}>Save details</button>
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Inputs</h2>
          <div className="mt-3 rounded-lg border border-[var(--line)] bg-white p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                Programming profile{profile.seeded ? " · unsaved (seeded from intake)" : profile.row?.confirmed_at ? " · confirmed" : " · not confirmed"}
              </p>
              <Link className="font-sans text-xs underline" href={`/clients/${program.client_id}/profile`}>
                {profile.seeded ? "Create" : "Edit"}
              </Link>
            </div>
            <div className="mt-2">
              <ProgrammingSummary summary={profile.summary} compact />
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-[var(--line)] bg-white p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Priorities</p>
              <Link className="font-sans text-xs underline" href={`/clients/${program.client_id}/priorities`}>
                Edit
              </Link>
            </div>
            <div className="mt-2">
              <PriorityBoard priorities={structure.priorities.result.priorities} compact />
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-[var(--line)] bg-white p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Weekly structure</p>
              <Link className="font-sans text-xs underline" href={`/clients/${program.client_id}/structure`}>
                Edit
              </Link>
            </div>
            <div className="mt-2">
              <StructureBoard structure={structure.effective} compact />
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-[var(--line)] bg-white p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Exercise selection</p>
              <Link className="font-sans text-xs underline" href={`/clients/${program.client_id}/selection`}>
                Edit
              </Link>
            </div>
            <div className="mt-2">
              <SelectionBoard sessions={selection.effective.sessions} compact />
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-[var(--line)] bg-white p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Prescription &amp; dosage</p>
              <Link className="font-sans text-xs underline" href={`/clients/${program.client_id}/dosage`}>
                Edit
              </Link>
            </div>
            <div className="mt-2">
              <DosageBoard result={dosage.effective} compact />
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-[var(--line)] bg-white p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Progression &amp; adaptation</p>
              <Link className="font-sans text-xs underline" href={`/clients/${program.client_id}/adaptation`}>
                Edit
              </Link>
            </div>
            <div className="mt-2">
              <AdaptationBoard result={adaptation.effective} compact />
            </div>
          </div>
          {p.assessment_session_id ? (
            <AssessmentSnapshot sessionId={p.assessment_session_id} />
          ) : (
            <p className="mt-2 font-sans text-sm text-[var(--muted)]">No assessment linked.</p>
          )}
          {response ? (
            <>
              <div className="mt-4">
                <ProfileChips answers={(response.answers as Record<string, unknown>) ?? {}} />
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer font-sans text-sm underline">
                  All questionnaire answers{response.load_bucket ? ` · ${String(response.load_bucket).replaceAll("_", " ")}` : ""}
                </summary>
                <div className="mt-3">
                  <QuestionnaireSummary answers={(response.answers as Record<string, unknown>) ?? {}} compact />
                </div>
              </details>
            </>
          ) : (
            <p className="mt-3 font-sans text-sm text-[var(--muted)]">No questionnaire linked.</p>
          )}
        </div>
      </div>

      {/* Week strip */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        {Array.from({ length: p.weeks }, (_, i) => i + 1).map((w) => {
          const ws = allSessions.filter((s) => s.week === w);
          const filled = ws.filter((s) => (s.program_exercises?.length ?? 0) > 0).length;
          return (
            <Link
              key={w}
              href={`/programs/${p.id}?week=${w}`}
              className={`rounded-md border px-3 py-1.5 font-sans text-sm ${
                w === week
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--ink)]"
              }`}
            >
              Wk {w}
              <span className={`ml-1 text-[11px] ${w === week ? "text-white/70" : "text-[var(--muted)]"}`}>
                {filled}/{ws.length}
              </span>
            </Link>
          );
        })}
        {!locked && (
          <div className="ml-auto flex flex-wrap gap-2">
            <form action={copyWeek} className="flex items-center gap-2 font-sans text-sm">
              <input type="hidden" name="program_id" value={p.id} />
              <input type="hidden" name="from_week" value={week} />
              <span className="text-[var(--muted)]">Copy week {week} to</span>
              <select name="to_week" className={`${inputClass} w-auto py-1`} defaultValue={Math.min(week + 1, p.weeks)}>
                {Array.from({ length: p.weeks }, (_, i) => i + 1)
                  .filter((w) => w !== week)
                  .map((w) => (
                    <option key={w} value={w}>
                      week {w}
                    </option>
                  ))}
              </select>
              <button className={ghostButtonClass}>Copy</button>
            </form>
            <form action={copyWeekToAll}>
              <input type="hidden" name="program_id" value={p.id} />
              <input type="hidden" name="from_week" value={week} />
              <button className={ghostButtonClass}>Copy to all weeks</button>
            </form>
          </div>
        )}
      </div>

      {locked && (
        <p className="mt-3 font-sans text-sm text-[var(--muted)]">
          This program is {p.status}. Return it to draft to edit, or create a new version from the client page.
        </p>
      )}

      <div className="mt-4 grid gap-4">
        {weekSessions.map((s) => (
          <ProgramEditor
            key={s.id}
            programId={p.id}
            session={s}
            library={library}
            families={families}
            locked={locked}
            log={logBySession.get(s.id) ?? null}
            setLogs={weekSetLogs.filter((l) => (s.program_exercises ?? []).some((e) => e.id === l.program_exercise_id))}
          />
        ))}
      </div>
    </AppShell>
  );
}
