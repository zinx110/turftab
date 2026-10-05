import { GameForm } from "@/components/game-form";
import { requireAdmin } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { getActivePlayers } from "@/lib/data";

export default async function NewGamePage() {
  await requireAdmin();
  const players = await getActivePlayers();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New game</h1>
      <GameForm
        players={players}
        initial={{ playedOn: todayISO(), note: "", items: [{ label: "Turf", amount: "" }], attendees: [] }}
      />
    </div>
  );
}
