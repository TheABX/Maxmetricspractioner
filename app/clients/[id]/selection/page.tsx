import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { loadProgramSelection } from "@/lib/exercise-kb/load";
import { SelectionForm } from "./selection-form";

export default async function SelectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const [{ data: client }, loaded] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name").eq("id", id).single(),
    loadProgramSelection(supabase, id),
  ]);
  if (!client) notFound();

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href={`/clients/${id}`}>
          {client.first_name} {client.last_name}
        </Link>{" "}
        · Layer 4
      </p>
      <h1 className="mt-2 text-4xl">Exercise selection</h1>
      <p className="mt-2 max-w-3xl font-sans text-sm text-[var(--muted)]">
        Which exercises deliver this week&apos;s priorities for this client. Sets, reps and load come later. Age is not a
        filter. Locked exercises stay through regeneration unless they become unsafe.
        {loaded.seeded ? " Preview until you save." : loaded.row?.confirmed_at ? " Confirmed." : " Saved, not yet confirmed."}
      </p>
      <p className="mt-2 font-sans text-sm">
        <Link className="underline" href={`/clients/${id}/structure`}>
          ← Structure
        </Link>
        {" · "}
        <Link className="underline" href={`/clients/${id}/dosage`}>
          Dosage →
        </Link>
        {" · "}
        <Link className="underline" href="/exercises">
          Exercise library
        </Link>
      </p>
      <SelectionForm
        clientId={id}
        result={loaded.effective}
        override={loaded.override}
        confirmedAt={loaded.row?.confirmed_at ?? null}
      />
    </AppShell>
  );
}
