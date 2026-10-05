import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BkashCard, money, ShareShell } from "@/components/share-chrome";
import { card, muted } from "@/components/ui";
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
            <ul className="mt-1 text-sm">
              {g.people.map((person, idx) => (
                <li key={idx} className="flex items-center justify-between py-0.5">
                  <span>{person.name}</span>
                  {person.guest ? (
                    <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs dark:border-white/20">
                      guest
                    </span>
                  ) : (
                    <span>{money(person.amount ?? 0)}</span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </ShareShell>
  );
}
