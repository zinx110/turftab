import Link from "next/link";
import { btn, card, muted, pill } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { getGames } from "@/lib/data";
import { formatTaka } from "@/lib/money";

export default async function GamesPage() {
  await requireAdmin();
  const games = await getGames();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Games</h1>
        <Link href="/games/new" className={btn}>
          + New game
        </Link>
      </header>
      {games.length === 0 && (
        <div className={`${card} py-8 text-center`}>
          <p className="font-semibold">No games yet</p>
          <p className={muted}>Add your first game to get started.</p>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {games.map((g) => {
          const guests = g.players.filter((p) => p.guest).length;
          return (
            <li key={g.id}>
              <Link href={`/games/${g.id}`} className={`${card} block transition hover:border-emerald-600/40 active:scale-[0.99]`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{formatDate(g.playedOn)}</p>
                    {g.note && <p className={muted}>{g.note}</p>}
                  </div>
                  {g.matches.length > 0 && (
                    <span className={pill.blue}>
                      {g.matches.length} {g.matches.length === 1 ? "match" : "matches"}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={pill.gray}>{formatTaka(g.total)}</span>
                  <span className={pill.gray}>
                    {g.headcount} paying · {formatTaka(g.perHead)} each
                  </span>
                  {guests > 0 && <span className={pill.amber}>{guests} guest{guests > 1 ? "s" : ""}</span>}
                </div>
                {g.matches.some((m) => m.scoreA !== null) && (
                  <p className="mt-2 text-sm tabular-nums text-foreground/70">
                    {g.matches
                      .filter((m) => m.scoreA !== null)
                      .map((m) => `${m.scoreA}:${m.scoreB}`)
                      .join("  ·  ")}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
