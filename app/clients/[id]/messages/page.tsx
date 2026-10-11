import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { loadProgramComms } from "@/lib/comms-engine/load";
import { createClient } from "@/lib/supabase/server";
import { MessagesForm } from "./messages-form";

export default async function ClientMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const [{ data: client }, loaded] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name").eq("id", id).single(),
    loadProgramComms(supabase, id),
  ]);
  if (!client) notFound();

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href={`/clients/${id}`}>
          {client.first_name} {client.last_name}
        </Link>{" "}
        · Layer 7
      </p>
      <h1 className="mt-2 text-4xl">Communication</h1>
      <p className="mt-2 max-w-3xl font-sans text-sm text-[var(--muted)]">
        Write when something meaningful happened. Routine notes may send automatically. Pain, health language, and red
        traffic stay in the review queue.
      </p>
      <p className="mt-2 font-sans text-sm">
        <Link className="underline" href={`/clients/${id}/adaptation`}>
          ← Adaptation
        </Link>
        {" · "}
        <Link className="underline" href="/adaptations">
          Clinic queue
        </Link>
        {" · "}
        <Link className="underline" href={`/clients/${id}/retest`}>
          Retest →
        </Link>
      </p>
      <MessagesForm
        clientId={id}
        firstName={client.first_name}
        plan={loaded.plan}
        prefs={loaded.prefs}
        practitioner={loaded.practitioner}
        messages={loaded.messages}
        followUps={loaded.followUps}
      />
    </AppShell>
  );
}
