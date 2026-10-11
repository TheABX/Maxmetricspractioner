import { clientSignOut } from "@/app/client-actions";
import { JoinForm } from "./join-form";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; unlinked?: string }>;
}) {
  const { email, unlinked } = await searchParams;
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="font-sans text-xs uppercase tracking-[0.25em] text-[var(--muted)]">MAXMetrics</p>
      <h1 className="mt-3 text-4xl">Client portal</h1>
      {unlinked ? (
        <div className="mt-4 rounded-xl border border-[var(--accent-2)]/40 bg-[var(--card)] p-4 font-sans text-sm">
          <p>
            Your login was created, but a client record could not be stored yet. Sign in once as the clinic
            practitioner on the website, then sign in here again.
          </p>
          <form action={clientSignOut} className="mt-3">
            <button className="underline">Sign out</button>
          </form>
        </div>
      ) : (
        <p className="mt-3 text-[var(--muted)]">
          Create an account or sign in. New sign-ups are stored in the clinic so your practitioner can find you.
        </p>
      )}
      <JoinForm defaultEmail={email ?? ""} />
    </div>
  );
}
