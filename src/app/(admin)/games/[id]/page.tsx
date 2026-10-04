import { notFound } from "next/navigation";
import { GameForm } from "@/components/game-form";
import { requireAdmin } from "@/lib/auth";
import { getActivePlayers, getGame } from "@/lib/data";

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [game, active] = await Promise.all([getGame(id), getActivePlayers()]);
  if (!game) notFound();

  // Keep archived players who played in this game selectable.
  const known = new Set(active.map((p) => p.id));
  const players = [...active, ...game.players.filter((p) => !known.has(p.id)).map(({ id, name }) => ({ id, name }))];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Edit game</h1>
      <GameForm
        players={players}
        initial={{
          id: game.id,
          playedOn: game.playedOn,
          note: game.note ?? "",
          items: game.items.map((i) => ({ label: i.label, amount: String(i.amount) })),
          playerIds: game.players.map((p) => p.id),
        }}
      />
    </div>
  );
}
