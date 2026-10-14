import Link from "next/link";

export const dynamic = "force-static";

export default function LandingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="font-sans text-xs uppercase tracking-[0.25em] text-[var(--muted)]">MAXMetrics</p>
      <h1 className="mt-3 text-4xl">Practitioner clinic</h1>
      <p className="mt-3 text-[var(--muted)]">
        Sign in to open the clinic dashboard, clients, programs, and reports.
      </p>
      <p className="mt-8 font-sans text-sm">
        <Link className="underline" href="/login">
          Practitioner sign in
        </Link>
        {" · "}
        <Link className="underline" href="/join">
          Client portal
        </Link>
      </p>
    </div>
  );
}
