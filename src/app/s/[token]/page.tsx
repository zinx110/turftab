import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { BkashCard, money, ShareShell } from "@/components/share-chrome";
import { card, muted, pill, sectionTitle } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { getGroupShare } from "@/lib/data";

export const metadata: Metadata = { title: "TurfTab games", robots: { index: false, follow: false } };

// Public and read-only, protected by the link's token. It shows each game
// day (costs, everyone's share, guest tags) and every match's teams and
// score. It never shows balances, who has paid, or who covered whom: each
// person sees only their own cut of the bill.
export default async function GroupSharePage({ params }: { params: Promise<{ token: string }> }) {
  const data = await getGroupShare((await params).token);
  if (!data) notFound();

  return (
    <ShareShell title="Football games">
      <BkashCard number={data.bkash} />
      {data.games.length === 0 && <p className={muted}>No games yet.</p>}
      <ul className="flex flex-col gap-4">
        {data.games.map((g) => (
          <li key={g.id} id={`game-${g.id}`} className={`${card} flex scroll-mt-4 flex-col gap-4`}>
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{formatDate(g.playedOn)}</h2>
                <span className="font-bold">{money(g.total)}</span>
              </div>
              {g.note && <p className={muted}>{g.note}</p>}
              <ul className="mt-2 text-sm">
                {g.items.map((i, idx) => (
                  <li key={idx} className="flex justify-between text-foreground/70">
                    <span>{i.label}</span>
                    <span>{money(i.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm font-medium">
                {g.headcount} paying × {money(g.perHead)} each
              </p>
            </div>

            {g.matches.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className={sectionTitle}>
                  {g.matches.length} {g.matches.length === 1 ? "match" : "matches"}
                </p>
                {g.matches.map((m, i) => (
                  <div key={`${m.number}-${i}`} className="rounded-xl bg-subtle p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Match {m.number}</p>
                      {m.scoreA !== null && m.scoreB !== null && (
                        <p className="text-xl font-bold tabular-nums">
                          <span className="text-emerald-700 dark:text-emerald-400">{m.scoreA}</span>
                          <span className="px-1.5 text-foreground/40">:</span>
                          <span className="text-sky-700 dark:text-sky-400">{m.scoreB}</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      {(["A", "B"] as const).map((t) => (
                        <div key={t}>
                          <p className={`mb-1 text-xs font-bold uppercase tracking-wider ${t === "A" ? "text-emerald-700 dark:text-emerald-400" : "text-sky-700 dark:text-sky-400"}`}>
                            Team {t}
                          </p>
                          <ul className="flex flex-col gap-1 text-sm">
                            {m.teams[t].map((p, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <Avatar name={p.name} size="sm" />
                                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                                {p.guest && <span className={pill.gray}>guest</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className={`${sectionTitle} mb-1`}>Everyone&apos;s share</p>
              <ul className="flex flex-col gap-1 text-sm">
                {g.people.map((p, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Avatar name={p.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {p.guest ? <span className={pill.gray}>guest</span> : <span className="text-foreground/60">{money(p.amount ?? 0)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </ShareShell>
  );
}
