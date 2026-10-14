"use server";

import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { gameItems, gamePlayers, games, matchPlayers, matches } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { getGame, getPlayersByIds, getShareState } from "@/lib/data";
import { assignTeams, freshDraw, type Team } from "@/lib/teams";
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

// The teams currently in a match, as a map.
async function teamsOfMatch(matchId: number) {
  const rows = await db()
    .select({ playerId: matchPlayers.playerId, team: matchPlayers.team })
    .from(matchPlayers)
    .where(eq(matchPlayers.matchId, matchId));
  return new Map<number, Team>(rows.map((r) => [r.playerId, r.team === "B" ? "B" : "A"]));
}

// Put people into an existing match. Whoever is already there keeps their
// side; newcomers go to the smaller one.
async function joinMatch(matchId: number, gameId: number, playerIds: number[]) {
  const current = await teamsOfMatch(matchId);
  const fresh = playerIds.filter((id) => !current.has(id));
  if (fresh.length === 0) return;
  const teams = assignTeams([...current.keys(), ...fresh], current);
  await db()
    .insert(matchPlayers)
    .values(fresh.map((playerId) => ({ matchId, gameId, playerId, team: teams.get(playerId)! })))
    .onConflictDoNothing();
}

async function latestMatchId(gameId: number) {
  const [m] = await db()
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.gameId, gameId))
    .orderBy(desc(matches.number), desc(matches.id))
    .limit(1);
  return m?.id ?? null;
}

// Does the work of saving a game day. Shared by the form and "add a player".
// `joinMatchId` says which match newly added attendees join when editing:
// undefined = the latest match, null = none.
async function persistGame(input: GameInput, opts: { joinMatchId?: number | null } = {}) {
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
    // neon-http can't return an id mid-batch, so reserve ids first, then
    // write the whole game day (with its first match) in one atomic batch.
    const next = await db().execute<{ game_id: number; match_id: number }>(
      sql`select nextval(pg_get_serial_sequence('games', 'id'))::int as game_id, nextval(pg_get_serial_sequence('matches', 'id'))::int as match_id`,
    );
    const { game_id: gameId, match_id: matchId } = next.rows[0];
    const teams = freshDraw(attendees.map((a) => a.playerId));
    await db().batch([
      db().insert(games).values({ id: gameId, playedOn, note: note || null }),
      db().insert(gameItems).values(itemRows(gameId)),
      db().insert(gamePlayers).values(playerRows(gameId)),
      db().insert(matches).values({ id: matchId, gameId, number: 1 }),
      db().insert(matchPlayers).values(
        [...teams].map(([playerId, team]) => ({ matchId, gameId, playerId, team })),
      ),
    ]);
  } else {
    const [exists] = await db().select({ id: games.id }).from(games).where(eq(games.id, id));
    if (!exists) return { error: "Game not found." };
    const before = new Set(
      (await db().select({ playerId: gamePlayers.playerId }).from(gamePlayers).where(eq(gamePlayers.gameId, id))).map((r) => r.playerId),
    );
    const keep = attendees.map((a) => a.playerId);
    // Update attendees in place (not delete-and-reinsert) so match membership
    // survives; anyone taken off the game day drops out of every match.
    await db().batch([
      db().update(games).set({ playedOn, note: note || null }).where(eq(games.id, id)),
      db().delete(gameItems).where(eq(gameItems.gameId, id)),
      db().insert(gameItems).values(itemRows(id)),
      db().delete(gamePlayers).where(and(eq(gamePlayers.gameId, id), notInArray(gamePlayers.playerId, keep))),
      db()
        .insert(gamePlayers)
        .values(playerRows(id))
        .onConflictDoUpdate({
          target: [gamePlayers.gameId, gamePlayers.playerId],
          set: {
            charge: sql`excluded.charge`,
            isGuest: sql`excluded.is_guest`,
            billedToId: sql`excluded.billed_to_id`,
          },
        }),
    ]);
    const newcomers = keep.filter((pid) => !before.has(pid));
    const target = opts.joinMatchId === undefined ? await latestMatchId(id) : opts.joinMatchId;
    if (target !== null && newcomers.length > 0) await joinMatch(target, id, newcomers);
  }

  revalidatePath("/", "layout");
  return {};
}

