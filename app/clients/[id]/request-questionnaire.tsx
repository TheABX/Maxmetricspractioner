"use client";

import { useState, useTransition } from "react";
import { requestQuestionnaire } from "@/app/program-actions";
import { ghostButtonClass } from "@/components/ui";

export function RequestQuestionnaire({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-3">
      <button
        type="button"
        className={ghostButtonClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await requestQuestionnaire(clientId);
            setMsg("error" in r ? r.error : r.message);
          })
        }
      >
        {pending ? "Sending…" : "Request updated questionnaire"}
      </button>
      {msg && <p className="mt-2 font-sans text-xs text-[var(--muted)]">{msg}</p>}
    </div>
  );
}
