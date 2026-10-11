import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { loadProgramAdaptation } from "@/lib/adaptation-engine/load";
import { AdaptationForm } from "./adaptation-form";

export default async function AdaptationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const [{ data: client }, loaded] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name").eq("id", id).single(),
    loadProgramAdaptation(supabase, id),
  ]);
  if (!client) notFound();

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href={`/clients/${id}`}>
          {client.first_name} {client.last_name}
        </Link>{" "}
        · Layer 6
      </p>
      <h1 className="mt-2 text-4xl">Progression &amp; adaptation</h1>
      <p className="mt-2 max-w-3xl font-sans text-sm text-[var(--muted)]">
        What should happen next, from what was actually logged. Time passing is not enough to progress. One tough session
        is not enough to regress. Pain is a flag, not a diagnosis.
        {loaded.seeded ? " Preview until you save." : loaded.row?.confirmed_at ? " Confirmed." : " Saved, not yet confirmed."}
      </p>
      <p className="mt-2 font-sans text-sm">
        <Link className="underline" href={`/clients/${id}/dosage`}>
          ← Dosage
        </Link>
        {" · "}
        <Link className="underline" href={`/clients/${id}/messages`}>
          Messages
        </Link>
        {" · "}
        <Link className="underline" href="/adaptations">
          Clinic queue
        </Link>
      </p>
      <AdaptationForm
        clientId={id}
        result={loaded.effective}
        override={loaded.override}
        confirmedAt={loaded.row?.confirmed_at ?? null}
      />
    </AppShell>
  );
}
