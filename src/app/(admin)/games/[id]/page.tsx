import Link from "next/link";
import { notFound } from "next/navigation";
import { GameCollectRow } from "@/components/game-collect-row";
import { MoveShare } from "@/components/move-share";
import { btnGhost, card, muted } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getActivePlayers, getGameCollect } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { formatTaka } from "@/lib/money";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [data, activePlayers] = await Promise.all([getGameCollect(id), getActivePlayers()]);
  if (!data) notFound();
  const { game, payers, covered, guests } = data;
  const guestIds = guests.map((g) => g.id);

  const collected = payers.reduce((s, p) => s + p.paid, 0);
  const billed = payers.reduce((s, p) => s + p.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/games" className={muted}>
          ← Games
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{formatDate(game.playedOn)}</h1>
          <Link href={`/games/${game.id}/edit`} className={btnGhost}>
            Edit
          </Link>
        </div>
        {game.note && <p className={muted}>{game.note}</p>}
      </header>

      <section className={card}>
        <ul className="text-sm">
          {game.items.map((i) => (
            <li key={i.id} className="flex justify-between">
              <span>{i.label}</span>
              <span>{formatTaka(i.amount)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatTaka(game.total)}</span>
        </p>
        <p className={`${muted} mt-1`}>
          {game.headcount} paying × {formatTaka(game.perHead)}
          {game.surplus > 0 && ` (${formatTaka(game.surplus)} over)`}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">Collect</h2>
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
          <h2 className="font-medium">Covered by others</h2>
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
          <h2 className="font-medium">Guests (free)</h2>
          <p className={muted}>{guests.map((g) => g.name).join(", ")}</p>
        </section>
      )}
    </div>
  );
}
