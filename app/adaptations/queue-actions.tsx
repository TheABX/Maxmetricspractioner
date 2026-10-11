"use client";

import { useTransition } from "react";
import { setQueueStatus } from "@/app/engine-actions";
import { ghostButtonClass } from "@/components/ui";

export function QueueActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <span className="flex gap-2 font-sans text-xs">
      {(["REVIEWED", "ACTIONED", "DISMISSED"] as const).map((status) => (
        <button
          key={status}
          type="button"
          className={ghostButtonClass}
          disabled={pending}
          onClick={() => start(async () => { await setQueueStatus({ id, status }); })}
        >
          {status.toLowerCase()}
        </button>
      ))}
    </span>
  );
}
