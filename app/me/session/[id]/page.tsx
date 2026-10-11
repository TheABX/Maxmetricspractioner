import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientShell } from "@/components/client-shell";
import { requireClientPage } from "@/lib/auth/client-page";
import type { ExerciseRow } from "@/lib/programs/types";
import { fmtWeekday, sessionDate, sessionHeadline } from "@/lib/programs/types";
import { SessionFinish, SetLogger } from "./set-logger";

export default async function ClientSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, client } = await requireClientPage();

  const { data: session } = await supabase
    .from("program_sessions")
    .select("*, program_exercises(*), programs(id, title, weeks, start_date, days_per_week, client_id, status)")
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound();
  const program = Array.isArray(session.programs) ? session.programs[0] : session.programs;
  if (!program || program.client_id !== client.id) notFound();

  const exercises = ((session.program_exercises as ExerciseRow[]) ?? []).sort((a, b) => a.position - b.position);
  const exIds = exercises.map((e) => e.id).filter(Boolean) as string[];

  const [{ data: setLogs }, { data: log }, { data: previous }] = await Promise.all([
    exIds.length
      ? supabase.from("set_logs").select("*").eq("client_id", client.id).in("program_exercise_id", exIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("session_logs").select("*").eq("client_id", client.id).eq("program_session_id", id).maybeSingle(),
    // Last logged sets for the same exercise names, for "last time" hints.
    supabase
      .from("set_logs")
      .select("load_used, reps_done, rpe, logged_at, program_exercises!inner(exercise_name, program_session_id)")
      .eq("client_id", client.id)
      .not("program_exercise_id", "in", `(${exIds.length ? exIds.join(",") : "00000000-0000-0000-0000-000000000000"})`)
      .order("logged_at", { ascending: false })
      .limit(200),
  ]);

  const lastByName = new Map<string, string>();
  for (const row of previous ?? []) {
    const pe = Array.isArray(row.program_exercises) ? row.program_exercises[0] : row.program_exercises;
    const nm = (pe as { exercise_name?: string } | null)?.exercise_name;
    if (!nm || lastByName.has(nm)) continue;
    const bits = [
      row.reps_done != null ? `${row.reps_done} reps` : null,
      row.load_used != null ? `@ ${row.load_used}` : null,
      row.rpe != null ? `RPE ${row.rpe}` : null,
    ].filter(Boolean);
    if (bits.length) lastByName.set(nm, bits.join(" "));
  }

  return (
    <ClientShell name={`${client.first_name} ${client.last_name}`} active="program">
      <Link href="/me/program" className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)] underline">
        ← Sessions
      </Link>
      <h1 className="mt-2 text-3xl">
        {program.start_date
          ? fmtWeekday(sessionDate(program.start_date, session.week, session.day, program.days_per_week)) ||
            sessionHeadline(session) ||
            "Session"
          : sessionHeadline(session) || "Session"}
      </h1>
      {program.start_date && sessionHeadline(session) ? (
        <p className="font-sans text-sm text-[var(--muted)]">{sessionHeadline(session)}</p>
      ) : null}
      {session.focus && sessionHeadline(session) !== session.focus ? (
        <p className="font-sans text-sm text-[var(--muted)]">{session.focus}</p>
      ) : null}
      {session.notes && (
        <p className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--card)] p-3 font-sans text-sm">{session.notes}</p>
      )}
      {log?.completed_at && (
        <p className="mt-3 font-sans text-sm text-[#1f4d3a]">
          Completed {new Date(log.completed_at).toLocaleDateString("en-AU")}
          {log.overall_rpe != null ? ` · session RPE ${log.overall_rpe}` : ""}. You can still edit your numbers.
        </p>
      )}

      <div className="mt-5 grid gap-4">
        {exercises.map((e, i) => (
          <SetLogger
            key={e.id}
            index={i + 1}
            sessionId={id}
            exercise={e}
            existing={(setLogs ?? []).filter((l) => l.program_exercise_id === e.id)}
            lastTime={lastByName.get(e.exercise_name) ?? null}
          />
        ))}
        {exercises.length === 0 && (
          <p className="font-sans text-sm text-[var(--muted)]">Nothing prescribed for this day.</p>
        )}
      </div>

      <SessionFinish sessionId={id} existing={log ?? null} />
    </ClientShell>
  );
}
