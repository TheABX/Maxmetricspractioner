import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { loadRetestReview } from "@/lib/retest-engine/load";
import { RetestForm } from "./retest-form";

export default async function RetestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ current?: string; compare?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const [{ data: client }, loaded] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name").eq("id", id).single(),
    loadRetestReview(supabase, id, { currentId: q.current, compareId: q.compare }),
  ]);
  if (!client) notFound();

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href={`/clients/${id}`}>
          {client.first_name} {client.last_name}
        </Link>{" "}
        · Layer 8
      </p>
      <h1 className="mt-2 text-4xl">Retest &amp; next block</h1>
      <p className="mt-2 max-w-3xl font-sans text-sm text-[var(--muted)]">
        What changed, whether the change is bigger than measurement noise, and what the next 12 weeks should emphasise.
        Assessments are not overwritten. A numerical increase is not automatically an improvement.
        {loaded.seeded ? " Preview until you save." : loaded.row?.confirmed_at ? " Confirmed." : " Saved, not yet confirmed."}
      </p>
      <p className="mt-2 font-sans text-sm">
        <Link className="underline" href={`/clients/${id}/messages`}>
          ← Messages
        </Link>
        {" · "}
        <Link className="underline" href={`/clients/${id}/priorities`}>
          Priorities
        </Link>
        {" · "}
        <Link className="underline" href={`/clients/${id}/structure`}>
          Structure →
        </Link>
      </p>
      <RetestForm
        clientId={id}
        firstName={client.first_name}
        sessions={loaded.sessions}
        currentId={loaded.currentId}
        compareId={loaded.compareId}
        result={loaded.result}
        schedule={loaded.schedule}
        confirmedAt={loaded.row?.confirmed_at ?? null}
        notes={loaded.row?.practitioner_notes ?? ""}
        contextualChange={loaded.row?.contextual_change ?? ""}
        goalsConfirmed={loaded.row?.goals_confirmed ?? null}
      />
    </AppShell>
  );
}
