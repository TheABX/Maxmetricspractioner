"use client";

import { useState } from "react";
import { clientSignIn, clientSignUp } from "@/app/client-actions";
import { buttonClass, Field, inputClass } from "@/components/ui";

export function JoinForm({ defaultEmail }: { defaultEmail: string }) {
  const [mode, setMode] = useState<"up" | "in">(defaultEmail ? "up" : "in");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = mode === "in" ? await clientSignIn(formData) : await clientSignUp(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <form action={handleSubmit} className="mt-8 space-y-4">
      {mode === "up" ? (
        <>
          <Field label="First name">
            <input className={inputClass} name="first_name" autoComplete="given-name" />
          </Field>
          <Field label="Last name">
            <input className={inputClass} name="last_name" autoComplete="family-name" />
          </Field>
        </>
      ) : null}
      <Field label="Email">
        <input className={inputClass} name="email" type="email" defaultValue={defaultEmail} required />
      </Field>
      <Field label="Password">
        <input className={inputClass} name="password" type="password" minLength={8} required />
      </Field>
      {error && <p className="font-sans text-sm text-[var(--accent-2)]">{error}</p>}
      <button className={buttonClass} type="submit">
        {mode === "in" ? "Sign in" : "Create my login"}
      </button>
      <button
        type="button"
        className="ml-4 font-sans text-sm underline"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? "First time here?" : "Already have a login?"}
      </button>
    </form>
  );
}
