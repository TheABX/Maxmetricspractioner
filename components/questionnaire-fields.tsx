import { inputClass } from "@/components/ui";
import type { Field, Section } from "@/lib/questionnaire/schema";

export function FieldInput({ field, value }: { field: Field; value: unknown }) {
  if (field.type === "textarea") {
    return <textarea className={`${inputClass} mt-1`} name={field.key} rows={3} defaultValue={value == null ? "" : String(value)} />;
  }
  if (field.type === "select") {
    return (
      <select className={`${inputClass} mt-1`} name={field.key} defaultValue={value == null ? "" : String(value)}>
        <option value="">— select —</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "multi") {
    const selected = new Set(Array.isArray(value) ? value.map(String) : []);
    return (
      <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
        {field.options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 font-sans text-sm">
            <input type="checkbox" name={field.key} value={o.value} defaultChecked={selected.has(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    );
  }
  return (
    <input
      className={`${inputClass} mt-1`}
      name={field.key}
      type={field.type === "number" ? "number" : "text"}
      step={field.type === "number" ? "any" : undefined}
      placeholder={field.placeholder}
      defaultValue={value == null ? "" : String(value)}
    />
  );
}

export function SectionFields({
  sections,
  answers,
}: {
  sections: Section[];
  answers: Record<string, unknown>;
}) {
  return (
    <>
      {sections.map((section) => (
        <fieldset key={section.key} className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5">
          <legend className="px-1 text-xl">{section.title}</legend>
          {section.intro && <p className="font-sans text-sm text-[var(--muted)]">{section.intro}</p>}
          <div className="mt-3 grid gap-4">
            {section.fields.map((f) => (
              <label key={f.key} className="block font-sans text-sm">
                <span className="text-[var(--ink)]">{f.label}</span>
                {f.help && <span className="block text-xs text-[var(--muted)]">{f.help}</span>}
                <FieldInput field={f} value={answers[f.key]} />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </>
  );
}
