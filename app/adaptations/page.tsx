import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { TrafficDot } from "@/components/adaptation-board";
import type { Traffic } from "@/lib/adaptation-engine/types";
import { QueueActions } from "./queue-actions";
import { ClinicAutomation } from "./clinic-automation";

export default async function AdaptationsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: rows },
    { data: snapshots },
    { data: pending },
    { data: followUps },
    { data: sentWeek },
    { data: prac },
    { data: clients },
  ] = await Promise.all([
    supabase
      .from("adaptation_queue")
      .select("id, client_id, exercise_name, severity, issue, suggested_action, draft_message, date_detected, status, clients(first_name, last_name)")
      .order("date_detected", { ascending: false })
      .limit(80),
    supabase.from("program_adaptations").select("client_id, adaptation"),
    supabase
      .from("client_messages")
      .select("id, client_id, event_type, priority, message_text, automation_status, created_at, clients(first_name, last_name)")
      .in("automation_status", ["PENDING_APPROVAL", "DRAFT"])
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("comms_follow_ups")
      .select("id, client_id, issue, due_on, status, clients(first_name, last_name)")
      .eq("status", "OPEN")
      .order("due_on", { ascending: true })
      .limit(40),
    supabase
      .from("client_messages")
      .select("id")
      .eq("automation_status", "SENT")
      .eq("direction", "OUT")
      .gte("sent_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from("practitioner_comms").select("*").eq("practitioner_id", String(auth.claims.sub)).maybeSingle(),
    supabase.from("clients").select("id"),
  ]);

  const items = rows ?? [];
  const redQ = items.filter((r) => r.severity === "RED" && r.status === "NEW").length;
  const amberQ = items.filter((r) => r.severity === "AMBER" && r.status === "NEW").length;
  const greenQ = items.filter((r) => r.severity === "GREEN" && r.status === "NEW").length;

  const trafficOf = (snap: { adaptation: unknown }) => {
    const a = snap.adaptation as { client?: { traffic?: Traffic } } | null;
    return a?.client?.traffic ?? null;
  };
  const green = (snapshots ?? []).filter((s) => trafficOf(s) === "GREEN").length;
  const amber = (snapshots ?? []).filter((s) => trafficOf(s) === "AMBER").length;
  const red = (snapshots ?? []).filter((s) => trafficOf(s) === "RED").length;
  const overdue = (followUps ?? []).filter((f) => f.due_on <= today);
  const active = clients?.length ?? 0;

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Layers 6–7</p>
      <h1 className="mt-2 text-4xl">Exception dashboard</h1>
      <p className="mt-2 max-w-3xl font-sans text-sm text-[var(--muted)]">
        Routine coaching can send itself. Meaningful exceptions stay here until you review them. Saving an adaptation
        review drafts or sends Layer 7 messages from real logs — not from a timer.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <TrafficCard href="/adaptations#green" label="GREEN" count={green} hint="Progressing normally" />
        <TrafficCard href="/adaptations#amber" label="AMBER" count={amber} hint="Monitoring / minor issues" />
        <TrafficCard href="/adaptations#red" label="RED" count={red} hint="Practitioner review required" />
      </div>
      <p className="mt-3 font-sans text-sm text-[var(--muted)]">
        Active clients {active} · Queue NEW: RED {redQ} · AMBER {amberQ} · GREEN {greenQ} · Messages sent this week{" "}
        {(sentWeek ?? []).length} · Drafts {(pending ?? []).length} · Overdue follow-ups {overdue.length}
      </p>

      <ClinicAutomation
        tone={prac?.tone ?? "casual_professional"}
        automation={prac?.automation ?? "LEVEL_1_ROUTINE_AUTO"}
        maxRoutine={prac?.max_routine_messages_per_week ?? 2}
        minDays={prac?.minimum_days_between_encouragement ?? 10}
      />

      <h2 id="pending" className="mt-10 font-sans text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
        Messages awaiting approval
      </h2>
      <ul className="mt-3 space-y-3">
        {(pending ?? []).length === 0 && <li className="font-sans text-sm text-[var(--muted)]">Nothing waiting. Green clients stay quiet.</li>}
        {(pending ?? []).map((m) => {
          const client = Array.isArray(m.clients) ? m.clients[0] : m.clients;
          return (
            <li key={m.id} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
              <p className="font-sans text-sm">
                <Link className="underline" href={`/clients/${m.client_id}/messages`}>
                  {client?.first_name} {client?.last_name}
                </Link>
                <span className="text-[var(--muted)]">
                  {" "}
                  · {m.priority} · {m.event_type.replaceAll("_", " ")} · {m.automation_status.replaceAll("_", " ")}
                </span>
              </p>
              <p className="mt-2 font-sans text-sm italic">{m.message_text}</p>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 font-sans text-sm uppercase tracking-[0.16em] text-[var(--muted)]">Follow-ups</h2>
      <ul className="mt-3 space-y-2">
        {(followUps ?? []).length === 0 && <li className="font-sans text-sm text-[var(--muted)]">No open follow-ups.</li>}
        {(followUps ?? []).map((f) => {
          const client = Array.isArray(f.clients) ? f.clients[0] : f.clients;
          const late = f.due_on <= today;
          return (
            <li key={f.id} className="font-sans text-sm">
              <Link className="underline" href={`/clients/${f.client_id}/messages`}>
                {client?.first_name} {client?.last_name}
              </Link>
              <span className={late ? " text-red-800" : " text-[var(--muted)]"}>
                {" "}
                · {f.due_on} · {f.issue}
                {late ? " · overdue" : ""}
              </span>
            </li>
          );
        })}
      </ul>

      <h2 id="queue" className="mt-10 font-sans text-sm uppercase tracking-[0.16em] text-[var(--muted)]">
        Adaptation exceptions
      </h2>
      <ul className="mt-3 space-y-3">
        {items.length === 0 && (
          <li className="font-sans text-sm text-[var(--muted)]">No queued items. Save a client adaptation review to populate this list.</li>
        )}
        {items.map((row) => {
          const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
          return (
            <li key={row.id} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-sans text-sm">
                  <TrafficDot value={row.severity as Traffic} />{" "}
                  <Link className="underline" href={`/clients/${row.client_id}/adaptation`}>
                    {client?.first_name} {client?.last_name}
                  </Link>
                  {row.exercise_name ? ` · ${row.exercise_name}` : ""}
                  <span className="text-[var(--muted)]"> · {row.status}</span>
                  {" · "}
                  <Link className="underline" href={`/clients/${row.client_id}/messages`}>
                    Messages
                  </Link>
                </p>
                <QueueActions id={row.id} />
              </div>
              <p className="mt-2 font-sans text-sm">{row.issue}</p>
              {row.suggested_action && <p className="mt-1 font-sans text-xs text-[var(--muted)]">{row.suggested_action.replaceAll("_", " ")}</p>}
              {row.draft_message && <p className="mt-2 font-sans text-sm italic">{row.draft_message}</p>}
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}

function TrafficCard({ href, label, count, hint }: { href: string; label: string; count: number; hint: string }) {
  return (
    <a href={href} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
      <p className="font-sans text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-4xl">{count}</p>
      <p className="mt-1 font-sans text-sm text-[var(--muted)]">{hint}</p>
    </a>
  );
}
