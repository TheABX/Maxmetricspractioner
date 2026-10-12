import { MissingSupabaseConfig } from "@/components/missing-supabase-config";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  if (!getSupabasePublicEnv()) {
    return <MissingSupabaseConfig />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="font-sans text-xs uppercase tracking-[0.25em] text-[var(--muted)]">MAXMetrics</p>
      <h1 className="mt-3 text-4xl">Practitioner sign in</h1>
      <p className="mt-3 text-[var(--muted)]">
        Use the same email you will use in clinic. Confirm email in Supabase Auth if sign-up does not drop you straight through.
      </p>
      <LoginForm />
      <p className="mt-8 font-sans text-sm text-[var(--muted)]">
        Are you a client?{" "}
        <a className="underline" href="/join">
          Go to the client portal
        </a>
        .
      </p>
    </div>
  );
}
