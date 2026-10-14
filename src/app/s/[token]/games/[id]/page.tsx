import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { MatchView } from "@/components/match-view";
import { BkashCard, money, ShareShell } from "@/components/share-chrome";
import { card, muted, pill, sectionTitle } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { getGroupShare } from "@/lib/data";

export const metadata: Metadata = {
  title: "TurfTab game",
  description: "Football game, teams and shares.",
  robots: { index: false, follow: false },
};

// Public, read-only mirror of the admin game page: costs, every match with
// its teams and score, and everyone's share with guest tags. It leaves out
// everything that is an action or a payment: edit, add player, mark paid,
// paid/unpaid status, balances, and who covered whom.
export default async function PublicGamePage({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const gameId = Number(id);
  if (!Number.isInteger(gameId)) notFound();
  const data = await getGroupShare(token, gameId);
  const game = data?.games[0];
  if (!data || !game) notFound();

  const guests = game.people.filter((p) => p.guest).length;

  return (
    <ShareShell title={formatDate(game.playedOn)} subtitle={game.note} back={{ href: `/s/${token}`, label: "All games" }}>
      <section className={`${card} flex flex-col gap-4 shadow-lg`}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className={sectionTitle}>Total</p>
            <p className="text-3xl font-extrabold tracking-tight">{money(game.total)}</p>
          </div>
          <div className="text-right">
            <p className={sectionTitle}>Each</p>
            <p className="text-3xl font-extrabold tracking-tight text-emerald-600">{money(game.perHead)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={pill.green}>{game.headcount} paying</span>
          {game.matches.length > 0 && (
            <span className={pill.blue}>
              {game.matches.length} {game.matches.length === 1 ? "match" : "matches"}
            </span>
          )}
          {guests > 0 && (
            <span className={pill.amber}>
              {guests} guest{guests > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <ul className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
          {game.items.map((i, idx) => (
            <li key={idx} className="flex justify-between">
              <span className="text-foreground/65">{i.label}</span>
              <span className="font-medium">{money(i.amount)}</span>
            </li>
          ))}
        </ul>
      </section>

      <BkashCard number={data.bkash} />

      {game.matches.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={`${sectionTitle} px-1`}>Matches</h2>
          {game.matches.map((m) => (
            <MatchView key={m.number} match={m} />
          ))}
        </section>
      )}

      <details className={`${card} group overflow-hidden p-0!`}>
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span className="flex-1 font-semibold">Everyone&apos;s share</span>
          <span className={pill.gray}>{game.people.length} people</span>
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-foreground/45 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <ul className="divide-y divide-line border-t border-line">
          {game.people.map((p, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar name={p.name} size="sm" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.guest ? <span className={pill.amber}>guest · free</span> : <span className="font-semibold">{money(p.amount ?? 0)}</span>}
            </li>
          ))}
        </ul>
        <p className={`${muted} border-t border-line px-4 py-3`}>Each person&apos;s share of the total, split equally among paying players.</p>
      </details>
    </ShareShell>
  );
}
