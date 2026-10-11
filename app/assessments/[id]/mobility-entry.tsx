"use client";

import { useState, useTransition } from "react";
import { saveMobilityBattery } from "@/app/actions";
import { MOBILITY_BATTERY, OVERHEAD_SQUAT, SQUAT_OPTIONS } from "@/lib/mobility/tests";
import { buttonClass, inputClass } from "@/components/ui";

function Select({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: readonly string[];
  defaultValue?: string;
}) {
  return (
    <select className={inputClass} name={name} defaultValue={defaultValue ?? ""}>
      <option value="">—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}

export function MobilityEntry({ assessmentId }: { assessmentId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5"
      action={(fd) => {
        fd.set("assessment_id", assessmentId);
        start(async () => {
          const result = await saveMobilityBattery(fd);
          if (result && "error" in result && result.error) setError(result.error);
        });
      }}
    >
      <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        Mobility &amp; movement
      </h2>
      <p className="mt-2 font-sans text-sm text-[var(--muted)]">
        Objective ranges and a squat observation. This is not an injury diagnosis. Headline values are the result you
        enter, or the last trial if you leave result blank — not an automatic best-of-three.
      </p>

      {MOBILITY_BATTERY.map((test) => (
        <fieldset key={test.testKey} className="mt-6 border-t border-[var(--line)] pt-4">
          <legend className="font-sans text-sm font-medium">{test.displayName}</legend>
          <p className="mt-1 font-sans text-xs text-[var(--muted)]">{test.whatThisMeasures}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {(["L", "R"] as const).map((side) => (
              <div key={side}>
                <p className="font-sans text-xs uppercase tracking-wide text-[var(--muted)]">
                  {side === "L" ? "Left" : "Right"} trials ({test.unit})
                </p>
                <div className="mt-1 flex gap-2">
                  {[1, 2, 3].map((n) => (
                    <input
                      key={n}
                      className={inputClass}
                      name={`${test.testKey}__${side}__${n}`}
                      type="number"
                      step={test.unit === "deg" ? "1" : "0.1"}
                      placeholder={`T${n}`}
                    />
                  ))}
                </div>
                <label className="mt-2 block font-sans text-xs text-[var(--muted)]">
                  Result
                  <input
                    className={`${inputClass} mt-1`}
                    name={`${test.testKey}__${side}__result`}
                    type="number"
                    step={test.unit === "deg" ? "1" : "0.1"}
                    placeholder={`Final ${test.unit}`}
                  />
                </label>
              </div>
            ))}
          </div>
          {test.testKey === "MOBILITY_HIP_IR" ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="font-sans text-xs text-[var(--muted)]">
                Testing position
                <input
                  className={`${inputClass} mt-1`}
                  name={`${test.testKey}__testing_position`}
                  defaultValue={test.testingPosition ?? "seated"}
                />
              </label>
              <label className="font-sans text-xs text-[var(--muted)]">
                Hip angle
                <input
                  className={`${inputClass} mt-1`}
                  name={`${test.testKey}__hip_angle`}
                  defaultValue={test.hipAngle ?? ""}
                />
              </label>
              <label className="font-sans text-xs text-[var(--muted)]">
                Measurement method
                <input
                  className={`${inputClass} mt-1`}
                  name={`${test.testKey}__measurement_method`}
                  defaultValue={test.measurementMethod ?? ""}
                />
              </label>
              <label className="font-sans text-xs text-[var(--muted)]">
                Device
                <input className={`${inputClass} mt-1`} name={`${test.testKey}__device_used`} placeholder="Optional" />
              </label>
            </div>
          ) : null}
          <label className="mt-3 block font-sans text-xs text-[var(--muted)]">
            Notes
            <input className={`${inputClass} mt-1`} name={`${test.testKey}__notes`} />
          </label>
        </fieldset>
      ))}

      <fieldset className="mt-6 border-t border-[var(--line)] pt-4">
        <legend className="font-sans text-sm font-medium">{OVERHEAD_SQUAT.displayName}</legend>
        <p className="mt-1 font-sans text-xs text-[var(--muted)]">{OVERHEAD_SQUAT.whatThisMeasures}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="font-sans text-xs text-[var(--muted)]">
            Depth achieved
            <Select name="OHS__depth_achieved" options={SQUAT_OPTIONS.depth_achieved} />
          </label>
          <label className="font-sans text-xs text-[var(--muted)]">
            Heel contact
            <Select name="OHS__heel_contact" options={SQUAT_OPTIONS.heel_contact} />
          </label>
          <label className="font-sans text-xs text-[var(--muted)]">
            Left–right weight shift
            <Select name="OHS__left_right_weight_shift" options={SQUAT_OPTIONS.left_right_weight_shift} />
          </label>
          <label className="font-sans text-xs text-[var(--muted)]">
            Knee tracking
            <Select name="OHS__knee_tracking" options={SQUAT_OPTIONS.knee_tracking} />
          </label>
          <label className="font-sans text-xs text-[var(--muted)]">
            Trunk control
            <Select name="OHS__trunk_control" options={SQUAT_OPTIONS.trunk_control} />
          </label>
          <label className="font-sans text-xs text-[var(--muted)]">
            Overhead arm position
            <Select name="OHS__overhead_arm_position" options={SQUAT_OPTIONS.overhead_arm_position} />
          </label>
          <label className="font-sans text-xs text-[var(--muted)]">
            Pain reported
            <Select name="OHS__pain_reported" options={SQUAT_OPTIONS.pain_reported} defaultValue="NO" />
          </label>
        </div>
        <label className="mt-3 block font-sans text-xs text-[var(--muted)]">
          Practitioner notes
          <input className={`${inputClass} mt-1`} name="OHS__practitioner_notes" />
        </label>
      </fieldset>

      {error && <p className="mt-3 font-sans text-sm text-[var(--accent-2)]">{error}</p>}
      <button className={`${buttonClass} mt-5`} disabled={pending}>
        {pending ? "Saving…" : "Save mobility assessment"}
      </button>
    </form>
  );
}
