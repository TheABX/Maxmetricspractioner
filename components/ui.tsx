import Link from "next/link";
import { signOut } from "@/app/actions";

export function AppShell({
  children,
  practitionerEmail,
  wide = false,
}: {
  children: React.ReactNode;
  practitionerEmail?: string;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--card)]">
        <div className={`mx-auto flex items-center justify-between px-6 py-4 ${wide ? "max-w-[1500px]" : "max-w-6xl"}`}>
          <Link href="/" className="tracking-[0.2em] text-sm uppercase">
            MAXMetrics
          </Link>
          <nav className="flex items-center gap-5 text-sm font-sans text-[var(--muted)]">
            <Link href="/">Dashboard</Link>
            <Link href="/clients">Clients</Link>
            <Link href="/programs">Programs</Link>
            <Link href="/exercises">Exercise library</Link>
            <Link href="/adaptations">Review queue</Link>
            <Link href="/setup">Setup</Link>
            <span className="hidden sm:inline">{practitionerEmail}</span>
            <form action={signOut}>
              <button className="underline decoration-[var(--line)]">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className={`mx-auto px-6 py-8 ${wide ? "max-w-[1500px]" : "max-w-6xl"}`}>{children}</main>
    </div>
  );
}

export function Card({
  title,
  children,
  href,
  titleHref,
}: {
  title: string;
  children: React.ReactNode;
  href?: string;
  titleHref?: string;
}) {
  const heading = titleHref ? (
    <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
      <Link href={titleHref} className="underline decoration-[var(--line)] hover:text-[var(--ink)]">
        {title}
      </Link>
    </h2>
  ) : (
    <h2 className="font-sans text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{title}</h2>
  );
  const inner = (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      {heading}
      <div className="mt-3">{children}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block font-sans text-sm">
      <span className="mb-1 block text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-[15px] outline-none focus:border-[var(--accent)]";

export const buttonClass =
  "inline-flex items-center rounded-md bg-[var(--accent)] px-4 py-2 font-sans text-sm text-white";

export const ghostButtonClass =
  "inline-flex items-center rounded-md border border-[var(--line)] bg-white px-4 py-2 font-sans text-sm";
