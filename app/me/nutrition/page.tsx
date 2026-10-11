import { ClientShell } from "@/components/client-shell";
import { NutritionPrefChips } from "@/components/nutrition-prefs";
import { requireClientPage } from "@/lib/auth/client-page";
import { inferredGoalFromTraining } from "@/lib/nutrition/questionnaire";
import { calendarDate, loadNutrition, mealPhotoUrls } from "@/lib/nutrition/load";
import type { EntryKind } from "@/lib/nutrition/types";
import { NutritionBoard } from "./nutrition-board";
import { NutritionForm } from "./nutrition-form";

export default async function ClientNutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; mode?: string }>;
}) {
  const { supabase, client } = await requireClientPage();
  const q = await searchParams;
  const date = q.date && /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? q.date : calendarDate();
  const mode: EntryKind = q.mode === "log" ? "log" : "plan";
  const loaded = await loadNutrition(supabase, client.id, date);
  const photoUrls = await mealPhotoUrls(supabase, loaded.entries);
  const seedAnswers = {
    nutrition_goal: inferredGoalFromTraining(loaded.answers.primary_goal),
    current_weight_kg: loaded.anthro.bodyweightKg,
    ...loaded.answers,
  };

  return (
    <ClientShell name={`${client.first_name} ${client.last_name}`} active="nutrition">
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Nutrition</p>
      <h1 className="mt-2 text-3xl">Eat on purpose</h1>
      <p className="mt-2 font-sans text-sm text-[var(--muted)]">
        Targets come from your body and the goal you chose — maintain, lean, or build. Plan the day, then log what
        actually happened. They are two different jobs.
      </p>

      {!loaded.complete ? (
        <>
          <p className="mt-6 font-sans text-sm">
            A few food questions first. These also sit at the end of the intake questionnaire for anyone still
            onboarding.
          </p>
          <NutritionForm answers={seedAnswers} />
        </>
      ) : (
        <>
          <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
            <p className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Your preferences</p>
            <div className="mt-3">
              <NutritionPrefChips answers={loaded.answers} prefs={loaded.prefs} />
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer font-sans text-sm underline">Update preferences</summary>
              <NutritionForm answers={loaded.answers} submitLabel="Update preferences" />
            </details>
          </div>
          <NutritionBoard
            date={date}
            mode={mode}
            prefs={loaded.prefs}
            targets={loaded.targets}
            entries={loaded.entries}
            favorites={loaded.favorites}
            photoUrls={photoUrls}
          />
        </>
      )}
    </ClientShell>
  );
}
