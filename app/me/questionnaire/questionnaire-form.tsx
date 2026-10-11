"use client";

import { useState, useTransition } from "react";
import { submitQuestionnaire } from "@/app/client-actions";
import { SectionFields } from "@/components/questionnaire-fields";
import { buttonClass } from "@/components/ui";
import { QUESTIONNAIRE_SECTIONS } from "@/lib/questionnaire/schema";

export function QuestionnaireForm({
  responseId,
  answers,
}: {
  responseId: string | null;
  answers: Record<string, unknown>;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      className="mt-6 space-y-8"
      action={(fd) => {
        if (responseId) fd.set("response_id", responseId);
        setMsg(null);
        setErr(null);
        start(async () => {
          const r = await submitQuestionnaire(fd);
          if (r && "error" in r && r.error) setErr(r.error);
          else setMsg("Saved. Thank you.");
        });
      }}
    >
      <SectionFields sections={QUESTIONNAIRE_SECTIONS} answers={answers} />
      <div className="flex items-center gap-3">
        <button className={buttonClass} disabled={pending}>
          {pending ? "Saving…" : "Submit questionnaire"}
        </button>
        {msg && <span className="font-sans text-sm text-[var(--muted)]">{msg}</span>}
        {err && <span className="font-sans text-sm text-[var(--accent-2)]">{err}</span>}
      </div>
    </form>
  );
}
