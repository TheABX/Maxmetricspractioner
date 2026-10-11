import { ClientShell } from "@/components/client-shell";
import { requireClientPage } from "@/lib/auth/client-page";
import { OpenReportButton } from "./open-report";

export default async function ClientReportPage() {
  const { supabase, client } = await requireClientPage();
  const { data: reports } = await supabase
    .from("generated_reports")
    .select("id, title, generated_at, sent_at, assessment_session_id")
    .eq("client_id", client.id)
    .eq("status", "sent")
    .order("sent_at", { ascending: false });

  return (
    <ClientShell name={`${client.first_name} ${client.last_name}`} active="report">
      <h1 className="text-3xl">Your reports</h1>
      <p className="mt-1 font-sans text-sm text-[var(--muted)]">
        Each assessment produces a report. Retests are compared against the previous one.
      </p>
      <div className="mt-5 grid gap-3">
        {(reports ?? []).length === 0 && (
          <p className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4 font-sans text-sm text-[var(--muted)]">
            No report has been released yet.
          </p>
        )}
        {(reports ?? []).map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div>
              <h2 className="text-lg">{r.title}</h2>
              <p className="font-sans text-xs text-[var(--muted)]">
                Released {r.sent_at ? new Date(r.sent_at).toLocaleDateString("en-AU") : ""}
              </p>
            </div>
            <OpenReportButton reportId={r.id} />
          </div>
        ))}
      </div>
    </ClientShell>
  );
}
