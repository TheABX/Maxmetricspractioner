"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateTag, saveTag } from "@/app/library-actions";
import { buttonClass, Field, ghostButtonClass, inputClass } from "@/components/ui";
import type { TagRow } from "@/lib/exercise-kb/load";

export function TagsForm({ tags }: { tags: TagRow[] }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="mt-8 max-w-xl">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          start(async () => {
            const res = await saveTag({ name: name.trim() });
            setMsg("error" in res ? res.error : "Saved.");
            if (!("error" in res)) {
              setName("");
              router.refresh();
            }
          });
        }}
      >
        <Field label="New tag">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <button className={`${buttonClass} mt-6`} disabled={pending}>
          Create
        </button>
      </form>
      <ul className="mt-6 space-y-2 font-sans text-sm">
        {tags.map((t) => (
          <li key={t.id} className="flex items-center justify-between border-t border-[var(--line)] pt-2">
            <span>
              {t.name} <span className="text-[var(--muted)]">{t.slug}</span>
              {!t.active && <span className="ml-2 text-[var(--muted)]">· inactive</span>}
            </span>
            {t.active && (
              <button
                type="button"
                className={ghostButtonClass}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await deactivateTag(t.id);
                    router.refresh();
                  })
                }
              >
                Deactivate
              </button>
            )}
          </li>
        ))}
      </ul>
      {msg && <p className="mt-3">{msg}</p>}
    </div>
  );
}
