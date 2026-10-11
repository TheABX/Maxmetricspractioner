"use client";

import { useState, useTransition } from "react";
import { saveSession } from "@/app/program-actions";
import { ExerciseLibraryPicker } from "@/components/exercise-library-picker";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import type { FamilyRow } from "@/lib/exercise-kb/load";
import type { ExerciseRecord } from "@/lib/exercise-kb/types";
import type { ExerciseRow, SessionRow } from "@/lib/programs/types";
type SetLog = {
  program_exercise_id: string;
  set_number: number;
  side: string;
  reps_done: number | null;
  load_used: number | null;
  rpe: number | null;
  pain_0_10: number | null;
  notes: string | null;
};
type SessionLog = { completed_at: string | null; skipped: boolean; overall_rpe: number | null; notes: string | null };

const blank = (position: number): ExerciseRow => ({
  position,
  exercise_id: null,
  exercise_name: "",
  side: "both",
  sets: 3,
  reps: "8",
  load_prescription: null,
  rpe_target: null,
  tempo: null,
  rest_seconds: null,
  notes: null,
});

const cell = `${inputClass} py-1 text-sm`;

export function ProgramEditor({
  programId,
  session,
  library,
  families,
  locked,
  log,
  setLogs,
}: {
  programId: string;
  session: SessionRow;
  library: ExerciseRecord[];
  families: FamilyRow[];
  locked: boolean;
  log: SessionLog | null;
  setLogs: SetLog[];
}) {
  const [title, setTitle] = useState(session.title);
  const [focus, setFocus] = useState(session.focus ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");
  const [rows, setRows] = useState<ExerciseRow[]>(session.program_exercises ?? []);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  function update(i: number, patch: Partial<ExerciseRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setDirty(true);
  }
  function move(i: number, dir: -1 | 1) {
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const copy = [...r];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    setDirty(true);
  }
  function pickLibrary(i: number, id: string) {
    const item = library.find((l) => l.id === id);
    if (!item) return update(i, { exercise_id: null });
    update(i, { exercise_id: item.id, exercise_name: item.name, side: item.laterality === "UNILATERAL" || item.laterality === "ALTERNATING" ? "each" : "both" });
  }

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveSession({
        programId,
        sessionId: session.id,
        title,
        focus: focus || null,
        notes: notes || null,
        exercises: rows,
      });
      if (r && "error" in r && r.error) setMsg(r.error);
      else {
        setDirty(false);
        setMsg("Saved");
      }
    });
  }

  const status = log?.completed_at ? "completed" : log?.skipped ? "skipped" : log ? "started" : null;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Week {session.week} · Day {session.day}
        </span>
        {status && (
          <span className="rounded-full bg-[#e3f2ea] px-2 py-0.5 font-sans text-[11px] uppercase tracking-wide text-[#1f4d3a]">
            client {status}
            {log?.overall_rpe != null ? ` · RPE ${log.overall_rpe}` : ""}
          </span>
        )}
        {(setLogs.length > 0 || log?.notes) && (
          <button type="button" className="font-sans text-xs underline" onClick={() => setShowLogs(!showLogs)}>
            {showLogs ? "Hide" : "Show"} client log
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_2fr]">
        <input
          className={cell}
          value={title}
          disabled={locked}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
          placeholder="Session title"
        />
        <input
          className={cell}
          value={focus}
          disabled={locked}
          onChange={(e) => {
            setFocus(e.target.value);
            setDirty(true);
          }}
          placeholder="Focus (e.g. lower + carries)"
        />
        <input
          className={cell}
          value={notes}
          disabled={locked}
          onChange={(e) => {
            setNotes(e.target.value);
            setDirty(true);
          }}
          placeholder="Notes to client for this session"
        />
      </div>

      {showLogs && log?.notes && (
        <p className="mt-3 rounded-md bg-white p-3 font-sans text-sm">
          <span className="text-[var(--muted)]">Client notes: </span>
          {log.notes}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] font-sans text-sm">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr>
              <th className="w-6 py-1"></th>
              <th className="py-1">Exercise</th>
              <th className="w-20">Side</th>
              <th className="w-14">Sets</th>
              <th className="w-20">Reps</th>
              <th className="w-32">Load</th>
              <th className="w-16">RPE</th>
              <th className="w-16">Rest</th>
              <th>Notes</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const logs = row.id ? setLogs.filter((l) => l.program_exercise_id === row.id) : [];
              return (
                <RowGroup key={row.id ?? `new-${i}`}>
                  <tr className="border-t border-[var(--line)] align-top">
                    <td className="py-2 text-[var(--muted)]">{i + 1}</td>
                    <td className="py-2">
                      <select
                        className={`${cell} mb-1`}
                        value={row.exercise_id ?? ""}
                        disabled={locked}
                        onChange={(e) => pickLibrary(i, e.target.value)}
                      >
                        <option value="">Custom / type below</option>
                        {library.filter((l) => l.active).map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className={cell}
                        value={row.exercise_name}
                        disabled={locked}
                        onChange={(e) => update(i, { exercise_name: e.target.value })}
                        placeholder="Exercise name"
                      />
                    </td>
                    <td className="py-2">
                      <select className={cell} value={row.side} disabled={locked} onChange={(e) => update(i, { side: e.target.value as ExerciseRow["side"] })}>
                        <option value="both">Both</option>
                        <option value="each">Each side</option>
                        <option value="left">Left only</option>
                        <option value="right">Right only</option>
                      </select>
                    </td>
                    <td className="py-2">
                      <input className={cell} type="number" min={1} value={row.sets} disabled={locked} onChange={(e) => update(i, { sets: Number(e.target.value) })} />
                    </td>
                    <td className="py-2">
                      <input className={cell} value={row.reps} disabled={locked} onChange={(e) => update(i, { reps: e.target.value })} placeholder="8 or 6–8 or 30s" />
                    </td>
                    <td className="py-2">
                      <input className={cell} value={row.load_prescription ?? ""} disabled={locked} onChange={(e) => update(i, { load_prescription: e.target.value })} placeholder="e.g. 16 kg / RPE 7 / BW" />
                    </td>
                    <td className="py-2">
                      <input className={cell} type="number" step="0.5" min={1} max={10} value={row.rpe_target ?? ""} disabled={locked} onChange={(e) => update(i, { rpe_target: e.target.value === "" ? null : Number(e.target.value) })} />
                    </td>
                    <td className="py-2">
                      <input className={cell} type="number" step="15" value={row.rest_seconds ?? ""} disabled={locked} onChange={(e) => update(i, { rest_seconds: e.target.value === "" ? null : Number(e.target.value) })} placeholder="s" />
                    </td>
                    <td className="py-2">
                      <input className={cell} value={row.notes ?? ""} disabled={locked} onChange={(e) => update(i, { notes: e.target.value })} placeholder="Cue / regression / why" />
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {!locked && (
                        <>
                          <button type="button" className="px-1 text-[var(--muted)]" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                          <button type="button" className="px-1 text-[var(--muted)]" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                          <button
                            type="button"
                            className="px-1 text-[var(--accent-2)]"
                            onClick={() => {
                              setRows((r) => r.filter((_, idx) => idx !== i));
                              setDirty(true);
                            }}
                            aria-label="Remove"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {showLogs && logs.length > 0 && (
                    <tr className="bg-white">
                      <td></td>
                      <td colSpan={9} className="py-2 text-xs">
                        <span className="text-[var(--muted)]">Logged: </span>
                        {logs
                          .sort((a, b) => a.set_number - b.set_number)
                          .map((l) => (
                            <span key={`${l.set_number}-${l.side}`} className="mr-3 inline-block">
                              S{l.set_number}
                              {l.side !== "both" ? ` ${l.side[0].toUpperCase()}` : ""}: {l.reps_done ?? "—"} reps
                              {l.load_used != null ? ` @ ${l.load_used}` : ""}
                              {l.rpe != null ? ` RPE ${l.rpe}` : ""}
                              {l.pain_0_10 ? ` pain ${l.pain_0_10}/10` : ""}
                            </span>
                          ))}
                        {logs.find((l) => l.notes)?.notes && (
                          <span className="block text-[var(--muted)]">“{logs.find((l) => l.notes)?.notes}”</span>
                        )}
                      </td>
                    </tr>
                  )}
                </RowGroup>
              );
            })}
          </tbody>
        </table>
      </div>

      {!locked && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={ghostButtonClass}
            onClick={() => {
              setRows((r) => [...r, blank(r.length)]);
              setDirty(true);
            }}
          >
            + Add exercise
          </button>
          <ExerciseLibraryPicker
            library={library}
            families={families}
            onPick={(ex) => {
              setRows((r) => {
                const next = [...r, blank(r.length)];
                const i = next.length - 1;
                next[i] = {
                  ...next[i],
                  exercise_id: ex.id,
                  exercise_name: ex.name,
                  side: ex.laterality === "UNILATERAL" || ex.laterality === "ALTERNATING" ? "each" : "both",
                };
                return next;
              });
              setDirty(true);
            }}
          />
          <button type="button" className={buttonClass} disabled={pending || !dirty} onClick={save}>
            {pending ? "Saving…" : dirty ? "Save session" : "Saved"}
          </button>
          {msg && <span className="font-sans text-xs text-[var(--muted)]">{msg}</span>}
        </div>
      )}
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
