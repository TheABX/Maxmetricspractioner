"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="font-sans text-xs uppercase tracking-[0.25em] text-[var(--muted)]">MAXMetrics</p>
      <h1 className="mt-3 text-4xl">Something went wrong</h1>
      <p className="mt-3 text-[var(--muted)]">
        The clinic page hit a server error. Try again, or check that the Vercel environment
        variables still match your Supabase project.
      </p>
      {error.digest && (
        <p className="mt-4 font-sans text-xs text-[var(--muted)]">Reference {error.digest}</p>
      )}
      <button
        className="mt-8 w-fit rounded-md bg-[var(--accent)] px-4 py-2 font-sans text-sm text-white"
        type="button"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
