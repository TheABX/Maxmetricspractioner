import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/ui";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("last_name");

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl">Clients</h1>
          <p className="mt-2 text-[var(--muted)]">Permanent records. Assessments sit underneath each person.</p>
        </div>
        <Link href="/clients/new" className="rounded-md bg-[var(--accent)] px-4 py-2 font-sans text-sm text-white">
          Add client
        </Link>
      </div>
      <div className="mt-8 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)]">
        <table className="w-full font-sans text-sm">
          <thead className="bg-[#f7f1e6] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">DOB</th>
              <th className="px-4 py-3">Sex</th>
              <th className="px-4 py-3">Height</th>
              <th className="px-4 py-3">Profile weight</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c) => (
              <tr key={c.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-3">
                  <Link className="underline" href={`/clients/${c.id}`}>
                    {c.first_name} {c.last_name}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.dob}</td>
                <td className="px-4 py-3">{c.sex}</td>
                <td className="px-4 py-3">{c.height_cm} cm</td>
                <td className="px-4 py-3">{c.bodyweight_kg} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
