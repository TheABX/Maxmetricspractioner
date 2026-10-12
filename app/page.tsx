import { createClient } from "@/lib/supabase/server";
import { AppShell, Card } from "@/components/ui";
import { MissingSupabaseConfig } from "@/components/missing-supabase-config";
import { StatusPill } from "@/components/action-button";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!getSupabasePublicEnv()) {
    return <MissingSupabaseConfig />;
  }

  const supabase = await createClient();
  let claims: { email?: string } | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    claims = data?.claims ?? null;
  } catch {
    redirect("/login");
  }
  if (!claims) redirect("/login");

  const { q } = await searchParams;
  let clientQuery = supabase
    .from("clients")
    .select("id, first_name, last_name, dob, sex")
    .order("last_name")
    .limit(20);
  if (q) {
    clientQuery = clientQuery.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
  }
  const [{ data: clients }, { data: recent }, { data: reports }, { data: draftPrograms }, { data: recentLogs }, { data: newResponses }, { data: queue }, { data: snapshots }, { data: pendingMsgs }] =
    await Promise.all([
      clientQuery,
      supabase
        .from("assessment_sessions")
        .select("id, assessment_date, assessment_type, status, clients(first_name, last_name)")
        .in("status", ["draft", "in_progress"])
        .order("assessment_date", { ascending: false })
        .limit(8),
      supabase
        .from("generated_reports")
        .select("id, title, status, generated_at, assessment_session_id")
        .order("generated_at", { ascending: false })
        .limit(8),
      supabase
        .from("programs")
        .select("id, title, version, status, clients(first_name, last_name)")
        .in("status", ["draft", "approved"])
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("session_logs")
        .select("id, completed_at, skipped, overall_rpe, notes, updated_at, clients(first_name, last_name), program_sessions(week, day, title, program_id)")
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("questionnaire_responses")
        .select("id, submitted_at, client_id, clients(first_name, last_name)")
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(20),
      supabase
        .from("adaptation_queue")
        .select("id, severity, issue, status, client_id, clients(first_name, last_name)")
        .eq("status", "NEW")
        .order("date_detected", { ascending: false })
        .limit(8),
      supabase.from("program_adaptations").select("client_id, adaptation"),
      supabase
        .from("client_messages")
        .select("id, client_id, event_type, priority, automation_status, clients(first_name, last_name)")
        .in("automation_status", ["PENDING_APPROVAL", "DRAFT"])
        .limit(8),
    ]);
  const trafficCount = (color: string) =>
    (snapshots ?? []).filter((s) => (s.adaptation as { client?: { traffic?: string } } | null)?.client?.traffic === color).length;

  const nameOf = (clients: unknown) => {
    const c = (Array.isArray(clients) ? clients[0] : clients) as { first_name?: string; last_name?: string } | null;
    return [c?.first_name, c?.last_name].filter(Boolean).join(" ") || "Client";
  };

  const seenClients = new Set<string>();
  const reviewQuestionnaires = (newResponses ?? []).filter((q) => {
    if (seenClients.has(q.client_id)) return false;
    seenClients.add(q.client_id);
    return true;
  });
  const unsentReports = (reports ?? []).filter((r) => r.status !== "sent");
  const awaitingEmpty =
    (draftPrograms ?? []).length === 0 &&
    unsentReports.length === 0 &&
    reviewQuestionnaires.length === 0 &&
    (pendingMsgs ?? []).length === 0;

  return (
    <AppShell practitionerEmail={String(claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Practitioner dashboard</p>
      <h1 className="mt-2 text-4xl">Clinic home</h1>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        Create a client, open an assessment session, import force-plate Excel, then generate a report from stored results.
      </p>

      <form className="mt-8 flex gap-3" action="/">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search clients"
          className="w-full max-w-md rounded-md border border-[var(--line)] bg-white px-3 py-2 font-sans"
        />
        <button className="rounded-md bg-[var(--accent)] px-4 py-2 font-sans text-sm text-white">Search</button>
        <Link href="/clients/new" className="rounded-md border border-[var(--line)] bg-white px-4 py-2 font-sans text-sm">
          Add client
        </Link>
      </form>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Card title="Client traffic" href="/adaptations">
          <p className="font-sans text-sm">
            GREEN {trafficCount("GREEN")} · AMBER {trafficCount("AMBER")} · RED {trafficCount("RED")}
          </p>
          <p className="mt-2 font-sans text-xs text-[var(--muted)]">
            {(pendingMsgs ?? []).length} draft / pending messages
          </p>
        </Card>
        <Card title="Review queue" titleHref="/adaptations">
          <ul className="space-y-2 font-sans text-sm">
            {(queue ?? []).length === 0 && (
              <li>
                <Link className="block rounded-md border border-[var(--line)] bg-white px-3 py-2 underline" href="/adaptations">
                  Open review queue
                </Link>
              </li>
            )}
            {(queue ?? []).map((q) => (
              <li key={q.id}>
                <Link className="block rounded-md border border-[var(--line)] bg-white px-3 py-2" href={`/clients/${q.client_id}/adaptation`}>
                  <span className="underline">
                    {q.severity} · {nameOf(q.clients)}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">{q.issue}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Clients">
          <ul className="space-y-2 font-sans text-sm">
            {(clients ?? []).length === 0 && <li>No clients yet.</li>}
            {(clients ?? []).map((c) => (
              <li key={c.id}>
                <Link className="underline" href={`/clients/${c.id}`}>
                  {c.last_name}, {c.first_name}
                </Link>
                <span className="text-[var(--muted)]"> · {c.sex}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Recent assessments">
          <ul className="space-y-2 font-sans text-sm">
            {(recent ?? []).length === 0 && <li>No open assessments.</li>}
            {(recent ?? []).map((a) => {
              const client = Array.isArray(a.clients) ? a.clients[0] : a.clients;
              return (
                <li key={a.id}>
                  <Link className="underline" href={`/assessments/${a.id}`}>
                    {client?.first_name} {client?.last_name} · {a.assessment_date}
                  </Link>
                  <span className="text-[var(--muted)]"> · {a.status}</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Reports">
          <ul className="space-y-2 font-sans text-sm">
            {(reports ?? []).length === 0 && <li>No generated reports yet.</li>}
            {(reports ?? []).map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <StatusPill status={r.status} />
                <Link className="underline" href={`/assessments/${r.assessment_session_id}`}>
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Awaiting approval">
          <ul className="space-y-2 font-sans text-sm">
            {awaitingEmpty && (
              <li className="text-[var(--muted)]">Nothing waiting. Drafts, unsent reports, questionnaires, and messages that need you appear here.</li>
            )}
            {reviewQuestionnaires.map((q) => (
              <li key={q.id}>
                <Link
                  className="block rounded-md border border-[var(--line)] bg-white px-3 py-2"
                  href={`/clients/${q.client_id}/intake`}
                >
                  <span className="underline">Review questionnaire · {nameOf(q.clients)}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    Submitted {q.submitted_at ? new Date(q.submitted_at).toLocaleDateString("en-AU") : ""}
                  </span>
                </Link>
              </li>
            ))}
            {(pendingMsgs ?? []).map((m) => (
              <li key={m.id}>
                <Link
                  className="block rounded-md border border-[var(--line)] bg-white px-3 py-2"
                  href={`/clients/${m.client_id}/messages`}
                >
                  <span className="underline">
                    Needs approval · {nameOf(m.clients)}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    {String(m.event_type).replaceAll("_", " ")} · {m.automation_status === "DRAFT" ? "draft" : "pending approval"}
                  </span>
                </Link>
              </li>
            ))}
            {(draftPrograms ?? []).map((p) => (
              <li key={p.id}>
                <Link className="block rounded-md border border-[var(--line)] bg-white px-3 py-2" href={`/programs/${p.id}`}>
                  <span className="flex items-center gap-2">
                    <StatusPill status={p.status} />
                    <span className="underline">
                      {nameOf(p.clients)} — {p.title} v{p.version}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {unsentReports.map((r) => (
              <li key={r.id}>
                <Link className="block rounded-md border border-[var(--line)] bg-white px-3 py-2" href={`/assessments/${r.assessment_session_id}`}>
                  <span className="flex items-center gap-2">
                    <StatusPill status={r.status} />
                    <span className="underline">{r.title}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Client activity">
          <ul className="space-y-2 font-sans text-sm">
            {(recentLogs ?? []).length === 0 && <li className="text-[var(--muted)]">No sessions logged yet.</li>}
            {(recentLogs ?? []).map((l) => {
              const c = Array.isArray(l.clients) ? l.clients[0] : l.clients;
              const s = Array.isArray(l.program_sessions) ? l.program_sessions[0] : l.program_sessions;
              return (
                <li key={l.id}>
                  <Link className="underline" href={`/programs/${s?.program_id}?week=${s?.week ?? 1}`}>
                    {c?.first_name} {c?.last_name} · Wk {s?.week} D{s?.day}
                  </Link>
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {l.completed_at ? "completed" : l.skipped ? "skipped" : "started"}
                    {l.overall_rpe != null ? ` · RPE ${l.overall_rpe}` : ""}
                  </span>
                  {l.notes && <div className="text-xs text-[var(--muted)]">“{l.notes}”</div>}
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Settings" href="/setup">
          <p className="font-sans text-sm">
            Run the database schema, then add reference datasets later. Do not hard-code green/red cut-offs.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
