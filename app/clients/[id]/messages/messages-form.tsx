"use client";

import { useState, useTransition } from "react";
import {
  closeFollowUp,
  createFollowUp,
  generateClientComms,
  saveCommsPrefs,
  savePractitionerComms,
  sendManualMessage,
  updateClientMessage,
} from "@/app/comms-actions";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import type { MessageRow, FollowUpRow } from "@/lib/comms-engine/load";
import type { ClientCommsPrefs, CommsPlan, PractitionerComms } from "@/lib/comms-engine/types";

export function MessagesForm({
  clientId,
  firstName,
  plan,
  prefs,
  practitioner,
  messages,
  followUps,
}: {
  clientId: string;
  firstName: string;
  plan: CommsPlan;
  prefs: ClientCommsPrefs;
  practitioner: PractitionerComms;
  messages: MessageRow[];
  followUps: FollowUpRow[];
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [manual, setManual] = useState("");
  const [followIssue, setFollowIssue] = useState("");
  const [followDue, setFollowDue] = useState("");
  const drafts = messages.filter((m) => ["DRAFT", "PENDING_APPROVAL", "SCHEDULED"].includes(m.automation_status));
  const thread = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            {plan.traffic} · fortnightly {plan.fortnightly.replaceAll("_", " ").toLowerCase()}
          </p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm">{plan.digest}</pre>
          {plan.why_no_message && <p className="mt-3 font-sans text-sm text-[var(--muted)]">{plan.why_no_message}</p>}
          {plan.messages.length > 0 && (
            <ul className="mt-3 list-disc pl-5 font-sans text-xs text-[var(--muted)]">
              {plan.messages.map((m) => (
                <li key={`${m.event_type}-${m.body.slice(0, 24)}`}>
                  {m.event_type.replaceAll("_", " ")} · {m.auto_send ? "may auto-send" : "needs review"} — {m.why[0]}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className={`${buttonClass} mt-4`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await generateClientComms(clientId);
                setMsg("error" in r ? r.error : `Created ${r.created} message${r.created === 1 ? "" : "s"}.`);
              })
            }
          >
            Generate from Layer 6
          </button>
        </article>

        {drafts.map((m) => (
          <DraftCard key={m.id} row={m} clientId={clientId} onDone={setMsg} />
        ))}

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Thread</p>
          <ol className="mt-3 space-y-3">
            {thread.length === 0 && <li className="font-sans text-sm text-[var(--muted)]">No messages yet.</li>}
            {thread.map((m) => (
              <li key={m.id} className="rounded-lg border border-[var(--line)] bg-white p-3">
                <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                  {m.direction === "IN" ? firstName : "Coach"} · {m.event_type.replaceAll("_", " ")} · {m.automation_status} ·{" "}
                  {new Date(m.sent_at ?? m.created_at).toLocaleString("en-AU")}
                </p>
                <p className="mt-2 whitespace-pre-line font-sans text-sm">{m.message_text}</p>
                {m.practitioner_notes && <p className="mt-2 font-sans text-xs text-[var(--muted)]">Why: {m.practitioner_notes}</p>}
              </li>
            ))}
          </ol>
        </article>

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Write as practitioner</p>
          <textarea className={`${inputClass} mt-2`} rows={3} value={manual} onChange={(e) => setManual(e.target.value)} />
          <button
            type="button"
            className={`${buttonClass} mt-3`}
            disabled={pending || !manual.trim()}
            onClick={() =>
              start(async () => {
                const r = await sendManualMessage({ client_id: clientId, text: manual.trim() });
                setMsg("error" in r ? r.error : "Sent.");
                if (!("error" in r)) setManual("");
              })
            }
          >
            Send in-app
          </button>
        </article>
      </div>

      <aside className="space-y-5">
        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Client preferences</p>
          <form
            className="mt-3 space-y-3 font-sans text-sm"
            action={(fd) => {
              start(async () => {
                const r = await saveCommsPrefs({
                  client_id: clientId,
                  prefs: {
                    preferred_name: String(fd.get("preferred_name") ?? ""),
                    preferred_contact_method: fd.get("preferred_contact_method") === "EMAIL" ? "EMAIL" : "IN_APP",
                    allow_automated_email: fd.get("allow_automated_email") === "on",
                    email_enabled: fd.get("email_enabled") === "on",
                    contact_frequency: String(fd.get("contact_frequency") ?? "STANDARD") as ClientCommsPrefs["contact_frequency"],
                    quiet_hours: String(fd.get("quiet_hours") ?? ""),
                    explained_absence: fd.get("explained_absence") === "on",
                    absence_note: String(fd.get("absence_note") ?? ""),
                  },
                });
                setMsg("error" in r ? r.error : "Preferences saved.");
              });
            }}
          >
            <label className="block text-xs text-[var(--muted)]">
              Preferred name
              <input className={`${inputClass} mt-1`} name="preferred_name" defaultValue={prefs.preferred_name} />
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Channel
              <select className={`${inputClass} mt-1`} name="preferred_contact_method" defaultValue={prefs.preferred_contact_method}>
                <option value="IN_APP">In-app</option>
                <option value="EMAIL">Email</option>
              </select>
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Frequency
              <select className={`${inputClass} mt-1`} name="contact_frequency" defaultValue={prefs.contact_frequency}>
                <option value="MINIMAL">Minimal</option>
                <option value="STANDARD">Standard</option>
                <option value="HIGH_SUPPORT">High support</option>
              </select>
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Quiet hours
              <input className={`${inputClass} mt-1`} name="quiet_hours" defaultValue={prefs.quiet_hours} placeholder="20:00–07:00" />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="allow_automated_email" defaultChecked={prefs.allow_automated_email} /> Allow automated email
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="email_enabled" defaultChecked={prefs.email_enabled} /> Email enabled
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="explained_absence" defaultChecked={prefs.explained_absence} /> Absence already explained
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Absence note
              <input className={`${inputClass} mt-1`} name="absence_note" defaultValue={prefs.absence_note} />
            </label>
            <button className={ghostButtonClass} disabled={pending}>
              Save prefs
            </button>
          </form>
        </article>

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Automation</p>
          <form
            className="mt-3 space-y-3 font-sans text-sm"
            action={(fd) => {
              start(async () => {
                const r = await savePractitionerComms({
                  tone: String(fd.get("tone") ?? "casual_professional") as PractitionerComms["tone"],
                  automation: String(fd.get("automation") ?? "LEVEL_1_ROUTINE_AUTO") as PractitionerComms["automation"],
                  max_routine_messages_per_week: Number(fd.get("max_routine_messages_per_week") ?? 2),
                  minimum_days_between_encouragement: Number(fd.get("minimum_days_between_encouragement") ?? 10),
                });
                setMsg("error" in r ? r.error : "Automation saved for this clinic.");
              });
            }}
          >
            <label className="block text-xs text-[var(--muted)]">
              Tone
              <select className={`${inputClass} mt-1`} name="tone" defaultValue={practitioner.tone}>
                <option value="concise">Concise</option>
                <option value="professional">Professional</option>
                <option value="casual_professional">Casual professional</option>
                <option value="encouraging">Encouraging</option>
              </select>
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Automation
              <select className={`${inputClass} mt-1`} name="automation" defaultValue={practitioner.automation}>
                <option value="LEVEL_0_MANUAL">Level 0 — drafts only</option>
                <option value="LEVEL_1_ROUTINE_AUTO">Level 1 — routine auto (default)</option>
                <option value="LEVEL_2_EXPANDED_AUTO">Level 2 — expanded auto</option>
              </select>
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Max routine / week
              <input className={`${inputClass} mt-1`} name="max_routine_messages_per_week" type="number" defaultValue={practitioner.max_routine_messages_per_week} />
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Days between encouragement
              <input className={`${inputClass} mt-1`} name="minimum_days_between_encouragement" type="number" defaultValue={practitioner.minimum_days_between_encouragement} />
            </label>
            <button className={ghostButtonClass} disabled={pending}>
              Save clinic defaults
            </button>
          </form>
        </article>

        <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Follow-ups</p>
          <ul className="mt-3 space-y-2 font-sans text-sm">
            {followUps.length === 0 && <li className="text-[var(--muted)]">None open.</li>}
            {followUps.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-2">
                <span>
                  {f.issue}
                  <span className="block text-xs text-[var(--muted)]">
                    {f.due_on} · {f.status}
                  </span>
                </span>
                {f.status !== "DONE" && (
                  <button type="button" className="underline" onClick={() => start(async () => { await closeFollowUp(f.id, clientId); })}>
                    Done
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form
            className="mt-3 space-y-2"
            action={() => {
              if (!followIssue.trim() || !followDue) return;
              start(async () => {
                const r = await createFollowUp({ client_id: clientId, issue: followIssue.trim(), due_on: followDue });
                setMsg("error" in r ? r.error : "Follow-up added.");
                if (!("error" in r)) {
                  setFollowIssue("");
                  setFollowDue("");
                }
              });
            }}
          >
            <input className={inputClass} placeholder="Check right knee" value={followIssue} onChange={(e) => setFollowIssue(e.target.value)} />
            <input className={inputClass} type="date" value={followDue} onChange={(e) => setFollowDue(e.target.value)} />
            <button className={ghostButtonClass} disabled={pending}>
              Add follow-up
            </button>
          </form>
        </article>
        {msg && <p className="font-sans text-sm">{msg}</p>}
      </aside>
    </div>
  );
}

function DraftCard({ row, clientId, onDone }: { row: MessageRow; clientId: string; onDone: (s: string) => void }) {
  const [text, setText] = useState(row.message_text);
  const [pending, start] = useTransition();
  return (
    <article className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
      <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
        {row.automation_status.replaceAll("_", " ")} · {row.event_type.replaceAll("_", " ")} · {row.priority}
      </p>
      <textarea className={`${inputClass} mt-3`} rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      {row.practitioner_notes && <p className="mt-2 font-sans text-xs text-[var(--muted)]">Why: {row.practitioner_notes}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateClientMessage({ id: row.id, client_id: clientId, text, status: "SENT" });
              onDone("error" in r ? r.error : "Sent.");
            })
          }
        >
          Approve & send
        </button>
        <button
          type="button"
          className={ghostButtonClass}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateClientMessage({ id: row.id, client_id: clientId, text, status: "DRAFT" });
              onDone("error" in r ? r.error : "Saved draft.");
            })
          }
        >
          Save edit
        </button>
        <button
          type="button"
          className={ghostButtonClass}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateClientMessage({ id: row.id, client_id: clientId, status: "CANCELLED" });
              onDone("error" in r ? r.error : "Discarded.");
            })
          }
        >
          Discard
        </button>
      </div>
    </article>
  );
}
