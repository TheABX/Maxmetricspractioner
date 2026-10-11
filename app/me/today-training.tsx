"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui";
import {
  fmtWeekday,
  nextSessionAfter,
  sessionHeadline,
  sessionOnDate,
  type ExerciseRow,
  type SessionRow,
} from "@/lib/programs/types";

type ProgramBits = {
  start_date: string | null;
  days_per_week: number;
  client_message: string | null;
};

export function ClientTodayTraining({
  program,
  sessions,
}: {
  program: ProgramBits;
  sessions: SessionRow[];
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  if (!now) {
    return <div className="mt-4 h-28 rounded-xl border border-[var(--line)] bg-[var(--card)]" />;
  }

  if (!program.start_date) {
    return (
      <>
        <h1 className="mt-2 text-3xl">{fmtWeekday(now)}</h1>
        {program.client_message ? (
          <p className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--card)] p-4 font-sans text-sm">{program.client_message}</p>
        ) : null}
        <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="text-xl">No planned sessions today</h2>
          <p className="mt-1 font-sans text-sm text-[var(--muted)]">Dates will appear here once your start day is set.</p>
        </div>
      </>
    );
  }

  const today = sessionOnDate(sessions, program, now);
  const upcoming = today ? null : nextSessionAfter(sessions, program, now);

  return (
    <>
      <h1 className="mt-2 text-3xl">{fmtWeekday(now)}</h1>
      {program.client_message ? (
        <p className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--card)] p-4 font-sans text-sm">{program.client_message}</p>
      ) : null}

      {today ? (
        <SessionCard session={today.session} />
      ) : (
        <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="text-xl">No planned sessions today</h2>
          {upcoming?.date ? (
            <p className="mt-1 font-sans text-sm text-[var(--muted)]">Next is {fmtWeekday(upcoming.date)}.</p>
          ) : null}
        </div>
      )}
    </>
  );
}

function SessionCard({ session }: { session: SessionRow }) {
  const headline = sessionHeadline(session);
  const exercises = ((session.program_exercises as ExerciseRow[]) ?? []).slice().sort((a, b) => a.position - b.position);
  return (
    <div className="mt-5 rounded-xl border border-[var(--accent)] bg-[var(--card)] p-5">
      <h2 className="text-2xl">{headline || "Today’s session"}</h2>
      {session.focus && headline !== session.focus ? (
        <p className="font-sans text-sm text-[var(--muted)]">{session.focus}</p>
      ) : null}
      <ul className="mt-3 space-y-1 font-sans text-sm">
        {exercises.map((e) => (
          <li key={e.id}>
            {e.exercise_name} — {e.sets} × {e.reps}
            {e.load_prescription ? ` @ ${e.load_prescription}` : ""}
            {e.side === "each" ? " each side" : ""}
          </li>
        ))}
        {exercises.length === 0 ? <li className="text-[var(--muted)]">Nothing prescribed for this session.</li> : null}
      </ul>
      <Link href={`/me/session/${session.id}`} className={`${buttonClass} mt-4`}>
        Start session
      </Link>
    </div>
  );
}
