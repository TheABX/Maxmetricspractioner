import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, ghostButtonClass } from "@/components/ui";
import { NutritionPrefChips } from "@/components/nutrition-prefs";
import { createClient } from "@/lib/supabase/server";
import { calendarDate, loadNutrition } from "@/lib/nutrition/load";
import { resolveEntry } from "@/lib/nutrition/entry";
import { SLOTS } from "@/lib/nutrition/meals";
import { goalLabel, goalWhy } from "@/lib/nutrition/targets";

export default async function PractitionerNutritionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/login");
  const [{ data: client }, loaded] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name").eq("id", id).single(),
    loadNutrition(supabase, id, calendarDate()),
  ]);
  if (!client) notFound();

  return (
    <AppShell practitionerEmail={String(auth.claims.email ?? "")}>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link className="underline" href={`/clients/${id}`}>
          {client.first_name} {client.last_name}
        </Link>{" "}
        · Nutrition
      </p>
      <h1 className="mt-2 text-4xl">Nutrition</h1>
      <p className="mt-2 max-w-3xl font-sans text-sm text-[var(--muted)]">
        Preferences come from the intake nutrition questions. Targets are estimated from the client record. The client
        plans and logs in their portal — this is the view, not a prescription pad.
      </p>
      <p className="mt-4">
        <Link className={ghostButtonClass} href={`/clients/${id}/intake`}>
          Intake answers
        </Link>
      </p>

      {!loaded.complete ? (
        <p className="mt-8 font-sans text-sm text-[var(--muted)]">
          Nutrition questions have not been answered yet. They are at the end of the intake questionnaire, and also on
          the Nutrition tab in the client portal.
        </p>
      ) : (
        <>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
              <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Targets</h2>
              <p className="mt-3 font-sans text-sm text-[var(--muted)]">Estimated daily energy</p>
              <p className="text-3xl">{loaded.targets.tdee?.toLocaleString("en-AU") ?? "—"} kcal</p>
              <p className="mt-3 font-sans text-sm text-[var(--muted)]">Target daily intake · {goalLabel(loaded.targets.goal)}</p>
              <p className="text-3xl">{loaded.targets.targetKcal?.toLocaleString("en-AU") ?? "—"} kcal</p>
              <p className="mt-2 font-sans text-sm text-[var(--muted)]">{goalWhy(loaded.targets.goal)}</p>
              {loaded.targets.targetKcal != null && (
                <p className="mt-3 font-sans text-sm">
                  Protein {loaded.targets.proteinG} g · Carbs {loaded.targets.carbG} g · Fat {loaded.targets.fatG} g
                </p>
              )}
              {loaded.targets.missing.length > 0 && (
                <p className="mt-3 font-sans text-sm text-[var(--accent-2)]">
                  Add {loaded.targets.missing.join(", ")} on the client record to finish the estimate.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
              <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Preferences</h2>
              <div className="mt-3">
                <NutritionPrefChips answers={loaded.answers} prefs={loaded.prefs} />
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
            <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Today in their portal</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(["plan", "log"] as const).map((kind) => (
                <div key={kind}>
                  <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    {kind === "plan" ? "Planned" : "Logged"}
                  </p>
                  <ul className="mt-2 space-y-1 font-sans text-sm">
                    {SLOTS.map((slot) => {
                      const items = loaded.entries.filter((e) => e.kind === kind && e.slot === slot.key);
                      if (!items.length) return null;
                      return (
                        <li key={slot.key}>
                          <span className="text-[var(--muted)]">{slot.label}: </span>
                          {items.map((e) => resolveEntry(e)?.name ?? e.custom_name ?? e.meal_slug).join(", ")}
                        </li>
                      );
                    })}
                    {loaded.entries.filter((e) => e.kind === kind).length === 0 && (
                      <li className="text-[var(--muted)]">Nothing {kind === "plan" ? "planned" : "logged"} yet.</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
