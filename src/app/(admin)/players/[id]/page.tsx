import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import {
  ArchiveButton,
  DeletePaymentButton,
  PayForm,
  PlayerProfileForm,
  RegenerateLinkButton,
} from "@/components/player-controls";
import { card, muted } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { getPlayerDetail } from "@/lib/data";
import { formatTaka } from "@/lib/money";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const detail = await getPlayerDetail(id);
  if (!detail) notFound();
  const { player, perGame, payments, balance, charged, paid } = detail;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link href="/players" className={muted}>
          ← Players
        </Link>
        <h1 className="text-2xl font-semibold">{player.name}</h1>
        {!player.active && <p className={muted}>Archived</p>}
      </header>

      <section className={card}>
        <p className={muted}>{balance > 0 ? "Owes" : balance < 0 ? "Credit" : "Balance"}</p>
        <p className={`text-3xl font-semibold ${balance > 0 ? "text-red-600" : ""}`}>
          {balance === 0 ? "Settled" : formatTaka(Math.abs(balance))}
        </p>
        <p className={muted}>
          {formatTaka(charged)} charged · {formatTaka(paid)} paid
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Record payment</h2>
        <PayForm playerId={player.id} balance={balance} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Games</h2>
        {perGame.length === 0 && <p className={muted}>No games yet.</p>}
        <ul className="flex flex-col gap-2">
          {[...perGame].reverse().map((g) => (
            <li key={g.gameId} className={`${card} flex items-center justify-between`}>
              <Link href={`/games/${g.gameId}`}>{formatDate(g.playedOn)}</Link>
              <span className="text-right">
                <span className="block font-medium">{formatTaka(g.charge)}</span>
                <span className={g.due === 0 ? "text-sm text-emerald-600" : "text-sm text-red-600"}>
                  {g.due === 0 ? "paid" : g.paid > 0 ? `${formatTaka(g.due)} left` : "unpaid"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Payments</h2>
        {payments.length === 0 && <p className={muted}>None yet.</p>}
        <ul className="flex flex-col gap-2">
          {payments.map((p) => (
            <li key={p.id} className={`${card} flex items-center justify-between`}>
              <span>
                <span className="block font-medium">{formatTaka(p.amount)}</span>
                <span className={muted}>{formatDate(p.paidOn)}</span>
              </span>
              <DeletePaymentButton id={p.id} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Details</h2>
        <PlayerProfileForm id={player.id} name={player.name} phone={player.phone ?? ""} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Personal link</h2>
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
