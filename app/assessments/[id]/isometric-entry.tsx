"use client";

import { useState, useTransition } from "react";
import { saveIsometricBattery } from "@/app/actions";
import { ISOMETRIC_BATTERY } from "@/lib/isometric/tests";
import { buttonClass, inputClass } from "@/components/ui";

function TrialInputs({
  prefix,
  sides,
}: {
  prefix: string;
  sides: Array<"L" | "R" | "BILATERAL">;
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {sides.map((side) => (
        <div key={side}>
          <p className="font-sans text-xs uppercase tracking-wide text-[var(--muted)]">
            {side === "BILATERAL" ? "Bilateral" : side === "L" ? "Left" : "Right"} — 3 trials (kg)
          </p>
          <div className="mt-1 flex gap-2">
            {[1, 2, 3].map((n) => (
              <input
                key={n}
                className={inputClass}
                name={`${prefix}__${side}__${n}`}
                type="number"
                step="0.1"
                placeholder={`T${n}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function IsometricEntry({ assessmentId }: { assessmentId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5"
      action={(fd) => {
        fd.set("assessment_id", assessmentId);
        start(async () => {
          const result = await saveIsometricBattery(fd);
          if (result && "error" in result && result.error) setError(result.error);
        });
      }}
    >
      <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        Isometric strength
      </h2>
      <p className="mt-2 font-sans text-sm text-[var(--muted)]">
        Enter every trial. The client PDF uses the highest valid peak on each side, not the average. Mean and
        variability stay in quality control. A manufacturer Excel importer will be mapped only after a genuine export
        is supplied — this form does not invent device columns.
      </p>
      {ISOMETRIC_BATTERY.map((test) => (
        <fieldset key={test.testType} className="mt-5 border-t border-[var(--line)] pt-4">
          <legend className="font-sans text-sm font-medium">{test.displayName}</legend>
          <p className="mt-1 font-sans text-xs text-[var(--muted)]">{test.whatThisMeasures}</p>
          <TrialInputs
            prefix={test.testType}
            sides={test.laterality === "bilateral" ? ["BILATERAL"] : ["L", "R"]}
          />
        </fieldset>
      ))}
      {error && <p className="mt-3 font-sans text-sm text-[var(--accent-2)]">{error}</p>}
      <button className={`${buttonClass} mt-5`} disabled={pending}>
        {pending ? "Saving…" : "Save isometric trials"}
      </button>
    </form>
  );
}
