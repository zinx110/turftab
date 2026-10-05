import Link from "next/link";
import { notFound } from "next/navigation";
import { GameForm } from "@/components/game-form";
import { muted } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getActivePlayers, getGame } from "@/lib/data";

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [game, active] = await Promise.all([getGame(id), getActivePlayers()]);
  if (!game) notFound();

  // Keep archived players selectable if they played, or if their share was billed to them.
  const known = new Map(active.map((p) => [p.id, p.name]));
  for (const p of game.players) {
    known.set(p.id, p.name);
    if (p.billedToId !== null && p.billedToName) known.set(p.billedToId, p.billedToName);
  }
  const players = [...known].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Link href={`/games/${game.id}`} className={muted}>
          ← Back to game
        </Link>
        <h1 className="text-2xl font-semibold">Edit game</h1>
      </header>
      <GameForm
        players={players}
        initial={{
          id: game.id,
          playedOn: game.playedOn,
          note: game.note ?? "",
          items: game.items.map((i) => ({ label: i.label, amount: String(i.amount) })),
          attendees: game.players.map((p) => ({ playerId: p.id, guest: p.guest, billedToId: p.billedToId })),
        }}
      />
    </div>
  );
}
