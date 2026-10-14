import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BkashCard, money, ShareShell } from "@/components/share-chrome";
import { card, muted, pill } from "@/components/ui";
import { dateParts } from "@/lib/dates";
import { getGroupShare } from "@/lib/data";

export const metadata: Metadata = {
  title: "TurfTab games",
  description: "Football games, teams and shares.",
  robots: { index: false, follow: false },
};

// Public and read-only, protected by the link's token. Mirrors the admin
// games list. It never shows balances, who has paid, or who covered whom.
export default async function GroupSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getGroupShare(token);
  if (!data) notFound();

  return (
    <ShareShell title="Games" subtitle={data.games.length ? `${data.games.length} played so far` : null}>
      <BkashCard number={data.bkash} />
      {data.games.length === 0 && (
        <div className={`${card} py-10 text-center`}>
          <p className="font-semibold">No games yet</p>
          <p className={muted}>Check back after the next match.</p>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {data.games.map((g) => {
          const d = dateParts(g.playedOn);
          const guests = g.people.filter((p) => p.guest).length;
          const scored = g.matches.filter((m) => m.scoreA !== null);
          return (
            <li key={g.id}>
              <Link
                href={`/s/${token}/games/${g.id}`}
                className={`${card} flex items-center gap-4 p-3.5 transition hover:border-emerald-600/40 hover:shadow-md active:scale-[0.99]`}
              >
                <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{d.month}</span>
                  <span className="text-2xl font-extrabold leading-none">{d.day}</span>
                  <span className="text-[11px] font-medium opacity-70">{d.weekday}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-bold">{money(g.total)}</p>
                    <p className="text-sm text-foreground/60">{money(g.perHead)} each</p>
                  </div>
                  {g.note && <p className="truncate text-sm text-foreground/60">{g.note}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={pill.gray}>{g.headcount} paying</span>
                    {g.matches.length > 0 && (
                      <span className={pill.blue}>
                        {g.matches.length} {g.matches.length === 1 ? "match" : "matches"}
                      </span>
                    )}
                    {guests > 0 && (
                      <span className={pill.amber}>
                        {guests} guest{guests > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {scored.length > 0 && (
                    <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground/70">
                      {scored.map((m) => `${m.scoreA}–${m.scoreB}`).join("   ")}
                    </p>
                  )}
                </div>
                <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-foreground/30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </ShareShell>
  );
}
