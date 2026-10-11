"use client";

import { useMemo, useState, useTransition } from "react";
import { saveProgrammingProfile } from "@/app/profile-actions";
import { ProgrammingSummary } from "@/components/programming-summary";
import { buttonClass, Field, ghostButtonClass, inputClass } from "@/components/ui";
import { buildSummary, classify, effective, type AssessmentSignals } from "@/lib/programming-profile/derive";
import {
  DAYS,
  EQUIPMENT,
  EXCLUSION_REASONS,
  EXCLUSION_SEVERITY,
  EXCLUSION_SOURCES,
  EXPERIENCE,
  GOALS,
  LMH,
  LOCATIONS,
  PAIN_LOCATIONS,
  PERF_QUALITIES,
  PRIORITIES,
  PROGRAM_MODES,
  RELEVANCE,
  STAGES,
  STYLE_PREFS,
  VOLUME,
  label,
  type Exclusion,
  type Goal,
  type OverridableField,
  type Overrides,
  type ProfileInput,
} from "@/lib/programming-profile/types";

type Opt = { id: string; label: string };

const DAY_LABEL: Record<(typeof DAYS)[number], string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

const OVERRIDABLE: { key: OverridableField; title: string; options: readonly string[] | "bool"; affects: string }[] = [
  { key: "training_experience", title: "Training experience", options: EXPERIENCE, affects: "Exercise complexity, starting volume, progression rate, technical demands." },
  { key: "current_training_volume_category", title: "Current training volume", options: VOLUME, affects: "What they are accustomed to now — sets the initial workload." },
  { key: "movement_competency", title: "Movement competency", options: LMH, affects: "Exercise selection and whether a Foundation phase is needed. Separate from experience." },
  { key: "tolerance_to_training", title: "Training tolerance", options: LMH, affects: "How much workload they can initially tolerate. Experienced but detrained = low." },
  { key: "foundation_phase_recommended", title: "Foundation phase", options: "bool", affects: "Two or more of: low experience, low competency, low volume, low tolerance. Never age." },
  { key: "training_stage", title: "Training stage", options: STAGES, affects: "Foundation / Development / Advanced. Age alone never assigns Foundation." },
];

// ---------------------------------------------------------------------------

