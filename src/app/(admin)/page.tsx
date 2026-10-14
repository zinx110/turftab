import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { CopyButton } from "@/components/copy-button";
import { MarkPaidButton } from "@/components/mark-paid-button";
import { btn, card, muted, pill, sectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDashboard } from "@/lib/data";
import { formatTaka } from "@/lib/money";

export default async function DashboardPage() {
  await requireAdmin();
  const { owing, bkash, outstanding, collected, settledCount } = await getDashboard();
  const total = outstanding + collected;
  const pct = total > 0 ? Math.round((collected / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">TurfTab</h1>
          <p className={muted}>Football fund</p>
        </div>
        <Link href="/games/new" className={btn}>
          + New game
        </Link>
      </header>

      <section className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white shadow-md">
        <p className="text-sm text-white/75">Still to collect</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">{formatTaka(outstanding)}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20" role="img" aria-label={`${pct}% collected`}>
          <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 flex justify-between text-sm text-white/80">
          <span>{formatTaka(collected)} collected</span>
          <span>{pct}%</span>
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className={sectionTitle}>Who owes</h2>
          {settledCount > 0 && <span className={pill.green}>{settledCount} settled</span>}
        </div>
        {owing.length === 0 ? (
          <div className={`${card} py-8 text-center`}>
            <p className="text-lg font-semibold">All settled 🎉</p>
            <p className={muted}>Nobody owes anything right now.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {owing.map((p) => {
              const message =
                `Hi ${p.name}, you owe ${formatTaka(p.balance)} for football.` +
                (bkash ? ` Pay via bKash ${bkash}.` : "") +
                ` Details: {origin}/p/${p.token}`;
              return (
                <li key={p.id} className={`${card} flex flex-col gap-3`}>
                  <Link href={`/players/${p.id}`} className="flex items-center gap-3">
                    <Avatar name={p.name} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400">{formatTaka(p.balance)}</span>
                  </Link>
                  <div className="flex items-start justify-end gap-2">
                    <CopyButton text={message} label="Copy message" />
                    <MarkPaidButton playerId={p.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
