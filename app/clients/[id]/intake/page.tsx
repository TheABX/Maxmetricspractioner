import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, buttonClass, ghostButtonClass } from "@/components/ui";
import { ProfileChips, QuestionnaireSummary } from "@/components/questionnaire-summary";
import { createClient } from "@/lib/supabase/server";
import { RequestQuestionnaire } from "../request-questionnaire";

export default async function IntakeReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const [{ data: client }, { data: responses }] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name").eq("id", id).single(),
    supabase.from("questionnaire_responses").select("*").eq("client_id", id).order("created_at", { ascending: false }),
  ]);
  if (!client) notFound();

  const latest = responses?.[0];

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href={`/clients/${id}`}>
          {client.first_name} {client.last_name}
        </Link>{" "}
        · Intake questionnaire
      </p>
      <h1 className="mt-2 text-4xl">Review questionnaire</h1>
      <p className="mt-2 max-w-3xl font-sans text-sm text-[var(--muted)]">
        Read the answers, then open the programming profile to confirm what they seed. Requesting an update puts a new
        form in their portal and hides the last one until they submit again.
      </p>
      <p className="mt-4 flex flex-wrap gap-2">
        <Link className={buttonClass} href={`/clients/${id}/profile`}>
          Open programming profile
        </Link>
        <Link className={ghostButtonClass} href={`/clients/${id}`}>
          Back to client
        </Link>
      </p>

      {!latest && (
        <p className="mt-8 font-sans text-sm text-[var(--muted)]">No questionnaire yet. Invite them, then wait for a submit.</p>
      )}

      {latest && !latest.submitted_at && (
        <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-sm">Waiting for {client.first_name} to submit. It is open in their portal now.</p>
        </div>
      )}

      {(responses ?? [])
        .filter((r) => r.submitted_at)
        .map((r, i) => (
          <div key={r.id} className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
            <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              {i === 0 ? "Latest submission" : "Earlier submission"} ·{" "}
              {new Date(r.submitted_at as string).toLocaleDateString("en-AU")} · v{r.questionnaire_version}
            </h2>
            <div className="mt-4">
              <ProfileChips answers={(r.answers as Record<string, unknown>) ?? {}} />
            </div>
            <div className="mt-6">
              <QuestionnaireSummary answers={(r.answers as Record<string, unknown>) ?? {}} />
            </div>
            {i === 0 && <RequestQuestionnaire clientId={id} />}
          </div>
        ))}
    </AppShell>
  );
}
