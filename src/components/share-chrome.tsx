import Link from "next/link";
import { formatTaka } from "@/lib/money";
import { CopyNumber } from "./copy-number";

// Shared frame for the public pages: a green header band with the brand and
// title, and content cards that overlap it.
export function ShareShell({
  title,
  back,
  subtitle,
  children,
}: {
  title: string;
  back?: { href: string; label: string };
  subtitle?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white">
        <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold tracking-wide">
              <span className="inline-flex size-7 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">T</span>
              TurfTab
            </span>
            {back && (
              <Link href={back.href} className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium transition hover:bg-white/25">
                ← {back.label}
              </Link>
            )}
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-white/75">{subtitle}</p>}
        </div>
      </header>
      <main className="mx-auto -mt-9 flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pb-12">{children}</main>
    </div>
  );
}

export function BkashCard({ number }: { number: string | null }) {
  if (!number) return null;
  return (
    <section className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-pink-600 to-rose-700 p-4 text-white shadow-lg shadow-rose-900/20">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/75">Pay via bKash</p>
        <p className="text-2xl font-bold tracking-wide">{number}</p>
      </div>
      <CopyNumber value={number} />
    </section>
  );
}

export const money = formatTaka;
