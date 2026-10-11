"use client";

import { useState } from "react";
import { ghostButtonClass } from "@/components/ui";
import { LibraryTable } from "@/app/exercises/library-table";
import type { ExerciseRecord } from "@/lib/exercise-kb/types";
import type { FamilyRow } from "@/lib/exercise-kb/load";

export function ExerciseLibraryPicker({
  library,
  families,
  onPick,
}: {
  library: ExerciseRecord[];
  families: FamilyRow[];
  onPick: (ex: ExerciseRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className={ghostButtonClass} onClick={() => setOpen(true)}>
        Browse library
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
          <div className="mt-8 w-full max-w-5xl rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl">Add from exercise library</h2>
              <button type="button" className="font-sans text-sm underline" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <p className="mt-1 font-sans text-sm text-[var(--muted)]">Same database the programming engine uses. Inactive or unapproved items can still be chosen manually.</p>
            <div className="mt-4">
              <LibraryTable
                library={library.filter((e) => e.active)}
                families={families}
                picker
                onPick={(ex) => {
                  onPick(ex);
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
