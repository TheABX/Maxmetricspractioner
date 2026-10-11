"use client";

import { generateForcePlateReport, markTestInvalid, updateTrialOverride } from "@/app/actions";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import { useState, useTransition } from "react";

type Trial = {
  id: string;
  trial_number: number;
  combined_peak_force_kg: number | null;
  calculated_relative_peak_force: number | null;
  calculated_left_contribution: number | null;
  calculated_right_contribution: number | null;
  peak_force_asymmetry_percent: number | null;
  is_best_trial: boolean;
  is_excluded: boolean;
  exclusion_reason: string | null;
  movement_name: string | null;
  combined_rfd_peak_ns: number | null;
  combined_force_100ms_kg: number | null;
  combined_force_200ms_kg: number | null;
  combined_force_300ms_kg: number | null;
};

export function TrialTable({
  trials,
  assessmentId,
  testId,
  movementName,
}: {
  trials: Trial[];
  assessmentId: string;
  testId: string;
  movementName: string | null;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6">
      <table className="w-full font-sans text-sm">
        <thead className="text-left text-[var(--muted)]">
          <tr>
            <th className="py-2">Trial</th>
            <th>Peak force</th>
            <th>Relative</th>
            <th>L</th>
            <th>R</th>
            <th>Asymmetry</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {trials.map((t) => (
            <tr key={t.id} className="border-t border-[var(--line)]">
              <td className="py-2">
                {t.trial_number} {t.is_best_trial ? "✓" : ""} {t.is_excluded ? "— excluded" : ""}
              </td>
              <td>{t.combined_peak_force_kg?.toFixed(1) ?? "—"} kg</td>
              <td>{t.calculated_relative_peak_force?.toFixed(2) ?? "—"}×</td>
              <td>{t.calculated_left_contribution?.toFixed(0) ?? "—"}%</td>
              <td>{t.calculated_right_contribution?.toFixed(0) ?? "—"}%</td>
              <td>{t.peak_force_asymmetry_percent?.toFixed(1) ?? "—"}%</td>
              <td className="space-x-2">
                <form
                  action={(fd) => {
                    fd.set("trial_id", t.id);
                    fd.set("assessment_id", assessmentId);
                    fd.set("is_excluded", t.is_excluded ? "false" : "true");
                    fd.set("make_best", "false");
                    start(async () => {
                      await updateTrialOverride(fd);
                    });
                  }}
                  className="inline"
                >
                  <input type="hidden" name="exclusion_reason" defaultValue={t.is_excluded ? "" : "Practitioner excluded"} />
                  <button className="underline" type="submit">
                    {t.is_excluded ? "Include" : "Exclude"}
                  </button>
                </form>
                {!t.is_excluded && !t.is_best_trial && (
                  <form
                    action={(fd) => {
                      fd.set("trial_id", t.id);
                      fd.set("assessment_id", assessmentId);
                      fd.set("is_excluded", "false");
                      fd.set("make_best", "true");
                      start(async () => {
                        await updateTrialOverride(fd);
                      });
                    }}
                    className="inline"
                  >
                    <button className="underline" type="submit">
                      Use as best
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pending && <p className="mt-2 text-xs text-[var(--muted)]">Updating…</p>}

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        action={(fd) => {
          start(async () => {
            await updateTrialOverride(fd);
          });
        }}
      >
        <input type="hidden" name="trial_id" value={trials[0]?.id} />
        <input type="hidden" name="assessment_id" value={assessmentId} />
        <input type="hidden" name="is_excluded" value="false" />
        <label className="block text-xs text-[var(--muted)]">
          Correct movement name
          <input
            className={`${inputClass} mt-1`}
            name="movement_name"
            defaultValue={movementName ?? ""}
          />
        </label>
        <button className={ghostButtonClass}>Save movement</button>
      </form>

      <form className="mt-4 flex gap-3" action={markTestInvalid}>
        <input type="hidden" name="test_id" value={testId} />
        <input type="hidden" name="assessment_id" value={assessmentId} />
        <input type="hidden" name="is_invalid" value="true" />
        <input className={inputClass} name="invalid_reason" placeholder="Mark test invalid — reason" />
        <button className={ghostButtonClass}>Mark invalid</button>
      </form>

      <button className="mt-6 font-sans text-sm underline" type="button" onClick={() => setOpen(!open)}>
        {open ? "Hide" : "Show"} detailed force data
      </button>
      {open && (
        <table className="mt-3 w-full font-sans text-xs">
          <thead className="text-left">
            <tr>
              <th className="py-1">Trial</th>
              <th>F@100</th>
              <th>F@200</th>
              <th>F@300</th>
              <th>Peak RFD</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((t) => (
              <tr key={t.id} className="border-t border-[var(--line)]">
                <td className="py-1">{t.trial_number}</td>
                <td>{t.combined_force_100ms_kg?.toFixed(1)}</td>
                <td>{t.combined_force_200ms_kg?.toFixed(1)}</td>
                <td>{t.combined_force_300ms_kg?.toFixed(1)}</td>
                <td>{t.combined_rfd_peak_ns?.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function GenerateReportButton({ assessmentId }: { assessmentId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <button
        className={buttonClass}
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await generateForcePlateReport(assessmentId);
            if (result.error) {
              setMessage(result.error);
              return;
            }
            setMessage(
              `Report generated. Missing modules noted: ${(result.warnings ?? []).join(", ")}.`,
            );
            if (result.url) window.open(result.url, "_blank");
          })
        }
      >
        {pending ? "Generating…" : "Generate report"}
      </button>
      {message && <p className="mt-2 font-sans text-sm text-[var(--muted)]">{message}</p>}
    </div>
  );
}
