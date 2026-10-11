import Link from "next/link";
import { clientSignOut } from "@/app/client-actions";
import { createClient } from "@/lib/supabase/server";
import { resolveViewer } from "@/lib/auth/role";
import { loadLatestQuestionnaire, questionnaireIsOpen } from "@/lib/questionnaire/access";

export async function ClientShell({
  children,
  name,
  active,
}: {
  children: React.ReactNode;
  name: string;
  active?: "home" | "program" | "report" | "questionnaire" | "messages" | "progress" | "nutrition";
}) {
  const supabase = await createClient();
  const viewer = await resolveViewer(supabase);
  const latest = viewer.role === "client" ? await loadLatestQuestionnaire(supabase, viewer.clientId) : null;
  const showQuestionnaire = questionnaireIsOpen(latest);
  const link = (href: string, label: string, key: NonNullable<typeof active>) => (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 ${active === key ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <Link href="/me" className="text-sm uppercase tracking-[0.2em]">
            MAXMetrics
          </Link>
          <nav className="flex flex-wrap items-center gap-1 font-sans text-sm">
            {link("/me", "Today", "home")}
            {link("/me/program", "Train", "program")}
            {link("/me/nutrition", "Nutrition", "nutrition")}
            {link("/me/messages", "Messages", "messages")}
            {link("/me/progress", "Progress", "progress")}
            {link("/me/report", "Report", "report")}
            {showQuestionnaire && link("/me/questionnaire", "Questionnaire", "questionnaire")}
          </nav>
          <div className="flex items-center gap-3 font-sans text-xs text-[var(--muted)]">
            <span className="hidden sm:inline">{name}</span>
            <form action={clientSignOut}>
              <button className="underline">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-6">{children}</main>
    </div>
  );
}
