"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { gameItems, gamePlayers, games } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getPlayersByIds } from "@/lib/data";
import { computeCharges } from "@/lib/money";

const attendee = z.object({
  playerId: z.number().int().positive(),
  guest: z.boolean().optional(),
  billedToId: z.number().int().positive().nullable().optional(),
});

const gameSchema = z.object({
  id: z.number().int().positive().optional(),
  playedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  note: z.string().trim().max(200).optional(),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1, "Every cost needs a label").max(60),
        amount: z.number().int("Whole amounts only").min(1, "Amounts must be above 0").max(1_000_000),
      }),
    )
    .min(1, "Add at least one cost")
    .max(20),
  attendees: z.array(attendee).min(1, "Pick who played").max(100),
});

export type GameInput = z.input<typeof gameSchema>;

export async function saveGame(input: GameInput) {
  await requireAdmin();
  const parsed = gameSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, playedOn, note, items, attendees } = parsed.data;

  const total = items.reduce((s, i) => s + i.amount, 0);
  let split: ReturnType<typeof computeCharges>;
  try {
    split = computeCharges(total, attendees);
  } catch (e) {
    return { error: e instanceof RangeError ? e.message : "Couldn't work out the split." };
  }

  // attendees and anyone a share is billed to (who may not have played)
  const needed = [...new Set(attendees.flatMap((a) => [a.playerId, ...(a.billedToId ? [a.billedToId] : [])]))];
  if ((await getPlayersByIds(needed)).length !== needed.length) {
    return { error: "Some selected players no longer exist." };
  }

  const itemRows = (gameId: number) => items.map((i) => ({ gameId, ...i }));
  const playerRows = (gameId: number) =>
    split.lines.map((l) => ({
      gameId,
      playerId: l.playerId,
      charge: l.charge,
      isGuest: l.guest,
      billedToId: l.billedToId,
    }));

  if (id === undefined) {
    // neon-http can't return an id mid-batch, so reserve it first, then
    // write the whole game in one atomic batch.
    const next = await db().execute<{ id: number }>(
      sql`select nextval(pg_get_serial_sequence('games', 'id'))::int as id`,
    );
    const gameId = next.rows[0].id;
    await db().batch([
      db().insert(games).values({ id: gameId, playedOn, note: note || null }),
      db().insert(gameItems).values(itemRows(gameId)),
      db().insert(gamePlayers).values(playerRows(gameId)),
    ]);
  } else {
    const [exists] = await db().select({ id: games.id }).from(games).where(eq(games.id, id));
    if (!exists) return { error: "Game not found." };
    // charges are regenerated, so balances for this game's players change
    await db().batch([
      db().update(games).set({ playedOn, note: note || null }).where(eq(games.id, id)),
      db().delete(gameItems).where(eq(gameItems.gameId, id)),
      db().delete(gamePlayers).where(eq(gamePlayers.gameId, id)),
      db().insert(gameItems).values(itemRows(id)),
      db().insert(gamePlayers).values(playerRows(id)),
    ]);
  }

  revalidatePath("/", "layout");
  redirect("/games");
}

export async function deleteGame(id: number) {
  await requireAdmin();
  await db().delete(games).where(eq(games.id, id)); // items + attendance cascade
  revalidatePath("/", "layout");
  redirect("/games");
}
