import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToGame } from "@/components/add-to-game";
import { GameCollectRow } from "@/components/game-collect-row";
import { MoveShare } from "@/components/move-share";
import { AddMatchButton } from "@/components/add-match-button";
import { MatchCard } from "@/components/match-card";
import { ShareLink } from "@/components/share-link";
import { btnGhost, card, muted, pill, sectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getActivePlayers, getGameCollect, getGroupToken } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { formatTaka } from "@/lib/money";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [data, activePlayers, groupToken] = await Promise.all([getGameCollect(id), getActivePlayers(), getGroupToken()]);
  if (!data) notFound();
  const { game, payers, covered, guests } = data;
  const guestIds = guests.map((g) => g.id);
  const inGame = new Set(game.players.map((p) => p.id));
  const candidates = activePlayers.filter((p) => !inGame.has(p.id));

  const collected = payers.reduce((s, p) => s + p.paid, 0);
  const billed = payers.reduce((s, p) => s + p.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/games" className={muted}>
          ← Games
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{formatDate(game.playedOn)}</h1>
          <Link href={`/games/${game.id}/edit`} className={btnGhost}>
            Edit
          </Link>
        </div>
        {game.note && <p className={muted}>{game.note}</p>}
      </header>

      <section className={`${card} flex flex-col gap-3`}>
        <ul className="flex flex-col gap-1.5 text-sm">
          {game.items.map((i) => (
            <li key={i.id} className="flex justify-between">
              <span className="text-foreground/70">{i.label}</span>
              <span className="font-medium">{formatTaka(i.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold">{formatTaka(game.total)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={pill.green}>
            {game.headcount} paying × {formatTaka(game.perHead)}
          </span>
          {game.surplus > 0 && <span className={pill.gray}>{formatTaka(game.surplus)} over</span>}
        </div>
      </section>

      <ShareLink path={`/s/${groupToken}#game-${game.id}`} />

      <section className="flex flex-col gap-5">
        <h2 className={sectionTitle}>Matches</h2>
        {game.matches.length === 0 && (
          <p className={muted}>No matches yet. Add the first one to draw teams.</p>
        )}
        {game.matches.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            bench={game.players.filter((p) => !m.players.some((x) => x.id === p.id)).map((p) => ({ id: p.id, name: p.name }))}
          />
        ))}
        <AddMatchButton gameId={game.id} next={game.matches.length + 1} />
      </section>

      <AddToGame
        gameId={game.id}
        candidates={candidates}
        total={game.total}
        headcount={game.headcount}
        anyPaid={payers.some((p) => p.paid > 0)}
        matches={game.matches.map((m) => ({ id: m.id, number: m.number }))}
      />

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className={sectionTitle}>Collect</h2>
          <p className={muted}>
            {formatTaka(collected)} of {formatTaka(billed)} collected
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {payers.map((p) => (
            <GameCollectRow key={p.id} gameId={game.id} payer={p} players={activePlayers} guestIds={guestIds} />
          ))}
        </ul>
        <p className={muted}>
          Payments here are recorded against this game first. Use a player&apos;s page to see everything they owe.
        </p>
      </section>

      {covered.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={sectionTitle}>Covered by others</h2>
          <ul className="flex flex-col gap-2">
            {covered.map((c) => (
              <li key={c.id} className={`${card} flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm`}>
                <span>
                  {c.name} · {formatTaka(c.charge)} · covered by {c.billedToName}
                </span>
                {c.movable ? (
                  <MoveShare
                    gameId={game.id}
                    forId={c.id}
                    forName={c.name}
                    options={activePlayers.filter((p) => p.id !== c.id && p.id !== c.billedToId && !guestIds.includes(p.id))}
                    canReset
                    label="Change"
                  />
                ) : (
                  <span className={muted}>settled</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {guests.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className={sectionTitle}>Guests (free)</h2>
          <p className={muted}>{guests.map((g) => g.name).join(", ")}</p>
        </section>
      )}
    </div>
  );
}
