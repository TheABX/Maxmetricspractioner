import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ensureCatalog, loadFamilies, loadRelationships } from "@/lib/exercise-kb/load";
import { pretty } from "@/lib/exercise-kb/types";

export default async function FamiliesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const [library, families] = await Promise.all([ensureCatalog(supabase), loadFamilies(supabase)]);
  const graph = await loadRelationships(supabase, library);

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href="/exercises">
          Exercise library
        </Link>{" "}
        · Families
      </p>
      <h1 className="mt-2 text-4xl">Exercise families</h1>
      <p className="mt-2 max-w-2xl font-sans text-sm text-[var(--muted)]">
        Possible relationships, not a mandatory pathway. Arrows show regressions, progressions and alternatives the engine
        can offer.
      </p>
      <div className="mt-8 grid gap-5">
        {families.map((f) => {
          const members = library.filter((e) => e.family_id === f.id || e.family_slug === f.slug);
          if (!members.length) return null;
          return (
            <section key={f.id} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
              <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{f.name}</h2>
              <ul className="mt-3 space-y-2 font-sans text-sm">
                {members.map((e) => {
                  const downs = graph.filter((r) => r.from_slug === e.slug && r.type === "PROGRESSION");
                  const ups = graph.filter((r) => r.from_slug === e.slug && r.type === "REGRESSION");
                  const alts = graph.filter((r) => r.from_slug === e.slug && (r.type === "ALTERNATIVE" || r.type === "SIMILAR_STIMULUS"));
                  return (
                    <li key={e.id}>
                      <Link className="underline" href={`/exercises/${e.id}`}>
                        {e.name}
                      </Link>
                      <span className="text-[var(--muted)]"> · {pretty(e.difficulty_level)}</span>
                      {ups.length > 0 && <p className="text-xs text-[var(--muted)]">↑ Regression: {ups.map((r) => library.find((x) => x.slug === r.to_slug)?.name ?? r.to_slug).join(", ")}</p>}
                      {downs.length > 0 && <p className="text-xs text-[var(--muted)]">↓ Progression: {downs.map((r) => library.find((x) => x.slug === r.to_slug)?.name ?? r.to_slug).join(", ")}</p>}
                      {alts.length > 0 && <p className="text-xs text-[var(--muted)]">↔ Alternative: {alts.map((r) => library.find((x) => x.slug === r.to_slug)?.name ?? r.to_slug).join(", ")}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
