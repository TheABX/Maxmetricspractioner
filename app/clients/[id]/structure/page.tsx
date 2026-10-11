import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { loadProgramStructure } from "@/lib/structure-engine/load";
import { StructureForm } from "./structure-form";

export default async function StructurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const [{ data: client }, loaded] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name").eq("id", id).single(),
    loadProgramStructure(supabase, id),
  ]);
  if (!client) notFound();

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href={`/clients/${id}`}>
          {client.first_name} {client.last_name}
        </Link>{" "}
        · Layer 3
      </p>
      <h1 className="mt-2 text-4xl">Program structure</h1>
      <p className="mt-2 max-w-3xl font-sans text-sm text-[var(--muted)]">
        Weekly frequency, split, time allocation and phases. This layer does not select exercises. Available time is a
        finite budget — more minutes are not automatically better.
        {loaded.seeded ? " Preview only until you save." : loaded.row?.confirmed_at ? " Confirmed." : " Saved, not yet confirmed."}
      </p>
      <p className="mt-2 font-sans text-sm">
        <Link className="underline" href={`/clients/${id}/priorities`}>
          ← Priorities
        </Link>
        {" · "}
        <Link className="underline" href={`/clients/${id}/profile`}>
          Profile
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
      <StructureForm
        clientId={id}
        structure={loaded.effective}
        override={loaded.override}
        stage={loaded.priorities.profile.effective.training_stage}
        confirmedAt={loaded.row?.confirmed_at ?? null}
      />
    </AppShell>
  );
}
