import Link from "next/link";
import { ClientShell } from "@/components/client-shell";
import { buttonClass, ghostButtonClass } from "@/components/ui";
import { currentProgram, requireClientPage } from "@/lib/auth/client-page";
import { calendarDate } from "@/lib/nutrition/load";
import { nutritionComplete } from "@/lib/nutrition/questionnaire";
import type { SessionRow } from "@/lib/programs/types";
import { HrChart } from "@/components/hr-chart";
import { cleanHrSamples } from "@/lib/wearable/hr";
import { latestWearableDay, recoveryFromDays, type WearableDay } from "@/lib/wearable/recovery";
import { ClientTodayTraining } from "./today-training";

export default async function ClientHome() {
  const { supabase, client } = await requireClientPage();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const [program, { data: response }, { data: report }, { data: nutritionProfile }, { data: wearRows }, { data: hrRows }] = await Promise.all([
    currentProgram(supabase, client.id),
    supabase.from("questionnaire_responses").select("id, submitted_at, answers").eq("client_id", client.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("generated_reports").select("id, title").eq("client_id", client.id).eq("status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("nutrition_profiles").select("goal").eq("client_id", client.id).maybeSingle(),
    supabase
      .from("wearable_days")
      .select("day, resting_hr, sleep_minutes, steps, active_kcal, avg_hr, spo2, feel, synced_at")
      .eq("client_id", client.id)
      .order("day", { ascending: false })
      .limit(40),
    supabase
      .from("wearable_hr_samples")
      .select("recorded_at, bpm, source")
      .eq("client_id", client.id)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true })
      .limit(20000),
  ]);

  let sessions: SessionRow[] = [];
  if (program) {
    const { data: s } = await supabase
      .from("program_sessions")
      .select("*, program_exercises(*)")
      .eq("program_id", program.id)
      .order("week")
      .order("day");
    sessions = (s ?? []) as SessionRow[];
  }
  const nutritionReady =
    nutritionComplete((response?.answers as Record<string, unknown> | undefined) ?? {}) || Boolean(nutritionProfile?.goal);
  const today = calendarDate();
  const wearDays = (wearRows ?? []).map((d) => ({
    ...d,
    resting_hr: d.resting_hr == null ? null : Number(d.resting_hr),
    sleep_minutes: d.sleep_minutes == null ? null : Number(d.sleep_minutes),
    steps: d.steps == null ? null : Number(d.steps),
    active_kcal: d.active_kcal == null ? null : Number(d.active_kcal),
  })) as WearableDay[];
  const recovery = recoveryFromDays(wearDays, today);
  const lastNight = latestWearableDay(wearDays, today);
  const hrSamples = cleanHrSamples(
    (hrRows ?? []).map((r) => ({
      recorded_at: r.recorded_at as string,
      bpm: r.bpm == null ? null : Number(r.bpm),
      source: r.source as "scheduled" | "minute" | "live" | "manual",
    })),
  );

  return (
    <ClientShell name={`${client.first_name} ${client.last_name}`} active="home">
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Hi {client.first_name}</p>
      <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
        <p className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          {lastNight && lastNight.day !== today ? lastNight.day : "Last night"}
        </p>
        <h2 className="mt-1 text-2xl">{recovery.title}</h2>
        <p className="mt-1 font-sans text-sm text-[var(--muted)]">{recovery.why}</p>
        <p className="mt-3 font-sans text-sm text-[var(--ink)]">
          Resting HR {lastNight?.resting_hr != null ? Math.round(lastNight.resting_hr) : "—"} · Sleep{" "}
          {lastNight?.sleep_minutes != null ? `${(lastNight.sleep_minutes / 60).toFixed(1)} h` : "—"} · Steps{" "}
          {lastNight?.steps != null ? lastNight.steps.toLocaleString("en-AU") : "—"}
          {lastNight?.active_kcal != null ? ` · ${Math.round(lastNight.active_kcal)} kcal` : ""}
        </p>
      </div>
      <HrChart samples={hrSamples} />

      {!response?.submitted_at && (
        <div className="mt-4 rounded-xl border border-[var(--accent-2)]/40 bg-[var(--card)] p-5">
          <h2 className="text-xl">{response ? "Please update your questionnaire" : "Start with your questionnaire"}</h2>
          <p className="mt-1 font-sans text-sm text-[var(--muted)]">
            {response
              ? "Your practitioner asked for an update. Previous answers are saved — change anything that is no longer right."
              : "Goals, training history, injuries, schedule, and how you eat. Training and nutrition are built from this."}
          </p>
          <Link href="/me/questionnaire" className={`${buttonClass} mt-3`}>
            {response ? "Update questionnaire" : "Fill in questionnaire"}
          </Link>
        </div>
      )}

      {response?.submitted_at && !nutritionReady && (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="text-xl">Add your nutrition preferences</h2>
          <p className="mt-1 font-sans text-sm text-[var(--muted)]">
            A short set of food questions so your daily target and meal list match how you actually eat.
          </p>
          <Link href="/me/nutrition" className={`${buttonClass} mt-3`}>
            Open nutrition
          </Link>
        </div>
      )}

      {!program ? (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="text-xl">Your program is being prepared</h2>
          <p className="mt-1 font-sans text-sm text-[var(--muted)]">
            Once your practitioner approves it, it will appear here and you will get an email.
          </p>
          {report && (
            <Link href="/me/report" className={`${ghostButtonClass} mt-3`}>
              View your report
            </Link>
          )}
        </div>
      ) : (
        <>
          <ClientTodayTraining program={program} sessions={sessions} />
          <Link href="/me/program" className="mt-4 inline-block font-sans text-sm underline">
            See upcoming sessions
          </Link>
        </>
      )}

      {nutritionReady && (
        <Link href="/me/nutrition" className="mt-6 block rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Nutrition</p>
          <p className="mt-1 text-xl">Plan today, then log what you ate</p>
          <p className="mt-1 font-sans text-sm text-[var(--muted)]">Targets and meals sit on their own tab so training and food stay separate.</p>
        </Link>
      )}
    </ClientShell>
  );
}
