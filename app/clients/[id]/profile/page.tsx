import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { loadProgrammingProfile } from "@/lib/programming-profile/load";
import { ProfileForm } from "./profile-form";

export default async function ProgrammingProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const [{ data: client }, loaded, { data: sessions }, { data: responses }] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name").eq("id", id).single(),
    loadProgrammingProfile(supabase, id),
    supabase.from("assessment_sessions").select("id, assessment_date, assessment_type").eq("client_id", id).order("assessment_date", { ascending: false }),
    supabase
      .from("questionnaire_responses")
      .select("id, submitted_at, questionnaire_version")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!client) notFound();

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href={`/clients/${id}`}>
          {client.first_name} {client.last_name}
        </Link>{" "}
        · Programming profile
      </p>
      <h1 className="mt-2 text-4xl">Client programming profile</h1>
      <p className="mt-2 max-w-3xl font-sans text-sm text-[var(--muted)]">
        Sits alongside the assessment results and feeds the programming engines. It does not generate the program. Goals,
        readiness, current capacity, time, equipment, preferences and restrictions are kept as separate variables — verify
        the summary before a program is built.
        {loaded.seeded && " Pre-filled from the intake questionnaire; nothing is saved until you press Save."}
      </p>
      <p className="mt-2 font-sans text-sm">
        <Link className="underline" href={`/clients/${id}/priorities`}>
          Programming priorities →
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

      <ProfileForm
        clientId={id}
        initialProfile={loaded.profile}
        initialOverrides={loaded.overrides}
        signals={loaded.signals}
        questionnaireResponseId={loaded.questionnaireResponseId}
        assessmentSessionId={loaded.row?.assessment_session_id ?? sessions?.[0]?.id ?? null}
        sessions={(sessions ?? []).map((s) => ({ id: s.id, label: `${s.assessment_date} · ${String(s.assessment_type).replaceAll("_", " ")}` }))}
        responses={(responses ?? []).map((r) => ({
          id: r.id,
          label: `${r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-AU") : "in progress"} · v${r.questionnaire_version}`,
        }))}
        confirmedAt={loaded.row?.confirmed_at ?? null}
        updatedAt={loaded.row?.updated_at ?? null}
      />
    </AppShell>
  );
}
