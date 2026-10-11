"use client";

import { useRef, useState, useTransition } from "react";
import { confirmMealPhoto, estimateMealPhoto } from "@/app/nutrition-actions";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import type { EntryKind, MealSlot, PhotoEstimate } from "@/lib/nutrition/types";

function emptyEstimate(): PhotoEstimate {
  return { name: "", kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, confidence: 0, items: [], notes: "" };
}

async function toJpeg(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1400;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    bitmap.close();
    if (!blob) return file;
    return new File([blob], "meal.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function PhotoTrigger({
  slot,
  date,
  kind,
  variant = "icon",
}: {
  slot: MealSlot;
  date: string;
  kind: EntryKind;
  variant?: "icon" | "button";
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<PhotoEstimate>(emptyEstimate());
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const pick = (file: File | undefined, from: HTMLInputElement | null) => {
    if (from) from.value = "";
    if (!file) return;
    setOpen(true);
    setErr(null);
    setReady(false);
    setPhotoPath(null);
    setEstimate(emptyEstimate());
    const local = URL.createObjectURL(file);
    setPreview(local);
    start(async () => {
      const jpeg = await toJpeg(file);
      const fd = new FormData();
      fd.set("photo", jpeg);
      fd.set("date", date);
      fd.set("slot", slot);
      const r = await estimateMealPhoto(fd);
      if (r.previewUrl) setPreview(r.previewUrl);
      if (r.photoPath) setPhotoPath(r.photoPath);
      if ("estimate" in r && r.estimate) {
        setEstimate(r.estimate);
        setReady(true);
      }
      if ("error" in r && r.error) setErr(r.error);
    });
  };

  const save = () => {
    if (!photoPath) return;
    setErr(null);
    start(async () => {
      const r = await confirmMealPhoto({ date, slot, kind, photoPath, estimate });
      if (r && "error" in r && r.error) setErr(r.error);
      else setOpen(false);
    });
  };

  const slotLabel = slot === "snack" ? "snack" : slot;

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={
            variant === "button"
              ? `${buttonClass} w-full justify-center text-xs`
              : "inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-white font-sans text-lg leading-none"
          }
          aria-label={`Photograph ${slotLabel}`}
          title="Photograph this meal"
          onClick={() => cameraRef.current?.click()}
        >
          {variant === "button" ? "Take photo" : "+"}
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0], cameraRef.current)}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0], libraryRef.current)}
        />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-lg">
            <p className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Photo · {slotLabel} · {kind === "plan" ? "plan" : "log"}
            </p>
            <h3 className="mt-1 text-2xl">What is on the plate?</h3>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Meal photo" className="mt-3 max-h-56 w-full rounded-xl object-cover" />
            )}
            <p className="mt-3 font-sans text-xs text-[var(--muted)]">
              {pending && !ready ? "Reading the photo…" : "An estimate only. Portions are guessed from what is visible."}
            </p>
            {err && <p className="mt-2 font-sans text-sm text-[var(--accent-2)]">{err}</p>}

            <div className="mt-4 grid gap-3">
              <label className="font-sans text-sm">
                <span className="text-[var(--muted)]">Name</span>
                <input
                  className={`${inputClass} mt-1`}
                  value={estimate.name}
                  onChange={(e) => setEstimate({ ...estimate, name: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="font-sans text-sm">
                  <span className="text-[var(--muted)]">kcal</span>
                  <input
                    className={`${inputClass} mt-1`}
                    type="number"
                    value={estimate.kcal || ""}
                    onChange={(e) => setEstimate({ ...estimate, kcal: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="font-sans text-sm">
                  <span className="text-[var(--muted)]">Protein g</span>
                  <input
                    className={`${inputClass} mt-1`}
                    type="number"
                    value={estimate.protein_g || ""}
                    onChange={(e) => setEstimate({ ...estimate, protein_g: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="font-sans text-sm">
                  <span className="text-[var(--muted)]">Carbs g</span>
                  <input
                    className={`${inputClass} mt-1`}
                    type="number"
                    value={estimate.carb_g || ""}
                    onChange={(e) => setEstimate({ ...estimate, carb_g: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="font-sans text-sm">
                  <span className="text-[var(--muted)]">Fat g</span>
                  <input
                    className={`${inputClass} mt-1`}
                    type="number"
                    value={estimate.fat_g || ""}
                    onChange={(e) => setEstimate({ ...estimate, fat_g: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
              {estimate.items.length > 0 && (
                <ul className="font-sans text-xs text-[var(--muted)]">
                  {estimate.items.map((i) => (
                    <li key={`${i.name}-${i.portion}`}>
                      {i.name}
                      {i.portion ? ` · ${i.portion}` : ""}
                      {i.kcal ? ` · ${Math.round(i.kcal)} kcal` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {estimate.notes && <p className="font-sans text-xs text-[var(--muted)]">{estimate.notes}</p>}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className={buttonClass} disabled={pending || !photoPath} onClick={save}>
                {pending ? "Saving…" : kind === "plan" ? "Add to plan" : "Log this"}
              </button>
              <button type="button" className={ghostButtonClass} onClick={() => libraryRef.current?.click()}>
                Choose photo
              </button>
              <button type="button" className={ghostButtonClass} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function PhotoCard({ slot, date, kind }: { slot: MealSlot; date: string; kind: EntryKind }) {
  return (
    <article className="flex w-[220px] shrink-0 snap-start flex-col justify-between rounded-xl border border-dashed border-[var(--line)] bg-[var(--card)] p-4">
      <div>
        <p className="text-[15px] leading-snug">Snap this {slot === "snack" ? "snack" : slot}</p>
        <p className="mt-2 font-sans text-xs text-[var(--muted)]">
          Photo the plate. We estimate energy from what is visible, then you confirm.
        </p>
      </div>
      <div className="mt-4">
        <PhotoTrigger slot={slot} date={date} kind={kind} variant="button" />
      </div>
    </article>
  );
}
