import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { MoveShare } from "@/components/move-share";
import {
  ArchiveButton,
  DeletePaymentButton,
  PayForm,
  PlayerProfileForm,
  RegenerateLinkButton,
} from "@/components/player-controls";
import { Avatar } from "@/components/avatar";
import { card, muted, pill, sectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { getActivePlayers, getPlayerDetail } from "@/lib/data";
import { formatTaka } from "@/lib/money";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [detail, activePlayers] = await Promise.all([getPlayerDetail(id), getActivePlayers()]);
  if (!detail) notFound();
  const { player, perGame, payments, balance, charged, paid, coveredAway, guestsByGame, record } = detail;

  // One card per game: what this player owes (if anything) and any share of
  // theirs that someone else is covering.
  type GameCard = {
    gameId: number;
    playedOn: string;
    payer?: (typeof perGame)[number];
    away?: (typeof coveredAway)[number];
  };
  const cards = new Map<number, GameCard>();
  for (const g of perGame) cards.set(g.gameId, { gameId: g.gameId, playedOn: g.playedOn, payer: g });
  for (const a of coveredAway) {
    cards.set(a.gameId, { ...(cards.get(a.gameId) ?? { gameId: a.gameId, playedOn: a.playedOn }), away: a });
  }
  const ordered = [...cards.values()].sort((a, b) => b.playedOn.localeCompare(a.playedOn) || b.gameId - a.gameId);

  // Who a share can be moved to: anyone active except its owner, its current
  // payer, and guests in that game.
  const optionsFor = (gameId: number, forId: number, currentPayerId: number | null) =>
    activePlayers.filter((p) => p.id !== forId && p.id !== currentPayerId && !(guestsByGame[gameId] ?? []).includes(p.id));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link href="/players" className={muted}>
          ← Players
        </Link>
        <div className="flex items-center gap-3">
          <Avatar name={player.name} size="lg" />
          <div>
            <h1 className="text-2xl font-bold">{player.name}</h1>
            {!player.active && <span className={pill.gray}>Archived</span>}
          </div>
        </div>
      </header>

      <section className={`${card} flex items-end justify-between gap-3`}>
        <div>
          <p className={muted}>{balance > 0 ? "Owes" : balance < 0 ? "Credit" : "Balance"}</p>
          <p className={`text-3xl font-bold ${balance > 0 ? "text-red-600 dark:text-red-400" : balance < 0 ? "text-sky-600" : "text-emerald-600"}`}>
            {balance === 0 ? "Settled" : formatTaka(Math.abs(balance))}
          </p>
        </div>
        <p className="text-right text-sm text-foreground/60">
          {formatTaka(charged)} charged
          <br />
          {formatTaka(paid)} paid
        </p>
      </section>

      {record.played > 0 && (
        <section className={`${card} flex flex-col gap-3`}>
          <p className={sectionTitle}>Match record · {record.played} played</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-600/10 py-2">
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{record.win}</p>
              <p className="text-xs font-medium text-foreground/60">Won</p>
            </div>
            <div className="rounded-xl bg-subtle py-2">
              <p className="text-2xl font-bold">{record.draw}</p>
              <p className="text-xs font-medium text-foreground/60">Drawn</p>
            </div>
            <div className="rounded-xl bg-red-600/10 py-2">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{record.loss}</p>
              <p className="text-xs font-medium text-foreground/60">Lost</p>
            </div>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Record payment</h2>
        <PayForm playerId={player.id} balance={balance} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Games</h2>
        {ordered.length === 0 && <p className={muted}>No games yet.</p>}
        <ul className="flex flex-col gap-2">
          {ordered.map(({ gameId, playedOn, payer, away }) => (
            <li key={gameId} className={`${card} flex flex-col gap-2`}>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/games/${gameId}`} className="font-medium">
                  {formatDate(playedOn)}
                </Link>
                {payer ? (
                  <span className="text-right">
                    <span className="block font-bold">{formatTaka(payer.charge)}</span>
                    <span className={payer.due === 0 ? pill.green : payer.paid > 0 ? pill.amber : pill.red}>
                      {payer.due === 0 ? "paid" : payer.paid > 0 ? `${formatTaka(payer.due)} left` : "unpaid"}
                    </span>
                  </span>
                ) : (
                  <span className={pill.gray}>nothing to pay</span>
                )}
              </div>

              {payer && (payer.lines.length > 1 || payer.lines.some((l) => l.movable || !l.own)) && (
                <ul className="flex flex-col gap-1 text-sm">
                  {payer.lines.map((l) => (
                    <li key={l.forId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span>
                        {l.own ? "Own share" : `For ${l.forName}`} · {formatTaka(l.charge)}
                        {l.due === 0 ? " · paid" : l.paid > 0 ? " · part paid" : ""}
                      </span>
                      {l.movable && (
                        <MoveShare
                          gameId={gameId}
                          forId={l.forId}
                          forName={l.forName}
                          options={optionsFor(gameId, l.forId, l.own ? null : player.id)}
                          canReset={!l.own}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {away && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                  <span>
                    Covered by {away.billedToName} · {formatTaka(away.charge)}
                  </span>
                  {away.movable ? (
                    <MoveShare
                      gameId={gameId}
                      forId={player.id}
                      forName={player.name}
                      options={optionsFor(gameId, player.id, away.billedToId)}
                      canReset
                      label="Change"
                    />
                  ) : (
                    <span className={muted}>settled</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Payments</h2>
        {payments.length === 0 && <p className={muted}>None yet.</p>}
        <ul className="flex flex-col gap-2">
          {payments.map((p) => (
            <li key={p.id} className={`${card} flex items-center justify-between`}>
              <span>
                <span className="block font-medium">{formatTaka(p.amount)}</span>
                <span className={muted}>
                  {formatDate(p.paidOn)}
                  {p.gameId !== null &&
                    (() => {
                      const g = perGame.find((x) => x.gameId === p.gameId);
                      return g ? ` · for ${formatDate(g.playedOn)}` : "";
                    })()}
                </span>
              </span>
              <DeletePaymentButton id={p.id} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Details</h2>
        <PlayerProfileForm id={player.id} name={player.name} phone={player.phone ?? ""} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={sectionTitle}>Personal link</h2>
        <p className={muted}>Shows only this player&apos;s balance. Regenerate if it leaks.</p>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={`{origin}/p/${player.token}`} label="Copy link" />
          <RegenerateLinkButton playerId={player.id} />
          <ArchiveButton id={player.id} active={player.active} />
        </div>
      </section>
    </div>
  );
}
