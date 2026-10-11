"use client";

import { useState, useTransition } from "react";
import { commitForcePlateImport, previewForcePlateFile } from "@/app/actions";
import type { ForcePlateParseResult } from "@/lib/force-plate/parse";
import { buttonClass, ghostButtonClass } from "@/components/ui";

export function ForcePlateImporter({ assessmentId }: { assessmentId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ForcePlateParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runPreview(selected: File) {
    const fd = new FormData();
    fd.set("file", selected);
    startTransition(async () => {
      const result = await previewForcePlateFile(fd);
      if ("error" in result && result.error) {
        setError(result.error);
        setPreview(null);
        return;
      }
      setError(null);
      setPreview(result.parsed ?? null);
    });
  }

  function commit() {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("assessment_id", assessmentId);
    startTransition(async () => {
      const result = await commitForcePlateImport(fd);
      if (result && "error" in result && result.error) setError(result.error);
    });
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
      <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        Force plate testing
      </h2>
      <p className="mt-2 font-sans text-sm text-[var(--muted)]">
        Upload the manufacturer Excel. Nothing is stored until you click Import data.
      </p>
      <input
        className="mt-4 font-sans text-sm"
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => {
          const next = e.target.files?.[0] ?? null;
          setFile(next);
          if (next) runPreview(next);
        }}
      />
      {file && <p className="mt-2 font-sans text-sm">{file.name}</p>}
      {pending && <p className="mt-2 font-sans text-sm">Working…</p>}
      {error && <p className="mt-2 font-sans text-sm text-[var(--accent-2)]">{error}</p>}
      {preview && (
        <div className="mt-4 space-y-2 font-sans text-sm">
          <p>File recognised: {preview.fileType === "FORCE_PLATE_EXPORT_V1" ? "Force Plate Export ✓" : "Unknown"}</p>
          <p>Athlete: {preview.athleteName ?? "—"}</p>
          <p>Tests detected: {preview.testsDetected}</p>
          <p>
            Date range: {preview.dateRange.start ? new Date(preview.dateRange.start).toLocaleDateString("en-AU") : "—"}
          </p>
          <p>L/R data detected: {preview.hasLrData ? "Yes" : "No"}</p>
          <p>Movements: {preview.movements.join(", ") || "—"}</p>
          <p>Trials grouped: {preview.trials.length} (L+R / L / R counted as one trial)</p>
          {preview.warnings.slice(0, 8).map((w) => (
            <p key={w.message} className="text-[var(--accent-2)]">
              ⚠ {w.message}
            </p>
          ))}
          {preview.warnings.length > 8 && (
            <p className="text-[var(--muted)]">{preview.warnings.length - 8} more notices…</p>
          )}
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="py-1">Movement</th>
                  <th>Trial</th>
                  <th>Peak L+R</th>
                  <th>L</th>
                  <th>R</th>
                </tr>
              </thead>
              <tbody>
                {preview.trials
                  .filter((t) => t.movement.includeInClientReport)
                  .map((t) => (
                    <tr key={`${t.movement_name}-${t.trial}`} className="border-t border-[var(--line)]">
                      <td className="py-1">{t.movement_name}</td>
                      <td>{t.trial}</td>
                      <td>{t.combined?.peak_force_kg ?? "—"}</td>
                      <td>{t.left?.peak_force_kg ?? "—"}</td>
                      <td>{t.right?.peak_force_kg ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <button className={buttonClass} type="button" onClick={commit} disabled={preview.fileType !== "FORCE_PLATE_EXPORT_V1"}>
            Import data
          </button>
          <button className={`${ghostButtonClass} ml-2`} type="button" onClick={() => setPreview(null)}>
            Review / fix
          </button>
        </div>
      )}
    </div>
  );
}
