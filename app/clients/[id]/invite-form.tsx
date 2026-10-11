"use client";

import { useState, useTransition } from "react";
import { inviteClientToPortal } from "@/app/program-actions";
import { buttonClass, inputClass } from "@/components/ui";

export function InviteForm({
  clientId,
  email,
  invited,
}: {
  clientId: string;
  email: string;
  invited: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="mt-3"
      action={(fd) => {
        fd.set("client_id", clientId);
        setMsg(null);
        setErr(null);
        start(async () => {
          const r = await inviteClientToPortal(fd);
          if (r && "error" in r && r.error) setErr(r.error);
          else if (r && "message" in r) setMsg(r.message ?? null);
        });
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="block flex-1 font-sans text-xs text-[var(--muted)]">
          Email on file
          <input className={`${inputClass} mt-1`} name="email" type="email" defaultValue={email} required />
        </label>
        <button className={buttonClass} disabled={pending}>
          {pending ? "Sending…" : invited ? "Re-send invite" : "Invite to portal"}
        </button>
      </div>
      {msg && <p className="mt-2 break-all font-sans text-xs text-[var(--muted)]">{msg}</p>}
      {err && <p className="mt-2 font-sans text-xs text-[var(--accent-2)]">{err}</p>}
    </form>
  );
}