export async function saveGame(input: GameInput) {
  const result = await persistGame(input);
  if (result.error) return result;
  redirect("/games");
}

// Add someone to a game day that already exists. Everyone's share is
// recalculated (more people, smaller share); teams, scores and who-covers-whom
// are kept. `matchId` is the match they join (null = none, undefined = the
// latest); they go to its smaller team.
export async function addPlayerToGame(gameId: number, playerId: number, mode: "own" | "guest", matchId?: number | null) {
  await requireAdmin();
  const game = await getGame(gameId);
  if (!game) return { error: "Game not found." };
  if (game.players.some((p) => p.id === playerId)) return { error: "They're already in this game." };
  if (mode !== "own" && mode !== "guest") return { error: "Invalid choice." };
  if (typeof matchId === "number" && !game.matches.some((m) => m.id === matchId)) {
    return { error: "That match isn't part of this game." };
  }

  return persistGame(
    {
      id: gameId,
      playedOn: game.playedOn,
      note: game.note ?? undefined,
      items: game.items.map((i) => ({ label: i.label, amount: i.amount })),
      attendees: [
        ...game.players.map((p) => ({ playerId: p.id, guest: p.guest, billedToId: p.billedToId })),
        { playerId, guest: mode === "guest" },
      ],
    },
    { joinMatchId: matchId },
  );
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

// ---- matches: teams, scores, who played ------------------------------------

async function findMatch(matchId: number) {
  const [m] = await db().select().from(matches).where(eq(matches.id, matchId));
  return m ?? null;
}

// Add the next match to a game day. Everyone who attended is in it, drawn
// into fresh teams that differ from the previous match's split.
export async function addMatch(gameId: number) {
  await requireAdmin();
  const [game] = await db().select({ id: games.id }).from(games).where(eq(games.id, gameId));
  if (!game) return { error: "Game not found." };
  const attendees = (
    await db().select({ playerId: gamePlayers.playerId }).from(gamePlayers).where(eq(gamePlayers.gameId, gameId))
  ).map((r) => r.playerId);
  if (attendees.length === 0) return { error: "Add players to the game first." };

  const last = await latestMatchId(gameId);
  const previous = last === null ? undefined : await teamsOfMatch(last);
  const [{ n }] = await db()
    .select({ n: sql<number>`coalesce(max(${matches.number}), 0)::int` })
    .from(matches)
    .where(eq(matches.gameId, gameId));
  const teams = freshDraw(attendees, previous);

  const next = await db().execute<{ id: number }>(
    sql`select nextval(pg_get_serial_sequence('matches', 'id'))::int as id`,
  );
  const matchId = next.rows[0].id;
  await db().batch([
    db().insert(matches).values({ id: matchId, gameId, number: n + 1 }),
    db().insert(matchPlayers).values([...teams].map(([playerId, team]) => ({ matchId, gameId, playerId, team }))),
  ]);
  revalidatePath("/", "layout");
  return {};
}

// Matches carry no money, so deleting one is always safe. Later matches are
// renumbered so the numbers stay 1, 2, 3…
export async function deleteMatch(matchId: number) {
  await requireAdmin();
  const m = await findMatch(matchId);
  if (!m) return { error: "Match not found." };
  await db().batch([
    db().delete(matches).where(eq(matches.id, matchId)),
    db()
      .update(matches)
      .set({ number: sql`${matches.number} - 1` })
      .where(and(eq(matches.gameId, m.gameId), sql`${matches.number} > ${m.number}`)),
  ]);
  revalidatePath("/", "layout");
  return {};
}

// Someone left early: take them out of this match only. They stay on the game
// day, so what they owe doesn't change.
export async function removeFromMatch(matchId: number, playerId: number) {
  await requireAdmin();
  const removed = await db()
    .delete(matchPlayers)
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.playerId, playerId)))
    .returning({ playerId: matchPlayers.playerId });
  if (removed.length === 0) return { error: "They aren't in this match." };
  revalidatePath("/", "layout");
  return {};
}

