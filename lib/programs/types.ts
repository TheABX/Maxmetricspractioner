export type ProgramStatus = "draft" | "approved" | "sent" | "active" | "completed" | "archived";

export type ExerciseRow = {
  id?: string;
  position: number;
  exercise_id: string | null;
  exercise_name: string;
  side: "both" | "left" | "right" | "each";
  sets: number;
  reps: string;
  load_prescription: string | null;
  rpe_target: number | null;
  tempo: string | null;
  rest_seconds: number | null;
  notes: string | null;
};

export type SessionRow = {
  id: string;
  program_id: string;
  week: number;
  day: number;
  title: string;
  focus: string | null;
  notes: string | null;
  program_exercises?: ExerciseRow[];
};

export type ProgramRow = {
  id: string;
  client_id: string;
  assessment_session_id: string | null;
  questionnaire_response_id: string | null;
  parent_program_id: string | null;
  version: number;
  title: string;
  status: ProgramStatus;
  start_date: string | null;
  weeks: number;
  days_per_week: number;
  rationale: Record<string, unknown>;
  practitioner_notes: string | null;
  client_message: string | null;
  approved_at: string | null;
  sent_at: string | null;
};

export const STATUS_LABEL: Record<ProgramStatus, string> = {
  draft: "Draft — only you can see this",
  approved: "Approved — not yet sent",
  sent: "Sent to client",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

export function clientVisible(status: ProgramStatus) {
  return status === "sent" || status === "active" || status === "completed";
}

function parseLocalDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date for week/day given a program start date (day 1 = start_date weekday). */
export function sessionDate(startDate: string | null, week: number, day: number, daysPerWeek: number) {
  if (!startDate) return null;
  const d = parseLocalDate(startDate);
  if (!d) return null;
  // Spread days across the week: 3/week → Mon/Wed/Fri style spacing.
  const spacing = Math.max(1, Math.floor(7 / daysPerWeek));
  d.setDate(d.getDate() + (week - 1) * 7 + (day - 1) * spacing);
  return d;
}

export function localYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function sameCalendarDay(a: Date, b: Date) {
  return localYmd(a) === localYmd(b);
}

export function ordinalDay(n: number) {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** Thursday 16th */
export function fmtWeekday(d: Date | null) {
  if (!d) return "";
  const weekday = d.toLocaleDateString("en-AU", { weekday: "long" });
  return `${weekday} ${ordinalDay(d.getDate())}`;
}

export function fmtDate(d: Date | null) {
  if (!d) return "";
  return fmtWeekday(d);
}

export function isoDate(d: Date) {
  return localYmd(d);
}

export function sessionHeadline(session: Pick<SessionRow, "title" | "focus">) {
  const title = (session.title ?? "").trim();
  if (title && !/^day\s*\d+$/i.test(title)) return title;
  return (session.focus ?? "").trim();
}

export type DatedSession<T extends Pick<SessionRow, "week" | "day"> = SessionRow> = { session: T; date: Date | null };

export function withSessionDates<T extends Pick<SessionRow, "week" | "day">>(
  sessions: T[],
  program: { start_date: string | null; days_per_week: number },
): DatedSession<T>[] {
  return sessions
    .map((session) => ({
      session,
      date: sessionDate(program.start_date, session.week, session.day, program.days_per_week),
    }))
    .sort((a, b) => {
      if (a.date && b.date) return a.date.getTime() - b.date.getTime();
      if (a.date) return -1;
      if (b.date) return 1;
      return a.session.week - b.session.week || a.session.day - b.session.day;
    });
}

export function sessionOnDate<T extends Pick<SessionRow, "week" | "day">>(
  sessions: T[],
  program: { start_date: string | null; days_per_week: number },
  date: Date,
) {
  return withSessionDates(sessions, program).find((x) => x.date && sameCalendarDay(x.date, date)) ?? null;
}

export function nextSessionAfter<T extends Pick<SessionRow, "week" | "day">>(
  sessions: T[],
  program: { start_date: string | null; days_per_week: number },
  date: Date,
) {
  const today = localYmd(date);
  return (
    withSessionDates(sessions, program).find((x) => {
      if (!x.date) return false;
      return localYmd(x.date) > today;
    }) ?? null
  );
}
