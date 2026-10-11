"use client";

import { useState, useTransition } from "react";
import { submitNutritionPreferences } from "@/app/nutrition-actions";
import { SectionFields } from "@/components/questionnaire-fields";
import { buttonClass } from "@/components/ui";
import { NUTRITION_SECTIONS } from "@/lib/nutrition/questionnaire";

export function NutritionForm({
  answers,
  submitLabel = "Save nutrition preferences",
}: {
  answers: Record<string, unknown>;
  submitLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      className="mt-6 space-y-8"
      action={(fd) => {
        setMsg(null);
        setErr(null);
        start(async () => {
          const r = await submitNutritionPreferences(fd);
          if (r && "error" in r && r.error) setErr(r.error);
          else setMsg(r && "message" in r ? r.message ?? "Saved." : "Saved.");
        });
      }}
    >
      <SectionFields sections={NUTRITION_SECTIONS} answers={answers} />
      <div className="flex items-center gap-3">
        <button className={buttonClass} disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {msg && <span className="font-sans text-sm text-[var(--muted)]">{msg}</span>}
        {err && <span className="font-sans text-sm text-[var(--accent-2)]">{err}</span>}
      </div>
    </form>
  );
}
