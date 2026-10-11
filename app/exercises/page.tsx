import Link from "next/link";
import { redirect } from "next/navigation";
import { seedExerciseCatalog } from "@/app/engine-actions";
import { AppShell, buttonClass, ghostButtonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ensureCatalog, loadFamilies } from "@/lib/exercise-kb/load";
import { LibraryTable } from "./library-table";

export default async function ExercisesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const [library, families] = await Promise.all([ensureCatalog(supabase), loadFamilies(supabase)]);

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")} wide>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Knowledge base</p>
      <h1 className="mt-2 text-4xl">Exercise library</h1>
      <p className="mt-2 max-w-3xl font-sans text-sm text-[var(--muted)]">
        Source of truth for automatic and manual programming. New exercises stay off automatic selection until you approve
        them. Age is not a property of an exercise.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link className={buttonClass} href="/exercises/new">
          + Add exercise
        </Link>
        <Link className={ghostButtonClass} href="/exercises/families">
          Families
        </Link>
        <Link className={ghostButtonClass} href="/exercises/tags">
          Manage tags
        </Link>
        <form action={seedExerciseCatalog}>
          <button className={ghostButtonClass}>Sync catalog</button>
        </form>
      </div>
      <div className="mt-6">
        <LibraryTable library={library} families={families} />
      </div>
    </AppShell>
  );
}
