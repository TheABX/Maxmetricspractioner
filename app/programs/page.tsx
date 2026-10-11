import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusPill } from "@/components/action-button";
import { AppShell, buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function ProgramsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const [{ data: programs }, { data: exercises }] = await Promise.all([
    supabase
      .from("programs")
      .select("id, title, version, status, weeks, days_per_week, start_date, updated_at, clients(first_name, last_name)")
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase.from("exercises").select("id, name, pattern").eq("active", true).order("pattern").order("name"),
  ]);

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Programming</p>
      <h1 className="mt-2 text-4xl">Programs</h1>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        Drafts are private. Approve, then send — the client gets an email and the program appears in their portal.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">All programs</h2>
          <ul className="mt-3 space-y-2 font-sans text-sm">
            {(programs ?? []).length === 0 && <li>No programs yet. Create one from a client record.</li>}
            {(programs ?? []).map((p) => {
              const c = Array.isArray(p.clients) ? p.clients[0] : p.clients;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2">
                  <StatusPill status={p.status} />
                  <Link className="underline" href={`/programs/${p.id}`}>
                    {c?.first_name} {c?.last_name} — {p.title} v{p.version}
                  </Link>
                  <span className="text-[var(--muted)]">
                    {p.weeks} wk × {p.days_per_week}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Exercise library</h2>
          <p className="mt-3 font-sans text-sm text-[var(--muted)]">
            Tagged knowledge base used by Layer 4 selection. Add, edit, or deactivate exercises without changing code.
          </p>
          <Link className={`${buttonClass} mt-4 inline-block`} href="/exercises">
            Open library
          </Link>
          <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto font-sans text-xs">
            {(exercises ?? []).slice(0, 12).map((e) => (
              <li key={e.id}>
                <span className="text-[var(--muted)]">{e.pattern}</span> · {e.name}
              </li>
            ))}
            {(exercises ?? []).length > 12 && <li className="text-[var(--muted)]">+{(exercises ?? []).length - 12} more</li>}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
