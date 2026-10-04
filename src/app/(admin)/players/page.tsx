import Link from "next/link";
import { AddPlayerForm } from "@/components/player-controls";
import { card, muted } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getPlayersWithBalances } from "@/lib/data";
import { formatTaka } from "@/lib/money";

export default async function PlayersPage() {
  await requireAdmin();
  const all = await getPlayersWithBalances();
  const active = all.filter((p) => p.active);
  const archived = all.filter((p) => !p.active);

  const row = (p: (typeof all)[number]) => (
    <li key={p.id}>
      <Link href={`/players/${p.id}`} className={`${card} flex items-center justify-between`}>
        <span className="font-medium">{p.name}</span>
        <span className={p.balance > 0 ? "font-semibold text-red-600" : muted}>
          {p.balance > 0 ? formatTaka(p.balance) : p.balance < 0 ? `${formatTaka(-p.balance)} credit` : "settled"}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Players</h1>
      <AddPlayerForm />
      {active.length === 0 && <p className={muted}>No players yet.</p>}
      <ul className="flex flex-col gap-2">{active.map(row)}</ul>
      {archived.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={muted}>Archived</h2>
          <ul className="flex flex-col gap-2 opacity-70">{archived.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