// Put a game-day attendee into a match (they join the smaller team).
export async function addToMatch(matchId: number, playerId: number) {
  await requireAdmin();
  const m = await findMatch(matchId);
  if (!m) return { error: "Match not found." };
  const [attended] = await db()
    .select({ playerId: gamePlayers.playerId })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.gameId, m.gameId), eq(gamePlayers.playerId, playerId)));
  if (!attended) return { error: "They didn't attend this game day." };
  if ((await teamsOfMatch(matchId)).has(playerId)) return { error: "They're already in this match." };
  await joinMatch(matchId, m.gameId, [playerId]);
  revalidatePath("/", "layout");
  return {};
}

// Re-draw this match's teams, different from how they are now when possible.
export async function shuffleTeams(matchId: number) {
  await requireAdmin();
  const current = await teamsOfMatch(matchId);
  if (current.size === 0) return { error: "Match not found." };
  const teams = freshDraw([...current.keys()], current);
  // one statement, so a shuffle is all-or-nothing
  const cases = sql.join([...teams].map(([playerId, team]) => sql`when ${playerId} then ${team}`), sql` `);
  await db()
    .update(matchPlayers)
    .set({ team: sql`case ${matchPlayers.playerId} ${cases} end` })
    .where(eq(matchPlayers.matchId, matchId));
  revalidatePath("/", "layout");
  return {};
}

export async function setTeam(matchId: number, playerId: number, team: "A" | "B") {
  await requireAdmin();
  if (team !== "A" && team !== "B") return { error: "Invalid team." };
  const updated = await db()
    .update(matchPlayers)
    .set({ team })
    .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.playerId, playerId)))
    .returning({ playerId: matchPlayers.playerId });
  if (updated.length === 0) return { error: "That player isn't in this match." };
  revalidatePath("/", "layout");
  return {};
}

// Drag-and-drop: swap two players who are on opposite teams, atomically.
export async function swapTeams(matchId: number, aId: number, bId: number) {
  await requireAdmin();
  const rows = await db()
    .select({ playerId: matchPlayers.playerId, team: matchPlayers.team })
    .from(matchPlayers)
    .where(and(eq(matchPlayers.matchId, matchId), inArray(matchPlayers.playerId, [aId, bId])));
  const a = rows.find((r) => r.playerId === aId);
  const b = rows.find((r) => r.playerId === bId);
  if (!a || !b || aId === bId) return { error: "Both players must be in this match." };
  if (a.team === b.team) return { error: "They need to be on different teams." };
  await db()
    .update(matchPlayers)
    .set({ team: sql`case ${matchPlayers.playerId} when ${aId} then ${b.team} when ${bId} then ${a.team} end` })
    .where(and(eq(matchPlayers.matchId, matchId), inArray(matchPlayers.playerId, [aId, bId])));
  revalidatePath("/", "layout");
  return {};
}

const score = z.number().int().min(0).max(99);

// Pass null for both to clear the score.
export async function saveScore(matchId: number, scoreA: number | null, scoreB: number | null) {
  await requireAdmin();
  if ((scoreA === null) !== (scoreB === null)) return { error: "Enter both scores." };
  if (scoreA !== null && scoreB !== null && !(score.safeParse(scoreA).success && score.safeParse(scoreB).success)) {
    return { error: "Scores are whole numbers from 0 to 99." };
  }
  const updated = await db()
    .update(matches)
    .set({ scoreA, scoreB })
    .where(eq(matches.id, matchId))
    .returning({ id: matches.id });
  if (updated.length === 0) return { error: "Match not found." };
  revalidatePath("/", "layout");
  return {};
}
