"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { gameItems, gamePlayers, games } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getPlayersByIds, getShareState } from "@/lib/data";
import { assignTeams, type Team } from "@/lib/teams";
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

  // Existing players keep their team when a game is edited; newcomers are
  // placed on the smaller side; a brand-new game gets a fair random split.
  const existingTeams = new Map<number, Team>();
  if (id !== undefined) {
    const rows = await db()
      .select({ playerId: gamePlayers.playerId, team: gamePlayers.team })
      .from(gamePlayers)
      .where(eq(gamePlayers.gameId, id));
    for (const r of rows) if (r.team === "A" || r.team === "B") existingTeams.set(r.playerId, r.team);
  }
  const teams = assignTeams(attendees.map((a) => a.playerId), existingTeams);

  const itemRows = (gameId: number) => items.map((i) => ({ gameId, ...i }));
  const playerRows = (gameId: number) =>
    split.lines.map((l) => ({
      gameId,
      playerId: l.playerId,
      charge: l.charge,
      isGuest: l.guest,
      billedToId: l.billedToId,
      team: teams.get(l.playerId) ?? null,
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

// Move one attendee's share to another player (or back to the attendee when
// `toId` is null). Only allowed while none of it has been paid: once a share
// is paid, it is settled for that person and stays put.
export async function moveShare(gameId: number, forId: number, toId: number | null) {
  await requireAdmin();
  const ids = z.object({ gameId: z.number().int().positive(), forId: z.number().int().positive() });
  if (!ids.safeParse({ gameId, forId }).success || (toId !== null && !Number.isInteger(toId))) {
    return { error: "Invalid request." };
  }

  const state = await getShareState(gameId, forId);
  if (!state) return { error: "That player wasn't in this game." };
  if (state.guest) return { error: "Guests don't pay, so there's nothing to move." };

  const target = toId === null || toId === forId ? null : toId; // null = the attendee pays it themselves
  if (target === state.billedToId) return { error: "It's already billed to that player." };
  if (target !== null) {
    if ((await getPlayersByIds([target])).length !== 1) return { error: "That player no longer exists." };
    if (state.guestIds.includes(target)) return { error: "That player is a guest in this game." };
  }
  if (state.paid > 0) return { error: "This share is already paid, so it can't be moved." };

  await db()
    .update(gamePlayers)
    .set({ billedToId: target })
    .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.playerId, forId)));
  revalidatePath("/", "layout");
  return {};
}

// ---- teams and score --------------------------------------------------------

export async function shuffleTeams(gameId: number) {
  await requireAdmin();
  const rows = await db()
    .select({ playerId: gamePlayers.playerId })
    .from(gamePlayers)
    .where(eq(gamePlayers.gameId, gameId));
  if (rows.length === 0) return { error: "Game not found." };
  const teams = assignTeams(rows.map((r) => r.playerId));
  // one statement, so a shuffle is all-or-nothing
  const cases = sql.join(
    [...teams].map(([playerId, team]) => sql`when ${playerId} then ${team}`),
    sql` `,
  );
  await db()
    .update(gamePlayers)
    .set({ team: sql`case ${gamePlayers.playerId} ${cases} end` })
    .where(eq(gamePlayers.gameId, gameId));
  revalidatePath("/", "layout");
  return {};
}

export async function setTeam(gameId: number, playerId: number, team: "A" | "B") {
  await requireAdmin();
  if (team !== "A" && team !== "B") return { error: "Invalid team." };
  const updated = await db()
    .update(gamePlayers)
    .set({ team })
    .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.playerId, playerId)))
    .returning({ playerId: gamePlayers.playerId });
  if (updated.length === 0) return { error: "That player wasn't in this game." };
  revalidatePath("/", "layout");
  return {};
}

const score = z.number().int().min(0).max(99);

// Pass null for both to clear the score.
export async function saveScore(gameId: number, scoreA: number | null, scoreB: number | null) {
  await requireAdmin();
  if ((scoreA === null) !== (scoreB === null)) return { error: "Enter both scores." };
  if (scoreA !== null && scoreB !== null && !(score.safeParse(scoreA).success && score.safeParse(scoreB).success)) {
    return { error: "Scores are whole numbers from 0 to 99." };
  }
  const updated = await db()
    .update(games)
    .set({ scoreA, scoreB })
    .where(eq(games.id, gameId))
    .returning({ id: games.id });
  if (updated.length === 0) return { error: "Game not found." };
  revalidatePath("/", "layout");
  return {};
}
