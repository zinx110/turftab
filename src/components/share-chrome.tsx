import { formatTaka } from "@/lib/money";

export function ShareShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </main>
  );
}

export function BkashCard({ number }: { number: string | null }) {
  if (!number) return null;
  return (
    <section className="rounded-2xl bg-gradient-to-br from-pink-600 to-rose-700 p-4 text-white shadow-md">
      <p className="text-sm text-white/80">Pay via bKash</p>
      <p className="text-2xl font-bold tracking-wide">{number}</p>
    </section>
  );
}

export const money = formatTaka;
