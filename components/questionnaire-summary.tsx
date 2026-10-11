import { PROFILE_LABELS, QUESTIONNAIRE_SECTIONS, deriveProfile, labelFor } from "@/lib/questionnaire/schema";

export function QuestionnaireSummary({
  answers,
  compact = false,
}: {
  answers: Record<string, unknown>;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4 font-sans text-sm">
      {QUESTIONNAIRE_SECTIONS.map((section) => {
        const rows = section.fields
          .map((f) => ({ f, v: labelFor(f, answers[f.key]) }))
          .filter((r) => !compact || r.v !== "—");
        if (!rows.length) return null;
        return (
          <div key={section.key}>
            <h4 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{section.title}</h4>
            <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              {rows.map(({ f, v }) => (
                <div key={f.key} className="contents">
                  <dt className="text-[var(--muted)]">{f.label}</dt>
                  <dd className="whitespace-pre-wrap">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

function Chip({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warn" }) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded-full border px-2.5 py-0.5 font-sans text-[11px] ${
        tone === "warn" ? "border-[#e5c9b3] bg-[#fbf1e8] text-[#8a4a1f]" : "border-[var(--line)] bg-white text-[var(--ink)]"
      }`}
    >
      <span className="uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span>{value}</span>
    </span>
  );
}

/**
 * The six dials a program is built around, plus flags. Shown on the client
 * record and the program builder so the whole picture sits in one line.
 */
export function ProfileChips({ answers }: { answers: Record<string, unknown> }) {
  const p = deriveProfile(answers);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Chip label="Goal" value={p.goalLabel} />
        <Chip label="Push" value={PROFILE_LABELS.intensity[p.intensity]} />
        <Chip label="Experience" value={PROFILE_LABELS.experience[p.experience]} />
        <Chip label="Movement" value={PROFILE_LABELS.movement[p.movement]} />
        <Chip label="Access" value={PROFILE_LABELS.access[p.access]} />
        <Chip
          label="Time"
          value={`${p.timeBudget.days}×${p.timeBudget.minutes} min${p.timeBudget.wantsMore ? " (wants more)" : ""}`}
        />
      </div>
      {p.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.flags.map((f) => (
            <Chip key={f} label="!" value={f} tone="warn" />
          ))}
        </div>
      )}
    </div>
  );
}
