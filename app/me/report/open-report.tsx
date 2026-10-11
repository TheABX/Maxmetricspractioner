"use client";

import { useState, useTransition } from "react";
import { reportSignedUrl } from "@/app/client-actions";
import { buttonClass } from "@/components/ui";

export function OpenReportButton({ reportId }: { reportId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className={buttonClass}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await reportSignedUrl(reportId);
            if ("error" in r && r.error) setErr(r.error);
            else if ("url" in r && r.url) window.open(r.url, "_blank");
          })
        }
      >
        {pending ? "Opening…" : "Open PDF"}
      </button>
      {err && <p className="mt-1 font-sans text-xs text-[var(--accent-2)]">{err}</p>}
    </div>
  );
}
