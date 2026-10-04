import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { MarkPaidButton } from "@/components/mark-paid-button";
import { btn, card, muted } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getDashboard } from "@/lib/data";
import { formatTaka } from "@/lib/money";

export default async function DashboardPage() {
  await requireAdmin();
  const { owing, bkash, outstanding, collected, settledCount } = await getDashboard();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">TurfTab</h1>
        <Link href="/games/new" className={btn}>
          New game
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className={card}>
          <p className={muted}>Outstanding</p>
          <p className="text-2xl font-semibold">{formatTaka(outstanding)}</p>
        </div>
        <div className={card}>
          <p className={muted}>Collected</p>
          <p className="text-2xl font-semibold">{formatTaka(collected)}</p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Who owes</h2>
        {owing.length === 0 ? (
          <p className={muted}>Everyone is settled.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {owing.map((p) => {
              const message =
                `Hi ${p.name}, you owe ${formatTaka(p.balance)} for football.` +
                (bkash ? ` Pay via bKash ${bkash}.` : "") +
                ` Details: {origin}/p/${p.token}`;
              return (
                <li key={p.id} className={`${card} flex items-center justify-between gap-3`}>
                  <Link href={`/players/${p.id}`} className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-lg font-semibold text-red-600">{formatTaka(p.balance)}</span>
                  </Link>
                  <div className="flex shrink-0 items-start gap-2">
                    <CopyButton text={message} label="Copy message" />
                    <MarkPaidButton playerId={p.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {settledCount > 0 && owing.length > 0 && (
          <p className={muted}>{settledCount} settled</p>
        )}
      </section>
    </div>
  );
}
