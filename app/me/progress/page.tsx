import { ClientShell } from "@/components/client-shell";
import { requireClientPage } from "@/lib/auth/client-page";
import type { RetestResult } from "@/lib/retest-engine/types";

export default async function ClientProgressPage() {
  const { supabase, client } = await requireClientPage();
  const { data: row } = await supabase
    .from("retest_reviews")
    .select("review, confirmed_at")
    .eq("client_id", client.id)
    .not("confirmed_at", "is", null)
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const review = (row?.review ?? null) as RetestResult | null;
  const headlines = (review?.top_improvements ?? []).concat(
    (review?.vs_previous ?? []).filter((m) => m.domain === "SYMMETRY" && m.change_status === "IMPROVED" && m.current_value != null && m.previous_value != null),
  );
  const seen = new Set<string>();
  const unique = headlines.filter((m) => (seen.has(m.key) ? false : (seen.add(m.key), true))).slice(0, 6);

  return (
    <ClientShell name={`${client.first_name} ${client.last_name}`} active="progress">
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Progress</p>
      <h1 className="mt-2 text-3xl">Since last assessment</h1>
      <p className="mt-2 font-sans text-sm text-[var(--muted)]">
        Headline changes only. A small number moving is not automatically progress. This is not a medical report.
      </p>
      {!review && <p className="mt-6 font-sans text-sm text-[var(--muted)]">Your practitioner has not released a retest review yet.</p>}
      {review && (
        <>
          <p className="mt-6 font-sans text-sm">{review.client_summary}</p>
          <ul className="mt-6 space-y-3">
            {unique.length === 0 && <li className="font-sans text-sm text-[var(--muted)]">No headline changes to show.</li>}
            {unique.map((m) => (
              <li key={m.key} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
                <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{m.label}</p>
                <p className="mt-1 text-2xl">
                  {fmt(m.previous_value)} → {fmt(m.current_value)} {m.unit}
                </p>
                <p className="mt-1 font-sans text-sm text-[var(--muted)]">
                  {m.domain === "SYMMETRY"
                    ? m.change_status === "IMPROVED"
                      ? "Improved"
                      : "Maintained"
                    : m.percentage_change != null
                      ? `${m.percentage_change >= 0 ? "+" : ""}${m.percentage_change.toFixed(1)}%`
                      : m.change_status.replaceAll("_", " ")}
                </p>
                {m.percentile_change != null && (
                  <p className="mt-1 font-sans text-xs text-[var(--muted)]">
                    {fmt(m.previous_percentile)}th → {fmt(m.current_percentile)}th percentile
                  </p>
                )}
              </li>
            ))}
          </ul>
          {review.still_to_improve[0] && (
            <p className="mt-6 font-sans text-sm text-[var(--muted)]">
              Still a priority: {review.still_to_improve[0].label.toLowerCase()}.
            </p>
          )}
        </>
      )}
    </ClientShell>
  );
}

function fmt(n: number | null) {
  if (n == null) return "—";
  return Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(1);
}
