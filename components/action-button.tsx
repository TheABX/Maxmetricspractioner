"use client";

import { useState, useTransition } from "react";
import { buttonClass, ghostButtonClass } from "@/components/ui";

type Result = { error?: string; message?: string; ok?: boolean } | void;

/**
 * A form that posts hidden fields to a server action and shows the result.
 */
export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  ghost = false,
  confirm,
  className,
}: {
  action: (fd: FormData) => Promise<Result>;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  ghost?: boolean;
  confirm?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className={`inline-block ${className ?? ""}`}
      action={(fd) => {
        if (confirm && !window.confirm(confirm)) return;
        for (const [k, v] of Object.entries(fields)) fd.set(k, v);
        setMsg(null);
        setErr(null);
        start(async () => {
          const r = await action(fd);
          if (r && "error" in r && r.error) setErr(r.error);
          else if (r && "message" in r && r.message) setMsg(r.message);
        });
      }}
    >
      <button className={ghost ? ghostButtonClass : buttonClass} disabled={pending}>
        {pending ? pendingLabel ?? "Working…" : label}
      </button>
      {msg && <p className="mt-2 font-sans text-xs text-[var(--muted)]">{msg}</p>}
      {err && <p className="mt-2 font-sans text-xs text-[var(--accent-2)]">{err}</p>}
    </form>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "draft"
      ? "bg-[#f3ead9] text-[#6b5e4e]"
      : status === "approved"
        ? "bg-[#e6eef9] text-[#1f3f6e]"
        : status === "sent" || status === "active"
          ? "bg-[#e3f2ea] text-[#1f4d3a]"
          : "bg-[#eee] text-[#555]";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 font-sans text-[11px] uppercase tracking-wide ${tone}`}>
      {status}
    </span>
  );
}
