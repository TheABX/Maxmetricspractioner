import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { ClientPriorityPreview } from "@/components/priority-board";
import { createClient } from "@/lib/supabase/server";
import { loadProgrammingPriorities } from "@/lib/priority-engine/load";
import { PrioritiesForm } from "./priorities-form";

export default async function PrioritiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const [{ data: client }, loaded] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name").eq("id", id).single(),
    loadProgrammingPriorities(supabase, id),
  ]);
  if (!client) notFound();

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href={`/clients/${id}`}>
          {client.first_name} {client.last_name}
        </Link>{" "}
        · Layer 2
      </p>
      <h1 className="mt-2 text-4xl">Programming priorities</h1>
      <p className="mt-2 max-w-3xl font-sans text-sm text-[var(--muted)]">
        What needs attention, how important it is, and why. This layer does not choose exercises. Internal scores stay
        hidden from the client. Absolute capacity is only scored when a reference exists — red results are not
        automatically P1.
        {loaded.seeded ? " Nothing is saved until you press Save." : loaded.row?.confirmed_at ? " Confirmed." : " Saved, not yet confirmed."}
      </p>
      <p className="mt-2 font-sans text-sm">
        <Link className="underline" href={`/clients/${id}/profile`}>
          Profile
        </Link>
        {" · "}
        <Link className="underline" href={`/clients/${id}/structure`}>
          Program structure →
        </Link>
        {" · "}
        <Link className="underline" href={`/clients/${id}/selection`}>
          Exercise selection →
        </Link>
        {" · "}
        <Link className="underline" href={`/clients/${id}/dosage`}>
          Dosage →
        </Link>
      </p>

      <PrioritiesForm
        clientId={id}
        result={loaded.result}
        overrides={loaded.row?.overrides ?? {}}
        confirmedAt={loaded.row?.confirmed_at ?? null}
      />

      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Client-facing preview</h2>
        <div className="mt-3">
          <ClientPriorityPreview priorities={loaded.result.priorities} />
        </div>
      </div>
    </AppShell>
  );
}
