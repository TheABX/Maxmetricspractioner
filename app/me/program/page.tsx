import Link from "next/link";
import { ClientShell } from "@/components/client-shell";
import { currentProgram, requireClientPage } from "@/lib/auth/client-page";
import {
  fmtWeekday,
  localYmd,
  sessionHeadline,
  withSessionDates,
  type ExerciseRow,
  type SessionRow,
} from "@/lib/programs/types";

export default async function ClientProgramPage() {
  const { supabase, client } = await requireClientPage();
  const program = await currentProgram(supabase, client.id);

  if (!program) {
    return (
      <ClientShell name={`${client.first_name} ${client.last_name}`} active="program">
        <h1 className="text-3xl">No sessions yet</h1>
        <p className="mt-2 font-sans text-sm text-[var(--muted)]">They will appear here once your practitioner sends them.</p>
      </ClientShell>
    );
  }

  const [{ data: s }, { data: l }] = await Promise.all([
    supabase.from("program_sessions").select("*, program_exercises(*)").eq("program_id", program.id).order("week").order("day"),
    supabase.from("session_logs").select("program_session_id, completed_at, skipped").eq("client_id", client.id),
  ]);
  const sessions = (s ?? []) as SessionRow[];
  const logMap = new Map((l ?? []).map((x) => [x.program_session_id, x]));
  const dated = withSessionDates(sessions, program);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const upcoming = dated.filter((x) => !x.date || localYmd(x.date) >= today);
  const earlier = dated.filter((x) => x.date && localYmd(x.date) < today);

  return (
    <ClientShell name={`${client.first_name} ${client.last_name}`} active="program">
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Train</p>
      <h1 className="text-3xl">Sessions</h1>

      <div className="mt-4 grid gap-3">
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <h2 className="text-lg">No upcoming sessions</h2>
          </div>
        ) : (
          upcoming.map(({ session, date }) => (
            <SessionLink key={session.id} session={session} date={date} log={logMap.get(session.id)} />
          ))
        )}
      </div>

      {earlier.length > 0 ? (
        <>
          <h3 className="mt-8 font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Earlier</h3>
          <div className="mt-2 grid gap-3">
            {earlier.map(({ session, date }) => (
              <SessionLink key={session.id} session={session} date={date} log={logMap.get(session.id)} />
            ))}
          </div>
        </>
      ) : null}
    </ClientShell>
  );
}

function SessionLink({
  session,
  date,
  log,
}: {
  session: SessionRow;
  date: Date | null;
  log?: { completed_at: string | null; skipped: boolean };
}) {
  const headline = sessionHeadline(session);
  return (
    <Link href={`/me/session/${session.id}`} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">{date ? fmtWeekday(date) : headline || "Session"}</h2>
        <span className="font-sans text-xs text-[var(--muted)]">
          {log?.completed_at ? "Done" : log?.skipped ? "Skipped" : log ? "In progress" : ""}
        </span>
      </div>
      {date && headline ? <p className="mt-0.5 font-sans text-sm">{headline}</p> : null}
      <ul className="mt-2 space-y-0.5 font-sans text-sm">
        {((session.program_exercises as ExerciseRow[]) ?? [])
          .sort((a, b) => a.position - b.position)
          .map((e) => (
            <li key={e.id}>
              {e.exercise_name} — {e.sets} × {e.reps}
              {e.load_prescription ? ` @ ${e.load_prescription}` : ""}
              {e.rpe_target != null ? ` · RPE ${e.rpe_target}` : ""}
              {e.side === "each" ? " · each side" : e.side !== "both" ? ` · ${e.side} only` : ""}
            </li>
          ))}
        {(session.program_exercises?.length ?? 0) === 0 && <li className="text-[var(--muted)]">Nothing prescribed</li>}
      </ul>
    </Link>
  );
}
