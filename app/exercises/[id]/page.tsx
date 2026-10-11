import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ensureCatalog, loadFamilies, loadRelationships, loadTags } from "@/lib/exercise-kb/load";
import { blankExercise } from "@/lib/exercise-kb/types";
import { ExerciseEditor } from "./exercise-editor";

export default async function ExerciseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const isNew = id === "new";
  const [library, families, tags] = await Promise.all([ensureCatalog(supabase), loadFamilies(supabase), loadTags(supabase)]);
  const current = isNew ? null : library.find((e) => e.id === id);
  if (!isNew && !current) notFound();
  const graph = isNew ? [] : await loadRelationships(supabase, library);
  const related = {
    regressions: graph.filter((r) => r.from_slug === current?.slug && r.type === "REGRESSION").map((r) => r.to_slug),
    progressions: graph.filter((r) => r.from_slug === current?.slug && r.type === "PROGRESSION").map((r) => r.to_slug),
    alternatives: graph.filter((r) => r.from_slug === current?.slug && r.type === "ALTERNATIVE").map((r) => r.to_slug),
    similar: graph.filter((r) => r.from_slug === current?.slug && r.type === "SIMILAR_STIMULUS").map((r) => r.to_slug),
  };
  const [{ data: assigns }, { data: mastery }, { data: clients }] = isNew
    ? [{ data: [] }, { data: [] }, { data: [] }]
    : await Promise.all([
        supabase.from("exercise_tag_assignments").select("tag_id").eq("exercise_id", id),
        supabase.from("client_exercise_mastery").select("client_id, mastery_level, last_assessed").eq("exercise_id", id),
        supabase.from("clients").select("id, first_name, last_name").order("last_name").limit(80),
      ]);

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href="/exercises">
          Exercise library
        </Link>
      </p>
      <h1 className="mt-2 text-4xl">{isNew ? "Add exercise" : current?.name}</h1>
      <p className="mt-2 max-w-2xl font-sans text-sm text-[var(--muted)]">
        {isNew
          ? "Saved as pending review with AI selection off. Approve when the metadata is ready."
          : current?.used_count
            ? `Used on ${current.used_count} program line${current.used_count === 1 ? "" : "s"}. Deactivate instead of deleting.`
            : "Not yet used in a client program."}
      </p>
      <ExerciseEditor
        id={isNew ? undefined : id}
        isNew={isNew}
        initial={current ?? blankExercise()}
        slugs={library.map((e) => ({ slug: e.slug, name: e.name }))}
        related={related}
        families={families}
        tags={tags}
        selectedTagIds={(assigns ?? []).map((a) => a.tag_id)}
        familyId={current?.family_id ?? null}
        record={current}
        clients={(clients ?? []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }))}
        mastery={mastery ?? []}
      />
    </AppShell>
  );
}
