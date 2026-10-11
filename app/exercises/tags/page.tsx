import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { loadTags } from "@/lib/exercise-kb/load";
import { TagsForm } from "./tags-form";

export default async function TagsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const tags = await loadTags(supabase);
  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href="/exercises">
          Exercise library
        </Link>{" "}
        · Tags
      </p>
      <h1 className="mt-2 text-4xl">Manage tags</h1>
      <p className="mt-2 max-w-2xl font-sans text-sm text-[var(--muted)]">
        Tags supplement structured fields. Deactivate instead of deleting so historical assignments stay intact.
      </p>
      <TagsForm tags={tags} />
    </AppShell>
  );
}
