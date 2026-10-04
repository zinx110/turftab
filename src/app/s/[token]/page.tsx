import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BkashCard, money, ShareShell } from "@/components/share-chrome";
import { card, muted } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { getGroupShare } from "@/lib/data";

export const metadata: Metadata = { title: "TurfTab games", robots: { index: false, follow: false } };

// Public, token-protected. Shows games, costs and who played. It deliberately
// never loads balances or payments.
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
              {g.playerNames.length} played × {money(g.perHead)} each
            </p>
            <p className={muted}>{g.playerNames.join(", ")}</p>
          </li>
        ))}
      </ul>
    </ShareShell>
  );
}
