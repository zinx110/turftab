import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BkashCard, money, ShareShell } from "@/components/share-chrome";
import { Avatar } from "@/components/avatar";
import { card, muted, pill } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { getGroupShare } from "@/lib/data";

export const metadata: Metadata = { title: "TurfTab games", robots: { index: false, follow: false } };

// Public, token-protected. Shows games, costs, everyone who played and their
// share, with a guest tag. It deliberately never loads balances, payments or
// who covered whom.
export default async function GroupSharePage({ params }: { params: Promise<{ token: string }> }) {
  const data = await getGroupShare((await params).token);
  if (!data) notFound();

  return (
    <ShareShell title="Football games">
      <BkashCard number={data.bkash} />
      {data.games.length === 0 && <p className={muted}>No games yet.</p>}
      <ul className="flex flex-col gap-3">
        {data.games.map((g) => (
          <li key={g.id} className={card}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-medium">{formatDate(g.playedOn)}</h2>
              <span className="font-semibold">{money(g.total)}</span>
            </div>
            {g.note && <p className={muted}>{g.note}</p>}
            <ul className="mt-2 text-sm">
              {g.items.map((i, idx) => (
                <li key={idx} className="flex justify-between">
                  <span>{i.label}</span>
                  <span>{money(i.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-medium">
              {g.headcount} paying × {money(g.perHead)} each
            </p>
            {g.scoreA !== null && g.scoreB !== null && (
              <p className="mt-3 rounded-xl bg-subtle py-2 text-center text-2xl font-bold tabular-nums">
                <span className="text-emerald-700 dark:text-emerald-400">{g.scoreA}</span>
                <span className="px-2 text-foreground/40">:</span>
                <span className="text-sky-700 dark:text-sky-400">{g.scoreB}</span>
              </p>
            )}
            {g.people.some((p) => p.team) ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {(["A", "B"] as const).map((t) => (
                  <div key={t}>
                    <p className={`mb-1 text-xs font-bold uppercase tracking-wider ${t === "A" ? "text-emerald-700 dark:text-emerald-400" : "text-sky-700 dark:text-sky-400"}`}>
                      Team {t}
                    </p>
                    <ul className="flex flex-col gap-1 text-sm">
                      {g.people.filter((p) => p.team === t).map((person, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Avatar name={person.name} size="sm" />
                          <span className="min-w-0 flex-1 truncate">{person.name}</span>
                          {person.guest ? <span className={pill.gray}>guest</span> : <span className="text-foreground/60">{money(person.amount ?? 0)}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-1 text-sm">
                {g.people.map((person, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Avatar name={person.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{person.name}</span>
                    {person.guest ? <span className={pill.gray}>guest</span> : <span className="text-foreground/60">{money(person.amount ?? 0)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </ShareShell>
  );
}
