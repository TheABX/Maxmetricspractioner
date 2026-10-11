import { ClientShell } from "@/components/client-shell";
import { requireClientPage } from "@/lib/auth/client-page";
import { CoachBox } from "./coach-box";

export default async function ClientMessagesPage() {
  const { supabase, client } = await requireClientPage();
  const { data: rows } = await supabase
    .from("client_messages")
    .select("id, message_text, direction, created_at, sent_at, event_type")
    .eq("client_id", client.id)
    .order("created_at", { ascending: true })
    .limit(80);

  return (
    <ClientShell name={`${client.first_name} ${client.last_name}`} active="messages">
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Messages</p>
      <h1 className="mt-2 text-3xl">Your coach notes</h1>
      <p className="mt-2 font-sans text-sm text-[var(--muted)]">
        Short notes from your program — progress, check-ins, and answers to simple questions. This is not a medical
        service.
      </p>
      <ol className="mt-6 space-y-3">
        {(rows ?? []).length === 0 && <li className="font-sans text-sm text-[var(--muted)]">No messages yet.</li>}
        {(rows ?? []).map((m) => (
          <li key={m.id} className={`rounded-xl border border-[var(--line)] p-4 ${m.direction === "IN" ? "bg-white" : "bg-[var(--card)]"}`}>
            <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
              {m.direction === "IN" ? "You" : "Coach"} · {new Date(m.sent_at ?? m.created_at).toLocaleString("en-AU")}
            </p>
            <p className="mt-2 whitespace-pre-line font-sans text-sm">{m.message_text}</p>
          </li>
        ))}
      </ol>
      <CoachBox />
    </ClientShell>
  );
}
