"use client";

import { useState, useTransition } from "react";
import { askCoach } from "@/app/client-actions";
import { buttonClass, inputClass } from "@/components/ui";

export function CoachBox() {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4"
      action={() => {
        const text = q.trim();
        if (!text) return;
        setMsg(null);
        start(async () => {
          const r = await askCoach(text);
          setMsg("error" in r ? r.error : r.reply);
          if (!("error" in r)) setQ("");
        });
      }}
    >
      <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Ask about your program</p>
      <textarea className={`${inputClass} mt-2`} rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Can I move Wednesday cardio to Thursday? Why split squats?" />
      <button className={`${buttonClass} mt-3`} disabled={pending}>
        {pending ? "Thinking…" : "Send"}
      </button>
      {msg && <p className="mt-3 whitespace-pre-line font-sans text-sm">{msg}</p>}
    </form>
  );
}
