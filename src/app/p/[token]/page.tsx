import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BkashCard, money, ShareShell } from "@/components/share-chrome";
import { card, muted } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { getPlayerShare } from "@/lib/data";

export const metadata: Metadata = { title: "My TurfTab", robots: { index: false, follow: false } };

// Public, token-protected. Everything here belongs to the one player the
// token identifies; no other player's data is ever loaded.
export default async function PlayerSharePage({ params }: { params: Promise<{ token: string }> }) {
  const data = await getPlayerShare((await params).token);
  if (!data) notFound();

  const unpaid = data.perGame.filter((g) => g.due > 0).reverse();

  return (
    <ShareShell title={`Hi ${data.name}`}>
      <section className={card}>
        {data.balance > 0 ? (
          <>
            <p className={muted}>You owe</p>
            <p className="text-3xl font-semibold text-red-600">{money(data.balance)}</p>
          </>
        ) : data.balance < 0 ? (
          <>
            <p className={muted}>You&apos;re ahead by</p>
            <p className="text-3xl font-semibold text-emerald-600">{money(-data.balance)}</p>
          </>
        ) : (
          <p className="text-2xl font-semibold text-emerald-600">All settled. Thanks!</p>
        )}
      </section>

      {data.balance > 0 && <BkashCard number={data.bkash} />}

      {unpaid.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Games you owe for</h2>
          <ul className="flex flex-col gap-2">
            {unpaid.map((g) => (
              <li key={g.gameId} className={`${card} flex items-center justify-between`}>
                <span>{formatDate(g.playedOn)}</span>
                <span className="font-semibold">
                  {money(g.due)}
                  {g.paid > 0 && <span className={`${muted} font-normal`}> (of {money(g.charge)})</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.payments.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Your payments</h2>
          <ul className="flex flex-col gap-2">
            {data.payments.map((p) => (
              <li key={p.id} className={`${card} flex items-center justify-between`}>
                <span>{formatDate(p.paidOn)}</span>
                <span className="font-medium">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </ShareShell>
  );
}
