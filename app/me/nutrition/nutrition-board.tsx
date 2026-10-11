"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { chooseFavorite, chooseMeal, logWhatIPlanned, removeNutritionEntry, toggleFavorite } from "@/app/nutrition-actions";
import { buttonClass, ghostButtonClass } from "@/components/ui";
import { mealsForSlot } from "@/lib/nutrition/filter";
import { favoriteAsMeal, matchingFavorite } from "@/lib/nutrition/favorites";
import { entryTotals, resolveEntry } from "@/lib/nutrition/entry";
import { SLOTS } from "@/lib/nutrition/meals";
import { shiftDate } from "@/lib/nutrition/load";
import { goalLabel, goalWhy } from "@/lib/nutrition/targets";
import type { EnergyTargets, EntryKind, FavoriteMeal, Meal, MealSlot, NutritionEntry, NutritionPrefs } from "@/lib/nutrition/types";
import { PhotoCard, PhotoTrigger } from "./photo-log";

function fmt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-AU");
}

function dayLabel(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function Bar({ value, max, tone = "good" }: { value: number; max: number; tone?: "good" | "over" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
      <div
        className={`h-full rounded-full ${tone === "over" ? "bg-[var(--accent-2)]" : "bg-[var(--accent)]"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function NutritionBoard({
  date,
  mode,
  prefs,
  targets,
  entries,
  favorites = [],
  photoUrls = {},
}: {
  date: string;
  mode: EntryKind;
  prefs: NutritionPrefs;
  targets: EnergyTargets;
  entries: NutritionEntry[];
  favorites?: FavoriteMeal[];
  photoUrls?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const go = (nextDate: string, nextMode: EntryKind) => {
    router.push(`/me/nutrition?date=${nextDate}&mode=${nextMode}`);
  };

  const planned = entries.filter((e) => e.kind === "plan");
  const logged = entries.filter((e) => e.kind === "log");
  const active = mode === "plan" ? planned : logged;
  const planSum = entryTotals(planned);
  const logSum = entryTotals(logged);
  const shown = mode === "plan" ? planSum : logSum;
  const target = targets.targetKcal ?? 0;
  const over = target > 0 && shown.kcal > target + 40;

  const bySlot = (slot: MealSlot) => active.filter((e) => e.slot === slot);
  const options = useMemo(() => {
    const map = {} as Record<MealSlot, Meal[]>;
    for (const s of SLOTS) map[s.key] = mealsForSlot(s.key, prefs, targets);
    return map;
  }, [prefs, targets]);

  const act = (fn: () => Promise<{ error?: string } | void>) => {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r && "error" in r && r.error) setErr(r.error);
    });
  };

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <p className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Daily target</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Estimated daily energy</p>
            <p className="mt-1 text-3xl">{fmt(targets.tdee)} kcal</p>
            <p className="mt-1 font-sans text-xs text-[var(--muted)]">What you likely burn on a typical day.</p>
          </div>
          <div>
            <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Target daily intake</p>
            <p className="mt-1 text-3xl">{fmt(targets.targetKcal)} kcal</p>
            <p className="mt-1 font-sans text-sm">
              {goalLabel(targets.goal)}
              <span className="text-[var(--muted)]"> — {goalWhy(targets.goal)}</span>
            </p>
          </div>
        </div>
        {targets.targetKcal != null && (
          <p className="mt-4 font-sans text-sm text-[var(--muted)]">
            Protein {fmt(targets.proteinG)} g · Carbs {fmt(targets.carbG)} g · Fat {fmt(targets.fatG)} g
          </p>
        )}
        {targets.missing.length > 0 && (
          <p className="mt-3 font-sans text-sm text-[var(--accent-2)]">
            Missing {targets.missing.join(", ")} — ask your practitioner to add them, or enter your current weight in
            preferences.
          </p>
        )}
        <p className="mt-3 font-sans text-xs text-[var(--muted)]">{targets.method}</p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--card)] p-1 font-sans text-sm">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 ${mode === "plan" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
            onClick={() => go(date, "plan")}
          >
            Plan
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 ${mode === "log" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
            onClick={() => go(date, "log")}
          >
            Log
          </button>
        </div>
        <div className="flex items-center gap-2 font-sans text-sm">
          <button type="button" className={ghostButtonClass} onClick={() => go(shiftDate(date, -1), mode)}>
            ←
          </button>
          <span className="min-w-[9rem] text-center">{dayLabel(date)}</span>
          <button type="button" className={ghostButtonClass} onClick={() => go(shiftDate(date, 1), mode)}>
            →
          </button>
        </div>
      </div>

      <p className="font-sans text-sm text-[var(--muted)]">
        {mode === "plan"
          ? "Plan is the day you intend to eat. Scroll a slot and tap a meal — breakfast, lunch and dinner hold one choice; snacks can hold several."
          : "Log is what you actually ate. Tap + to upload the meal you just had. Save it to favourites and it stays in your list."}
      </p>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              {mode === "plan" ? "Planned" : "Logged"} · {dayLabel(date)}
            </p>
            <p className={`mt-1 text-2xl ${over ? "text-[var(--accent-2)]" : ""}`}>
              {fmt(shown.kcal)}
              <span className="text-base text-[var(--muted)]"> / {fmt(targets.targetKcal)} kcal</span>
            </p>
            <p className="mt-1 font-sans text-xs text-[var(--muted)]">
              P {fmt(shown.protein)} · C {fmt(shown.carb)} · F {fmt(shown.fat)}
              {mode === "plan" ? ` · logged ${fmt(logSum.kcal)}` : ` · planned ${fmt(planSum.kcal)}`}
            </p>
          </div>
          {mode === "log" && planned.length > 0 && (
            <button
              type="button"
              className={ghostButtonClass}
              disabled={pending}
              onClick={() => act(() => logWhatIPlanned(date))}
            >
              Log what I planned
            </button>
          )}
        </div>
        <div className="mt-3">
          <Bar value={shown.kcal} max={target || 1} tone={over ? "over" : "good"} />
        </div>
        {err && <p className="mt-2 font-sans text-sm text-[var(--accent-2)]">{err}</p>}
      </section>

      {SLOTS.filter((s) => s.key !== "snack" || prefs.mealsPerDay !== "3").map((slot) => {
        const chosen = bySlot(slot.key);
        const budget = targets.slots[slot.key].kcal;
        return (
          <section key={slot.key}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl">{slot.label}</h2>
                <PhotoTrigger slot={slot.key} date={date} kind={mode} />
              </div>
              <p className="font-sans text-xs text-[var(--muted)]">
                {budget > 0 ? `Around ${fmt(budget)} kcal` : "Optional"} · {slot.hint}
              </p>
            </div>

            {chosen.length > 0 && (
              <ul className="mt-3 space-y-2">
                {chosen.map((e) => {
                  const meal = resolveEntry(e);
                  if (!meal) return null;
                  return (
                    <li key={e.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--accent)] bg-[var(--card)] px-4 py-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {photoUrls[e.id] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photoUrls[e.id]} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                        )}
                        <div>
                        <p className="font-sans text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                          {mode === "plan" ? "Planned" : "Logged"}
                          {meal.photo ? " · photo" : ""}
                        </p>
                        <p className="mt-0.5">{meal.name}</p>
                        <p className="font-sans text-xs text-[var(--muted)]">
                          {Math.round(meal.kcal)} kcal · {Math.round(meal.protein_g)}p {Math.round(meal.carb_g)}c {Math.round(meal.fat_g)}f
                        </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <button
                          type="button"
                          className="font-sans text-xs underline"
                          disabled={pending}
                          onClick={() => act(() => toggleFavorite(e.id, date))}
                        >
                          {matchingFavorite(favorites, e) ? "In favourites" : "Add to favourites"}
                        </button>
                        <button
                          type="button"
                          className="font-sans text-xs underline"
                          disabled={pending}
                          onClick={() => act(() => removeNutritionEntry(e.id, date))}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-2 snap-x">
              <PhotoCard slot={slot.key} date={date} kind={mode} />
              {favorites
                .filter((f) => f.slot === slot.key)
                .map((fav) => {
                  const meal = favoriteAsMeal(fav);
                  return (
                    <article
                      key={fav.id}
                      className="w-[220px] shrink-0 snap-start rounded-xl border border-[var(--accent)] bg-[var(--card)] p-4"
                    >
                      <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Favourite</p>
                      <p className="mt-1 text-[15px] leading-snug">{meal.name}</p>
                      <p className="mt-3 font-sans text-xs">
                        {meal.kcal} kcal · {meal.protein_g}p {meal.carb_g}c {meal.fat_g}f
                      </p>
                      <button
                        type="button"
                        className={`${buttonClass} mt-3 w-full justify-center text-xs`}
                        disabled={pending}
                        onClick={() => act(() => chooseFavorite({ date, slot: slot.key, kind: mode, favoriteId: fav.id }))}
                      >
                        {mode === "plan" ? "Plan this" : "Log this"}
                      </button>
                    </article>
                  );
                })}
              {options[slot.key].map((meal) => {
                const selected = chosen.some((e) => e.meal_slug === meal.slug);
                return (
                  <article
                    key={meal.slug}
                    className={`w-[220px] shrink-0 snap-start rounded-xl border p-4 ${
                      selected ? "border-[var(--accent)] bg-[var(--card)]" : "border-[var(--line)] bg-[var(--card)]"
                    }`}
                  >
                    <p className="text-[15px] leading-snug">{meal.name}</p>
                    <p className="mt-2 font-sans text-xs text-[var(--muted)]">{meal.description}</p>
                    <p className="mt-3 font-sans text-xs">
                      {meal.kcal} kcal · {meal.protein_g}p {meal.carb_g}c {meal.fat_g}f
                    </p>
                    <p className="mt-1 font-sans text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                      {meal.prep_minutes} min
                    </p>
                    <button
                      type="button"
                      className={`${selected ? ghostButtonClass : buttonClass} mt-3 w-full justify-center text-xs`}
                      disabled={pending || (selected && slot.key !== "snack")}
                      onClick={() =>
                        act(() =>
                          chooseMeal({ date, slot: slot.key, kind: mode, mealSlug: meal.slug }),
                        )
                      }
                    >
                      {selected && slot.key !== "snack"
                        ? mode === "plan"
                          ? "Planned"
                          : "Logged"
                        : mode === "plan"
                          ? slot.key === "snack"
                            ? "Add to plan"
                            : "Plan this"
                          : slot.key === "snack"
                            ? "Log snack"
                            : "Log this"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
