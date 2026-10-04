import Link from "next/link";
import { btn, card, muted } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { getGames } from "@/lib/data";
import { formatTaka } from "@/lib/money";

export default async function GamesPage() {
  await requireAdmin();
  const games = await getGames();

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Games</h1>
        <Link href="/games/new" className={btn}>
          New game
        </Link>
      </header>
      {games.length === 0 && <p className={muted}>No games yet.</p>}
      <ul className="flex flex-col gap-2">
        {games.map((g) => (
          <li key={g.id}>
            <Link href={`/games/${g.id}`} className={`${card} block`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{formatDate(g.playedOn)}</span>
                <span className="font-semibold">{formatTaka(g.total)}</span>
              </div>
              <p className={muted}>
                {g.items.map((i) => `${i.label} ${formatTaka(i.amount)}`).join(" · ")}
              </p>
              <p className={muted}>
                {g.players.length} players × {formatTaka(g.perHead)}
                {g.surplus > 0 && ` (${formatTaka(g.surplus)} over)`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
