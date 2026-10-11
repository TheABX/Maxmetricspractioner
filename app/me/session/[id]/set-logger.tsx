"use client";

import { useState, useTransition } from "react";
import { completeSession, logSets } from "@/app/client-actions";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import type { ExerciseRow } from "@/lib/programs/types";

type SetLog = {
  set_number: number;
  side: string;
  reps_done: number | null;
  load_used: number | null;
  rpe: number | null;
  rir: number | null;
  pain_0_10: number | null;
  notes: string | null;
};

const cell = `${inputClass} px-2 py-1.5 text-center text-sm`;

export function SetLogger({
  index,
  sessionId,
  exercise,
  existing,
  lastTime,
}: {
  index: number;
  sessionId: string;
  exercise: ExerciseRow;
  existing: SetLog[];
  lastTime: string | null;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const sides: ("both" | "left" | "right")[] =
    exercise.side === "each" ? ["left", "right"] : exercise.side === "left" ? ["left"] : exercise.side === "right" ? ["right"] : ["both"];
  const find = (side: string, n: number) => existing.find((l) => l.side === side && l.set_number === n);
  const notes = existing.find((l) => l.notes)?.notes ?? "";
  const logged = existing.length > 0;

  return (
    <form
      className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4"
      action={(fd) => {
        fd.set("program_exercise_id", exercise.id ?? "");
        fd.set("program_session_id", sessionId);
        fd.set("set_count", String(exercise.sets));
        fd.set("sides", sides.join(","));
        setMsg(null);
        start(async () => {
          const r = await logSets(fd);
          setMsg(r && "error" in r && r.error ? r.error : "Saved");
        });
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg">
          <span className="text-[var(--muted)]">{index}.</span> {exercise.exercise_name}
        </h2>
        <span className="font-sans text-sm text-[var(--muted)]">
          {exercise.sets} × {exercise.reps}
          {exercise.load_prescription ? ` @ ${exercise.load_prescription}` : ""}
          {exercise.rpe_target != null ? ` · RPE ${exercise.rpe_target}` : ""}
          {exercise.rest_seconds ? ` · rest ${exercise.rest_seconds}s` : ""}
        </span>
      </div>
      {exercise.notes && <p className="mt-1 font-sans text-sm text-[var(--muted)]">{exercise.notes}</p>}
      {lastTime && <p className="mt-1 font-sans text-xs text-[var(--muted)]">Last time: {lastTime}</p>}

      {sides.map((side) => (
        <div key={side} className="mt-3">
          {sides.length > 1 && (
            <p className="font-sans text-xs uppercase tracking-wide text-[var(--muted)]">{side}</p>
          )}
          <div className="mt-1 grid grid-cols-[2.5rem_1fr_1fr_1fr_1fr_1fr] items-center gap-1.5 font-sans text-xs text-[var(--muted)]">
            <span>Set</span>
            <span className="text-center">Weight</span>
            <span className="text-center">Reps</span>
            <span className="text-center">RPE</span>
            <span className="text-center">RIR</span>
            <span className="text-center">Pain /10</span>
            {Array.from({ length: exercise.sets }, (_, i) => i + 1).map((n) => {
              const l = find(side, n);
              const key = `${side}__${n}`;
              return (
                <Row key={key} n={n} k={key} l={l} />
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} flex-1 py-1.5 text-sm`}
          name="exercise_notes"
          defaultValue={notes}
          placeholder="How did it feel? Anything to flag?"
        />
        <button className={logged ? ghostButtonClass : buttonClass} disabled={pending}>
          {pending ? "Saving…" : logged ? "Update" : "Save"}
        </button>
      </div>
      {msg && <p className="mt-1 font-sans text-xs text-[var(--muted)]">{msg}</p>}
    </form>
  );
}

function Row({ n, k, l }: { n: number; k: string; l: SetLog | undefined }) {
  return (
    <>
      <span className="text-sm text-[var(--ink)]">{n}</span>
      <input className={cell} name={`load__${k}`} type="number" step="0.5" inputMode="decimal" defaultValue={l?.load_used ?? ""} />
      <input className={cell} name={`reps__${k}`} type="number" inputMode="numeric" defaultValue={l?.reps_done ?? ""} />
      <input className={cell} name={`rpe__${k}`} type="number" step="0.5" min={1} max={10} inputMode="decimal" defaultValue={l?.rpe ?? ""} />
      <input className={cell} name={`rir__${k}`} type="number" step="0.5" min={0} max={6} inputMode="decimal" defaultValue={l?.rir ?? ""} />
      <input className={cell} name={`pain__${k}`} type="number" min={0} max={10} inputMode="numeric" defaultValue={l?.pain_0_10 ?? ""} />
    </>
  );
}

export function SessionFinish({
  sessionId,
  existing,
}: {
  sessionId: string;
  existing: {
    completed_at: string | null;
    skipped: boolean;
    overall_rpe: number | null;
    duration_minutes: number | null;
    notes: string | null;
    energy_0_10?: number | null;
    soreness_0_10?: number | null;
    fatigue_0_10?: number | null;
  } | null;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4"
      action={(fd) => {
        fd.set("program_session_id", sessionId);
        setMsg(null);
        start(async () => {
          const r = await completeSession(fd);
          setMsg(r && "error" in r && r.error ? r.error : fd.get("skipped") === "true" ? "Marked as skipped" : "Session complete");
        });
      }}
    >
      <h2 className="text-lg">Finish session</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="font-sans text-xs text-[var(--muted)]">
          Overall effort (RPE 1–10)
          <input className={`${inputClass} mt-1`} name="overall_rpe" type="number" step="0.5" min={1} max={10} defaultValue={existing?.overall_rpe ?? ""} />
        </label>
        <label className="font-sans text-xs text-[var(--muted)]">
          Time taken (minutes)
          <input className={`${inputClass} mt-1`} name="duration_minutes" type="number" min={1} defaultValue={existing?.duration_minutes ?? ""} />
        </label>
        <label className="font-sans text-xs text-[var(--muted)]">
          Energy (0–10, optional)
          <input className={`${inputClass} mt-1`} name="energy_0_10" type="number" min={0} max={10} defaultValue={existing?.energy_0_10 ?? ""} />
        </label>
        <label className="font-sans text-xs text-[var(--muted)]">
          Soreness (0–10, optional)
          <input className={`${inputClass} mt-1`} name="soreness_0_10" type="number" min={0} max={10} defaultValue={existing?.soreness_0_10 ?? ""} />
        </label>
        <label className="font-sans text-xs text-[var(--muted)]">
          Fatigue (0–10, optional)
          <input className={`${inputClass} mt-1`} name="fatigue_0_10" type="number" min={0} max={10} defaultValue={existing?.fatigue_0_10 ?? ""} />
        </label>
      </div>
      <label className="mt-3 block font-sans text-xs text-[var(--muted)]">
        Notes for your practitioner
        <textarea className={`${inputClass} mt-1`} name="notes" rows={2} defaultValue={existing?.notes ?? ""} placeholder="Energy, soreness, anything that hurt, what felt easy" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={buttonClass} name="skipped" value="false" disabled={pending}>
          {existing?.completed_at ? "Update" : "Mark complete"}
        </button>
        <button className={ghostButtonClass} name="skipped" value="true" disabled={pending}>
          Skip this session
        </button>
        {msg && <span className="self-center font-sans text-xs text-[var(--muted)]">{msg}</span>}
      </div>
    </form>
  );
}
