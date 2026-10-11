"use client";

import { useState, useTransition } from "react";
import { savePractitionerComms } from "@/app/comms-actions";
import { ghostButtonClass, inputClass } from "@/components/ui";
import type { PractitionerComms } from "@/lib/comms-engine/types";

export function ClinicAutomation({
  tone,
  automation,
  maxRoutine,
  minDays,
}: {
  tone: string;
  automation: string;
  maxRoutine: number;
  minDays: number;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-6 grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5 md:grid-cols-4"
      action={(fd) => {
        start(async () => {
          const r = await savePractitionerComms({
            tone: String(fd.get("tone")) as PractitionerComms["tone"],
            automation: String(fd.get("automation")) as PractitionerComms["automation"],
            max_routine_messages_per_week: Number(fd.get("max_routine_messages_per_week")),
            minimum_days_between_encouragement: Number(fd.get("minimum_days_between_encouragement")),
          });
          setMsg("error" in r ? r.error : "Clinic automation saved.");
        });
      }}
    >
      <label className="font-sans text-xs text-[var(--muted)]">
        Tone
        <select className={`${inputClass} mt-1`} name="tone" defaultValue={tone}>
          <option value="concise">Concise</option>
          <option value="professional">Professional</option>
          <option value="casual_professional">Casual professional</option>
          <option value="encouraging">Encouraging</option>
        </select>
      </label>
      <label className="font-sans text-xs text-[var(--muted)]">
        Automation
        <select className={`${inputClass} mt-1`} name="automation" defaultValue={automation}>
          <option value="LEVEL_0_MANUAL">Level 0 — drafts only</option>
          <option value="LEVEL_1_ROUTINE_AUTO">Level 1 — routine auto</option>
          <option value="LEVEL_2_EXPANDED_AUTO">Level 2 — expanded auto</option>
        </select>
      </label>
      <label className="font-sans text-xs text-[var(--muted)]">
        Max routine / week
        <input className={`${inputClass} mt-1`} type="number" name="max_routine_messages_per_week" defaultValue={maxRoutine} />
      </label>
      <label className="font-sans text-xs text-[var(--muted)]">
        Days between encouragement
        <input className={`${inputClass} mt-1`} type="number" name="minimum_days_between_encouragement" defaultValue={minDays} />
      </label>
      <div className="md:col-span-4">
        <button className={ghostButtonClass} disabled={pending}>
          Save clinic defaults
        </button>
        {msg && <span className="ml-3 font-sans text-sm">{msg}</span>}
      </div>
    </form>
  );
}
