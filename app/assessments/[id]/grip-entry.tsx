"use client";

import { useState, useTransition } from "react";
import { saveGripStrength } from "@/app/actions";
import { GRIP_TEST } from "@/lib/grip/meta";
import { buttonClass, inputClass } from "@/components/ui";

export function GripEntry({ assessmentId }: { assessmentId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5"
      action={(fd) => {
        fd.set("assessment_id", assessmentId);
        start(async () => {
          const result = await saveGripStrength(fd);
          if (result && "error" in result && result.error) setError(result.error);
        });
      }}
    >
      <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{GRIP_TEST.displayName}</h2>
      <p className="mt-2 font-sans text-sm text-[var(--muted)]">{GRIP_TEST.whatThisMeasures}</p>
      <p className="mt-1 font-sans text-xs text-[var(--muted)]">
        Enter every trial in kilograms. The PDF uses the highest valid squeeze on each side, not the average. Map a
        dynamometer file later from real headings only.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(["L", "R"] as const).map((side) => (
          <div key={side}>
            <p className="font-sans text-xs uppercase tracking-wide text-[var(--muted)]">
              {side === "L" ? "Left" : "Right"} — 3 trials (kg)
            </p>
            <div className="mt-1 flex gap-2">
              {[1, 2, 3].map((n) => (
                <input
                  key={n}
                  className={inputClass}
                  name={`${GRIP_TEST.testType}__${side}__${n}`}
                  type="number"
                  step="0.1"
                  placeholder={`T${n}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 font-sans text-sm text-[var(--accent-2)]">{error}</p>}
      <button className={`${buttonClass} mt-5`} disabled={pending}>
        {pending ? "Saving…" : "Save grip trials"}
      </button>
    </form>
  );
}
