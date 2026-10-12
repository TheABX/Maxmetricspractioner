export function MissingSupabaseConfig() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="font-sans text-xs uppercase tracking-[0.25em] text-[var(--muted)]">MAXMetrics</p>
      <h1 className="mt-3 text-4xl">Connect Supabase on Vercel</h1>
      <p className="mt-3 text-[var(--muted)]">
        The clinic site deployed, but Vercel does not have the Supabase keys this page needs. Add
        them in the project, then redeploy. <code>NEXT_PUBLIC_</code> values are baked in at build
        time, so a new deployment is required after you save them.
      </p>
      <ol className="mt-8 list-decimal space-y-3 pl-5 font-sans text-sm leading-6 text-[var(--ink)]">
        <li>
          Open Vercel → this project → Settings → Environment Variables.
        </li>
        <li>
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> for Production, Preview, and
          Development. Copy the same values from your local <code>.env.local</code>.
        </li>
        <li>Redeploy the latest commit on Production.</li>
      </ol>
      <p className="mt-8 font-sans text-sm text-[var(--muted)]">
        Optional later: <code>NEXT_PUBLIC_APP_URL</code>, <code>RESEND_API_KEY</code>, and{" "}
        <code>EMAIL_FROM</code> for invite emails.
      </p>
    </div>
  );
}