export function ProfileForm(props: {
  clientId: string;
  initialProfile: ProfileInput;
  initialOverrides: Overrides;
  signals: AssessmentSignals;
  questionnaireResponseId: string | null;
  assessmentSessionId: string | null;
  sessions: Opt[];
  responses: Opt[];
  confirmedAt: string | null;
  updatedAt: string | null;
}) {
  const [p, setP] = useState<ProfileInput>(props.initialProfile);
  const [ov, setOv] = useState<Overrides>(props.initialOverrides);
  const [responseId, setResponseId] = useState(props.questionnaireResponseId);
  const [sessionId, setSessionId] = useState(props.assessmentSessionId);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const auto = useMemo(() => classify(p, props.signals), [p, props.signals]);
  const eff = useMemo(() => effective(auto, ov), [auto, ov]);
  const summary = useMemo(() => buildSummary(p, eff), [p, eff]);

  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const toggle = <K extends keyof ProfileInput>(k: K, v: string) =>
    setP((prev) => {
      const cur = prev[k] as unknown as string[];
      return { ...prev, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });
  const selectedGoals = useMemo(() => {
    const out: Goal[] = [];
    if (p.primary_goal) out.push(p.primary_goal);
    for (const g of p.secondary_goals) if (!out.includes(g)) out.push(g);
    return out;
  }, [p.primary_goal, p.secondary_goals]);

  function save(confirm: boolean) {
    setMsg(null);
    start(async () => {
      const res = await saveProgrammingProfile({
        client_id: props.clientId,
        questionnaire_response_id: responseId,
        assessment_session_id: sessionId,
        profile: p,
        overrides: ov,
        confirm,
      });
      setMsg("error" in res ? { ok: false, text: res.error } : { ok: true, text: confirm ? "Profile saved and confirmed." : "Profile saved." });
    });
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* Sources */}
        <Section n="0" title="Sources" intro="Which intake and assessment this profile is built from. Movement signals come from these.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Questionnaire response">
              <select className={inputClass} value={responseId ?? ""} onChange={(e) => setResponseId(e.target.value || null)}>
                <option value="">— none —</option>
                {props.responses.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assessment session">
              <select className={inputClass} value={sessionId ?? ""} onChange={(e) => setSessionId(e.target.value || null)}>
                <option value="">— none —</option>
                {props.sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="mt-2 font-sans text-xs text-[var(--muted)]">
            Changing the assessment session takes effect after saving (squat observation and mobility asymmetries are re-read).
          </p>
        </Section>

        {/* 1 Program mode */}
        <Section n="1" title="Program mode">
          <div className="grid gap-3 sm:grid-cols-2">
            {PROGRAM_MODES.map((m) => (
              <label
                key={m}
                className={`cursor-pointer rounded-lg border p-3 font-sans text-sm ${p.program_mode === m ? "border-[var(--accent)] bg-white" : "border-[var(--line)]"}`}
              >
                <input type="radio" className="mr-2" checked={p.program_mode === m} onChange={() => set("program_mode", m)} />
                <span className="font-medium">{label(m)}</span>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {m === "GENERAL_WELLNESS"
                    ? "Assessment deficits, health priorities and client goals drive most of the program."
                    : "Sport/performance requirements take priority. Assessment findings modify the program by relevance to performance."}
                </p>
              </label>
            ))}
          </div>
        </Section>

        {/* 2–4 Goals */}
        <Section n="2–4" title="Goals and importance" intro="One primary goal. Secondary goals are optional. Each selected goal gets its own importance — do not assume equal weighting.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Primary goal">
              <select className={inputClass} value={p.primary_goal ?? ""} onChange={(e) => set("primary_goal", (e.target.value || null) as Goal | null)}>
                <option value="">— select —</option>
                {GOALS.map((g) => (
                  <option key={g} value={g}>
                    {label(g)}
                  </option>
                ))}
              </select>
            </Field>
            {p.primary_goal === "OTHER" && (
              <Field label="Custom goal">
                <input className={inputClass} value={p.primary_goal_custom} onChange={(e) => set("primary_goal_custom", e.target.value)} />
              </Field>
            )}
          </div>
          <p className="mt-4 mb-1 font-sans text-sm text-[var(--muted)]">Secondary goals</p>
          <Chips options={GOALS.filter((g) => g !== p.primary_goal)} selected={p.secondary_goals} onToggle={(v) => toggle("secondary_goals", v)} />
          {selectedGoals.length > 0 && (
            <div className="mt-4 grid gap-2">
              <p className="font-sans text-sm text-[var(--muted)]">Importance of each goal</p>
              {selectedGoals.map((g) => (
                <div key={g} className="flex flex-wrap items-center gap-3 font-sans text-sm">
                  <span className="min-w-[220px]">
                    {label(g)}
                    {g === p.primary_goal && <span className="ml-2 text-[11px] uppercase tracking-wide text-[var(--muted)]">primary</span>}
                  </span>
                  <Segmented
                    options={PRIORITIES}
                    value={p.goal_priorities[g] ?? null}
                    onChange={(v) => set("goal_priorities", { ...p.goal_priorities, [g]: v as (typeof PRIORITIES)[number] })}
                  />
                </div>
              ))}
            </div>
          )}
          <Field label="Goal notes (events, specifics)">
            <textarea className={`${inputClass} mt-3`} rows={2} value={p.goal_notes} onChange={(e) => set("goal_notes", e.target.value)} />
          </Field>
        </Section>

        {/* 5 Experience */}
        <Section n="5" title="Training experience" intro="Influences exercise complexity, starting volume, progression rate and technical demands. It does not by itself determine physical capacity.">
          <Segmented options={EXPERIENCE} value={p.training_experience} onChange={(v) => set("training_experience", v as ProfileInput["training_experience"])} allowClear />
          <ul className="mt-3 grid gap-1 font-sans text-xs text-[var(--muted)] sm:grid-cols-2">
            <li><b>None</b> — no meaningful structured resistance training.</li>
            <li><b>Beginner</b> — limited and/or inconsistent history.</li>
            <li><b>Intermediate</b> — consistent structured training across major patterns.</li>
            <li><b>Advanced</b> — years of structured training, strong competency and load management.</li>
          </ul>
        </Section>

        {/* 6 Current training status */}
        <Section n="6" title="Current training status" intro="What they are accustomed to right now — not what they want to do.">
          <div className="mb-3">
            <Segmented
              options={["true", "false"]}
              labels={{ true: "Currently training", false: "Not currently training" }}
              value={p.currently_training == null ? null : String(p.currently_training)}
              onChange={(v) => set("currently_training", v === "true")}
              allowClear
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <NumField label="Training days / week" value={p.current_training_days_per_week} min={0} max={7} onChange={(v) => set("current_training_days_per_week", v)} />
            <NumField label="Strength sessions / week" value={p.current_strength_sessions_per_week} min={0} max={14} onChange={(v) => set("current_strength_sessions_per_week", v)} />
            <NumField label="Cardio sessions / week" value={p.current_cardio_sessions_per_week} min={0} max={14} onChange={(v) => set("current_cardio_sessions_per_week", v)} />
            <NumField label="Avg session (min)" value={p.average_session_duration_minutes} min={0} max={240} step={5} onChange={(v) => set("average_session_duration_minutes", v)} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Recent consistency (last 12 months)">
              <Segmented
                options={["NONE", "SPORADIC", "REGULAR", "COMMITTED"]}
                value={p.recent_consistency}
                onChange={(v) => set("recent_consistency", v as ProfileInput["recent_consistency"])}
                allowClear
              />
            </Field>
            <Field label="Recovery quality (sleep, stress, bounce-back)">
              <Segmented options={LMH} value={p.recovery_quality} onChange={(v) => set("recovery_quality", v as ProfileInput["recovery_quality"])} allowClear />
            </Field>
          </div>
          <Field label="Current training notes (lifts and working weights, other activity)">
            <textarea className={`${inputClass} mt-3`} rows={3} value={p.current_training_notes} onChange={(e) => set("current_training_notes", e.target.value)} />
          </Field>
          <p className="mt-2 font-sans text-xs text-[var(--muted)]">
            Auto volume category: <b>{label(auto.current_training_volume_category)}</b> — {auto.rationale.current_training_volume_category}
          </p>
        </Section>

        {/* 9–10 Availability */}
        <Section n="9–10" title="Availability and session duration" intro="Time is a constrained training budget. Min / preferred / max let scheduling flex.">
          <div className="grid gap-3 sm:grid-cols-4">
            <NumField label="Available days / week" value={p.available_training_days_per_week} min={1} max={7} onChange={(v) => set("available_training_days_per_week", v)} />
            <NumField label="Min sessions / week" value={p.minimum_sessions_per_week} min={1} max={14} onChange={(v) => set("minimum_sessions_per_week", v)} />
            <NumField label="Preferred sessions / week" value={p.preferred_sessions_per_week} min={1} max={14} onChange={(v) => set("preferred_sessions_per_week", v)} />
            <NumField label="Max sessions / week" value={p.maximum_sessions_per_week} min={1} max={14} onChange={(v) => set("maximum_sessions_per_week", v)} />
          </div>
          <p className="mt-4 mb-1 font-sans text-sm text-[var(--muted)]">Preferred days</p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <Chip key={d} on={p.preferred_days.includes(d)} onClick={() => toggle("preferred_days", d)}>
                {DAY_LABEL[d]}
              </Chip>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <NumField label="Min session (min)" value={p.minimum_session_minutes} min={10} max={240} step={5} onChange={(v) => set("minimum_session_minutes", v)} />
            <NumField label="Preferred session (min)" value={p.preferred_session_minutes} min={10} max={240} step={5} onChange={(v) => set("preferred_session_minutes", v)} />
            <NumField label="Max session (min)" value={p.maximum_session_minutes} min={10} max={240} step={5} onChange={(v) => set("maximum_session_minutes", v)} />
          </div>
        </Section>

        {/* 11–12 Environment */}
        <Section n="11–12" title="Training location and equipment" intro="A client may use different environments on different days. Equipment determines which exercises are possible.">
          <Chips options={LOCATIONS} selected={p.training_locations} onToggle={(v) => toggle("training_locations", v)} />
          <p className="mt-4 mb-1 font-sans text-sm text-[var(--muted)]">Equipment inventory</p>
          <Chips options={EQUIPMENT} selected={p.equipment} onToggle={(v) => toggle("equipment", v)} />
          <div className="mt-2 flex gap-2">
            <button type="button" className="font-sans text-xs underline" onClick={() => set("equipment", [...EQUIPMENT.filter((e) => e !== "OTHER")])}>
              Select all
            </button>
            <button type="button" className="font-sans text-xs underline" onClick={() => set("equipment", [])}>
              Clear
            </button>
          </div>
          <Field label="Equipment notes (e.g. dumbbell range at home)">
            <input className={`${inputClass} mt-3`} value={p.equipment_notes} onChange={(e) => set("equipment_notes", e.target.value)} />
          </Field>
        </Section>

        {/* 13 + 17 Preferences */}
        <Section n="13 · 17" title="Exercise and training-style preferences" intro="Preference affects ranking. It does not exclude an exercise unless an acceptable alternative exists. Use Exclusions for hard rules.">
          <div className="grid gap-3 sm:grid-cols-2">
            <ListField label="Preferred exercises" value={p.preferred_exercises} onChange={(v) => set("preferred_exercises", v)} placeholder="one per line" />
            <ListField label="Disliked exercises" value={p.disliked_exercises} onChange={(v) => set("disliked_exercises", v)} placeholder="one per line" />
          </div>
          <p className="mt-4 mb-1 font-sans text-sm text-[var(--muted)]">Training style</p>
          <Chips options={STYLE_PREFS} selected={p.training_style_preferences} onToggle={(v) => toggle("training_style_preferences", v)} />
        </Section>

        {/* 14 Exclusions */}
        <Section n="14" title="Exercise exclusions" intro="Reasons are not equal: pain and medical restriction are hard exclusions for review; client refusal is a hard preference exclusion; equipment is environmental.">
          <ExclusionEditor value={p.excluded_exercises} onChange={(v) => set("excluded_exercises", v)} />
        </Section>

        {/* 15 Pain */}
        <Section n="15" title="Current pain / discomfort" intro="Screening and exercise eligibility only. This is not a diagnosis and must not be used to infer one.">
          <Segmented
            options={["true", "false"]}
            labels={{ true: "Pain present", false: "No current pain" }}
            value={p.pain_present == null ? null : String(p.pain_present)}
            onChange={(v) => set("pain_present", v === "true")}
            allowClear
          />
          {p.pain_present !== false && (
            <>
              <p className="mt-4 mb-1 font-sans text-sm text-[var(--muted)]">Locations</p>
              <Chips options={PAIN_LOCATIONS} selected={p.pain_locations} onToggle={(v) => toggle("pain_locations", v)} />
              <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
                <NumField label="Severity (0–10)" value={p.pain_severity} min={0} max={10} onChange={(v) => set("pain_severity", v)} />
                <Field label="Activities that provoke it">
                  <input className={inputClass} value={p.activities_that_provoke} onChange={(e) => set("activities_that_provoke", e.target.value)} />
                </Field>
              </div>
              <Field label="Pain notes (client's words, history, surgeries)">
                <textarea className={`${inputClass} mt-3`} rows={3} value={p.pain_notes} onChange={(e) => set("pain_notes", e.target.value)} />
              </Field>
            </>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Medical clearance required?">
              <Segmented
                options={["true", "false"]}
                labels={{ true: "Required", false: "Not required" }}
                value={p.medical_clearance_required == null ? null : String(p.medical_clearance_required)}
                onChange={(v) => set("medical_clearance_required", v === "true")}
                allowClear
              />
            </Field>
            {p.medical_clearance_required && (
              <Field label="Clearance obtained?">
                <Segmented
                  options={["true", "false"]}
                  labels={{ true: "Obtained", false: "Outstanding" }}
                  value={p.medical_clearance_obtained == null ? null : String(p.medical_clearance_obtained)}
                  onChange={(v) => set("medical_clearance_obtained", v === "true")}
                  allowClear
                />
              </Field>
            )}
          </div>
          <Field label="Medical notes (conditions, medications, doctor's advice)">
            <textarea className={`${inputClass} mt-3`} rows={2} value={p.medical_clearance_notes} onChange={(e) => set("medical_clearance_notes", e.target.value)} />
          </Field>
        </Section>

        {/* 18 Performance */}
        {p.program_mode === "PERFORMANCE" && (
          <Section n="18" title="Performance context" intro="Determines which assessment findings matter most. Quality importance is entered manually in V1 — nothing is inferred from the sport.">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Sport" value={p.performance.sport} onChange={(v) => set("performance", { ...p.performance, sport: v })} />
              <TextField label="Event / position" value={p.performance.event_or_position} onChange={(v) => set("performance", { ...p.performance, event_or_position: v })} />
              <TextField label="Competition level" value={p.performance.competition_level} onChange={(v) => set("performance", { ...p.performance, competition_level: v })} placeholder="e.g. club, state, national, masters" />
              <TextField label="Current training phase" value={p.performance.current_training_phase} onChange={(v) => set("performance", { ...p.performance, current_training_phase: v })} placeholder="e.g. off-season, pre-season, in-season" />
              <Field label="Next major competition">
                <input type="date" className={inputClass} value={p.performance.next_major_competition_date} onChange={(e) => set("performance", { ...p.performance, next_major_competition_date: e.target.value })} />
              </Field>
            </div>
            <Field label="Sport-specific notes">
              <textarea className={`${inputClass} mt-3`} rows={2} value={p.performance.sport_specific_notes} onChange={(e) => set("performance", { ...p.performance, sport_specific_notes: e.target.value })} />
            </Field>
            <p className="mt-4 mb-2 font-sans text-sm text-[var(--muted)]">Performance quality priorities</p>
            <div className="grid gap-2">
              {PERF_QUALITIES.map((q) => (
                <div key={q} className="flex flex-wrap items-center gap-3 font-sans text-sm">
                  <span className="min-w-[180px]">{label(q.toUpperCase())}</span>
                  <Segmented
                    options={RELEVANCE}
                    value={p.performance.qualities[q] ?? null}
                    onChange={(v) => set("performance", { ...p.performance, qualities: { ...p.performance.qualities, [q]: v as (typeof RELEVANCE)[number] } })}
                    allowClear
                  />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 7, 8, 16, 19, 22 Classifications + overrides */}
        <Section n="7 · 8 · 16 · 19 · 22" title="Classifications and practitioner override" intro="Every automatic value is editable. The automatic value, your override and the reason are all stored.">
          <div className="grid gap-4">
            {OVERRIDABLE.map((f) => {
              const autoVal = auto[f.key];
              const o = ov[f.key];
              const overridden = eff.overridden.includes(f.key);
              const options = f.options === "bool" ? ["true", "false"] : f.options;
              const boolLabels = { true: "Recommended", false: "Not required" };
              const toStr = (v: unknown) => (v == null ? null : String(v));
              return (
                <div key={f.key} className={`rounded-lg border p-3 ${overridden ? "border-[#c98a2b] bg-[#fff8ec]" : "border-[var(--line)] bg-white"}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-sans text-sm font-medium">{f.title}</p>
                    <p className="font-sans text-xs text-[var(--muted)]">
                      Automatic: <b>{f.options === "bool" ? (autoVal ? "Recommended" : "Not required") : label(String(autoVal))}</b>
                    </p>
                  </div>
                  <p className="mt-1 font-sans text-xs text-[var(--muted)]">{auto.rationale[f.key]}</p>
                  <p className="mt-1 font-sans text-[11px] text-[var(--muted)]">Affects: {f.affects}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr]">
                    <div>
                      <p className="mb-1 font-sans text-xs text-[var(--muted)]">Practitioner override</p>
                      <Segmented
                        options={options}
                        labels={f.options === "bool" ? boolLabels : undefined}
                        value={toStr(o?.value)}
                        allowClear
                        onChange={(v) =>
                          setOv((prev) => {
                            const next = { ...prev };
                            if (v == null) delete next[f.key];
                            else next[f.key] = { value: (f.options === "bool" ? v === "true" : v) as never, reason: prev[f.key]?.reason ?? "" };
                            return next;
                          })
                        }
                      />
                    </div>
                    {o && (
                      <Field label="Override reason">
                        <input className={inputClass} value={o.reason} onChange={(e) => setOv((prev) => ({ ...prev, [f.key]: { ...o, reason: e.target.value } }))} placeholder="Why the automatic value is wrong for this client" />
                      </Field>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section n="—" title="Practitioner notes">
          <textarea className={inputClass} rows={3} value={p.practitioner_notes} onChange={(e) => set("practitioner_notes", e.target.value)} />
        </Section>
      </div>

      {/* Sidebar: summary */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Programming summary</h2>
          <p className="mt-1 font-sans text-xs text-[var(--muted)]">Verify the system has understood the client before a program is generated.</p>
          <div className="mt-4">
            <ProgrammingSummary summary={summary} />
          </div>
          {eff.overridden.length > 0 && (
            <p className="mt-3 font-sans text-xs text-[#8a4b00]">Overridden: {eff.overridden.map((k) => OVERRIDABLE.find((f) => f.key === k)?.title ?? k).join(", ")}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={pending} onClick={() => save(false)}>
              {pending ? "Saving…" : "Save profile"}
            </button>
            <button type="button" className={ghostButtonClass} disabled={pending} onClick={() => save(true)}>
              Save & confirm
            </button>
          </div>
          {msg && <p className={`mt-3 font-sans text-sm ${msg.ok ? "text-[#1f6e3a]" : "text-[#a33]"}`}>{msg.text}</p>}
          <p className="mt-3 font-sans text-xs text-[var(--muted)]">
            {props.confirmedAt ? `Confirmed ${new Date(props.confirmedAt).toLocaleString("en-AU")}. ` : "Not yet confirmed. "}
            {props.updatedAt ? `Last saved ${new Date(props.updatedAt).toLocaleString("en-AU")}.` : "Not saved yet."}
          </p>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Section({ n, title, intro, children }: { n: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
      <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        <span className="mr-2 text-[var(--accent)]">{n}</span>
        {title}
      </h2>
      {intro && <p className="mt-1 font-sans text-xs text-[var(--muted)]">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-sans text-xs ${on ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)] bg-white"}`}
    >
      {children}
    </button>
  );
}

function Chips({ options, selected, onToggle }: { options: readonly string[]; selected: readonly string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} on={selected.includes(o)} onClick={() => onToggle(o)}>
          {label(o)}
        </Chip>
      ))}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
  labels,
  allowClear,
}: {
  options: readonly string[];
  value: string | null;
  onChange: (v: string | null) => void;
  labels?: Record<string, string>;
  allowClear?: boolean;
}) {
  return (
    <div className="inline-flex flex-wrap overflow-hidden rounded-md border border-[var(--line)] bg-white">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(allowClear && value === o ? null : o)}
          className={`px-3 py-1.5 font-sans text-xs ${value === o ? "bg-[var(--accent)] text-white" : ""} border-r border-[var(--line)] last:border-r-0`}
        >
          {labels?.[o] ?? label(o)}
        </button>
      ))}
    </div>
  );
}

function NumField({ label: l, value, onChange, min, max, step }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number }) {
  return (
    <Field label={l}>
      <input type="number" className={inputClass} value={value ?? ""} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
    </Field>
  );
}

function TextField({ label: l, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Field label={l}>
      <input className={inputClass} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function ListField({ label: l, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <Field label={l}>
      <textarea
        className={inputClass}
        rows={4}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text.split(/\n+/).map((x) => x.trim()).filter(Boolean))}
      />
    </Field>
  );
}

function ExclusionEditor({ value, onChange }: { value: Exclusion[]; onChange: (v: Exclusion[]) => void }) {
  const update = (i: number, patch: Partial<Exclusion>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="grid gap-2">
      {value.length === 0 && <p className="font-sans text-sm text-[var(--muted)]">No exclusions.</p>}
      {value.map((x, i) => {
        const sev = EXCLUSION_SEVERITY[x.reason];
        return (
          <div key={i} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-3 sm:grid-cols-[1fr_170px_150px_1fr_auto]">
            <input className={inputClass} placeholder="Exercise or pattern" value={x.exercise} onChange={(e) => update(i, { exercise: e.target.value })} />
            <select className={inputClass} value={x.reason} onChange={(e) => update(i, { reason: e.target.value as Exclusion["reason"] })}>
              {EXCLUSION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {label(r)}
                </option>
              ))}
            </select>
            <select className={inputClass} value={x.source} onChange={(e) => update(i, { source: e.target.value as Exclusion["source"] })}>
              {EXCLUSION_SOURCES.map((r) => (
                <option key={r} value={r}>
                  {label(r)}
                </option>
              ))}
            </select>
            <input className={inputClass} placeholder="Notes" value={x.notes ?? ""} onChange={(e) => update(i, { notes: e.target.value })} />
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide ${
                  sev === "hard_review" ? "bg-[#fde7e7] text-[#8a1f1f]" : sev === "hard_preference" ? "bg-[#fff2d9] text-[#8a4b00]" : "bg-[#eef1f5] text-[#4a5568]"
                }`}
              >
                {sev.replace("_", " ")}
              </span>
              <button type="button" className="font-sans text-xs underline" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className={`${ghostButtonClass} w-fit`}
        onClick={() => onChange([...value, { exercise: "", reason: "PRACTITIONER_DECISION", source: "PRACTITIONER", notes: "" }])}
      >
        Add exclusion
      </button>
    </div>
  );
}
