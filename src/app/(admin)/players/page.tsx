import Link from "next/link";
import { AddPlayerForm } from "@/components/player-controls";
import { Avatar } from "@/components/avatar";
import { card, muted, pill, sectionTitle } from "@/components/ui";
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
      <Link href={`/players/${p.id}`} className={`${card} flex items-center gap-3 py-3 transition hover:border-emerald-600/40 active:scale-[0.99]`}>
        <Avatar name={p.name} />
        <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
        {p.balance > 0 ? (
          <span className={pill.red}>{formatTaka(p.balance)}</span>
        ) : p.balance < 0 ? (
          <span className={pill.blue}>{formatTaka(-p.balance)} credit</span>
        ) : (
          <span className={pill.green}>settled</span>
        )}
      </Link>
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Players</h1>
      <AddPlayerForm />
      {active.length === 0 && <p className={muted}>No players yet.</p>}
      <ul className="flex flex-col gap-2">{active.map(row)}</ul>
      {archived.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={sectionTitle}>Archived</h2>
          <ul className="flex flex-col gap-2 opacity-70">{archived.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
