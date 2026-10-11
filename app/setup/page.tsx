import { readFile } from "fs/promises";
import path from "path";
import { AppShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function SetupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260912100000_force_plate_v1.sql"),
    "utf8",
  );
  const sql2 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260912200000_isometric_protocols.sql"),
    "utf8",
  );
  const sql3 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260913100000_grip_strength.sql"),
    "utf8",
  );
  const sql4 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260913200000_mobility.sql"),
    "utf8",
  );
  const sql5 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260913300000_programs_and_client_portal.sql"),
    "utf8",
  );
  const sql6 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260914090000_programming_profiles.sql"),
    "utf8",
  );
  const sql7 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260914100000_priorities_and_structure.sql"),
    "utf8",
  );
  const sql8 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260914110000_exercise_knowledge_base.sql"),
    "utf8",
  );
  const sql9 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260914120000_exercise_library_manager.sql"),
    "utf8",
  );
  const sql10 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260914130000_prescription_dosage.sql"),
    "utf8",
  );
  const sql11 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260914140000_progression_adaptation.sql"),
    "utf8",
  );
  const sql12 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260914150000_communication_coaching.sql"),
    "utf8",
  );
  const sql13 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260914160000_retesting_longitudinal.sql"),
    "utf8",
  );
  const sql14 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260916100000_nutrition.sql"),
    "utf8",
  );
  const sql15 = await readFile(
    path.join(process.cwd(), "supabase/migrations/20260916110000_nutrition_photos.sql"),
    "utf8",
  );

  return (
    <AppShell practitionerEmail={data?.claims?.email as string | undefined}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Setup</p>
      <h1 className="mt-2 text-4xl">Connect this app to Supabase</h1>
      <ol className="mt-6 list-decimal space-y-3 pl-5 font-sans text-sm leading-6">
        <li>
          Project URL is already in <code>.env.local</code>:{" "}
          <code>https://ogbfesrgmpphyejqnajt.supabase.co</code>
        </li>
        <li>
          Open{" "}
          <a className="underline" href="https://supabase.com/dashboard/project/ogbfesrgmpphyejqnajt/sql/new">
            SQL Editor
          </a>{" "}
          and run the schema files below.
        </li>
        <li>
          In Authentication → Providers, keep Email enabled. For local testing you can disable “Confirm email”.
        </li>
        <li>Create your practitioner account on the login page, then add a client.</li>
        <li>
          Optional email: add <code>RESEND_API_KEY</code>, <code>EMAIL_FROM</code> and <code>NEXT_PUBLIC_APP_URL</code>{" "}
          to <code>.env.local</code>. Without them, invites and “sent” notifications are recorded but not emailed,
          and the join link is shown to you to share manually. Meal photo estimates need <code>OPENAI_API_KEY</code>{" "}
          (or <code>ANTHROPIC_API_KEY</code>) and a server restart.
        </li>
      </ol>
      <pre className="mt-8 max-h-[320px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql}
      </pre>
      <pre className="mt-4 max-h-[240px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql2}
      </pre>
      <pre className="mt-4 max-h-[160px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql3}
      </pre>
      <pre className="mt-4 max-h-[200px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql4}
      </pre>
      <pre className="mt-4 max-h-[200px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql5}
      </pre>
      <pre className="mt-4 max-h-[200px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql6}
      </pre>
      <pre className="mt-4 max-h-[200px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql7}
      </pre>
      <pre className="mt-4 max-h-[200px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql8}
      </pre>
      <pre className="mt-4 max-h-[200px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql9}
      </pre>
      <pre className="mt-4 max-h-[200px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql10}
      </pre>
      <pre className="mt-4 max-h-[200px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql11}
      </pre>
      <pre className="mt-4 max-h-[200px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql12}
      </pre>
      <pre className="mt-4 max-h-[200px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql13}
      </pre>
      <pre className="mt-4 max-h-[200px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql14}
      </pre>
      <pre className="mt-4 max-h-[200px] overflow-auto rounded-xl border border-[var(--line)] bg-white p-4 font-mono text-[11px] leading-5">
        {sql15}
      </pre>
    </AppShell>
  );
}
