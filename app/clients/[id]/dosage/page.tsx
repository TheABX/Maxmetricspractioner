import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { loadProgramDosage } from "@/lib/dosage-engine/load";
import { DosageForm } from "./dosage-form";

export default async function DosagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const [{ data: client }, loaded] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name").eq("id", id).single(),
    loadProgramDosage(supabase, id),
  ]);
  if (!client) notFound();

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href={`/clients/${id}`}>
          {client.first_name} {client.last_name}
        </Link>{" "}
        · Layer 5
      </p>
      <h1 className="mt-2 text-4xl">Prescription &amp; dosage</h1>
      <p className="mt-2 max-w-3xl font-sans text-sm text-[var(--muted)]">
        How much of each selected exercise this client should perform. This layer does not re-pick exercises unless a
        prescription conflict makes one unsuitable. Age is not a dosage rule.
        {loaded.seeded ? " Preview until you save." : loaded.row?.confirmed_at ? " Confirmed." : " Saved, not yet confirmed."}
      </p>
      <p className="mt-2 font-sans text-sm">
        <Link className="underline" href={`/clients/${id}/selection`}>
          ← Exercise selection
        </Link>
        {" · "}
        <Link className="underline" href={`/clients/${id}/structure`}>
          Structure
        </Link>
        {" · "}
        <Link className="underline" href={`/clients/${id}/adaptation`}>
          Adaptation →
        </Link>
      </p>
      <DosageForm
        clientId={id}
        result={loaded.effective}
        override={loaded.override}
        confirmedAt={loaded.row?.confirmed_at ?? null}
      />
    </AppShell>
  );
}
