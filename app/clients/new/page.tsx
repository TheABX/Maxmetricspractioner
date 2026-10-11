import { createClientProfile } from "@/app/actions";
import { AppShell, Field, inputClass, buttonClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewClientPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  return (
    <AppShell practitionerEmail={String(data.claims.email ?? "")}>
      <h1 className="text-4xl">Add client</h1>
      <form action={createClientProfile} className="mt-8 grid max-w-2xl gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <input className={inputClass} name="first_name" required />
          </Field>
          <Field label="Last name">
            <input className={inputClass} name="last_name" required />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth">
            <input className={inputClass} name="dob" type="date" required />
          </Field>
          <Field label="Sex">
            <select className={inputClass} name="sex" defaultValue="male">
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="unspecified">Unspecified</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Height (cm)">
            <input className={inputClass} name="height_cm" type="number" step="0.1" required />
          </Field>
          <Field label="Bodyweight (kg)">
            <input className={inputClass} name="bodyweight_kg" type="number" step="0.1" required />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dominant hand">
            <select className={inputClass} name="dominant_hand" defaultValue="unknown">
              <option value="unknown">Unknown</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </Field>
          <Field label="Dominant leg">
            <select className={inputClass} name="dominant_leg" defaultValue="unknown">
              <option value="unknown">Unknown</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </Field>
        </div>
        <Field label="Email">
          <input className={inputClass} name="email" type="email" />
        </Field>
        <Field label="Phone">
          <input className={inputClass} name="phone" />
        </Field>
        <Field label="Goals">
          <textarea className={inputClass} name="goals" rows={3} />
        </Field>
        <Field label="Notes">
          <textarea className={inputClass} name="notes" rows={3} />
        </Field>
        <button className={buttonClass}>Save client</button>
      </form>
    </AppShell>
  );
}
