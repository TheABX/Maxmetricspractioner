"use client";

import { useState } from "react";
import { signIn, signUp } from "@/app/actions";
import { buttonClass, Field, inputClass } from "@/components/ui";

export function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = mode === "in" ? await signIn(formData) : await signUp(formData);
    if (result?.error) setError(result.error);
  }

  return (
    <form action={handleSubmit} className="mt-8 space-y-4">
      {mode === "up" && (
        <Field label="Full name">
          <input className={inputClass} name="full_name" defaultValue="Deon Kenzie" />
        </Field>
      )}
      <Field label="Email">
        <input className={inputClass} name="email" type="email" required />
      </Field>
      <Field label="Password">
        <input className={inputClass} name="password" type="password" minLength={8} required />
      </Field>
      {error && <p className="font-sans text-sm text-[var(--accent-2)]">{error}</p>}
      <button className={buttonClass} type="submit">
        {mode === "in" ? "Sign in" : "Create practitioner account"}
      </button>
      <button
        type="button"
        className="ml-4 font-sans text-sm underline"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? "Need an account?" : "Have an account?"}
      </button>
    </form>
  );
}
