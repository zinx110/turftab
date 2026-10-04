import { formatTaka } from "@/lib/money";
import { card, muted } from "./ui";

export function ShareShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

export function BkashCard({ number }: { number: string | null }) {
  if (!number) return null;
  return (
    <section className={card}>
      <p className={muted}>Pay via bKash</p>
      <p className="text-xl font-semibold tracking-wide">{number}</p>
    </section>
  );
}

export const money = formatTaka;
