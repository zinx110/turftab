import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { gameItems, gamePlayers, games, payments, players, settings } from "@/db/schema";
import { requireAdmin } from "./auth";
import { allocatePayments, allocateToLines } from "./ledger";
import { perHeadCharge } from "./money";
import { safeEqual } from "./session";

// ---- settings -------------------------------------------------------------

export async function readSetting(key: string) {
  const [row] = await db().select().from(settings).where(eq(settings.key, key));
  return row?.value ?? null;
}

export async function writeSetting(key: string, value: string) {
  await db()
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

// A charge is owed by the player it is billed to: the attendee themselves,
// unless their share was transferred to someone else.
const billedPlayer = sql<number>`coalesce(${gamePlayers.billedToId}, ${gamePlayers.playerId})`;

// ---- games ----------------------------------------------------------------

export type GamePlayer = {
  id: number;
  name: string;
  charge: number; // their share (0 for guests)
  guest: boolean;
  billedToId: number | null;
  billedToName: string | null;
};

export type GameView = {
  id: number;
  playedOn: string;
  note: string | null;
  items: { id: number; label: string; amount: number }[];
  players: GamePlayer[];
  total: number;
  headcount: number; // paying players (guests excluded)
  perHead: number;
  surplus: number;
};

// No auth here: callers decide (admin pages call requireAdmin, share pages
// pass through only the fields they want to expose).
async function loadGames(onlyId?: number): Promise<GameView[]> {
  const gameRows = await db()
    .select()
    .from(games)
    .where(onlyId === undefined ? undefined : eq(games.id, onlyId))
    .orderBy(desc(games.playedOn), desc(games.id));
  if (gameRows.length === 0) return [];

  const billedTo = alias(players, "billed_to");
  const ids = gameRows.map((g) => g.id);
  const [itemRows, playerRows] = await Promise.all([
    db().select().from(gameItems).where(inArray(gameItems.gameId, ids)).orderBy(asc(gameItems.id)),
    db()
      .select({
        gameId: gamePlayers.gameId,
        id: players.id,
        name: players.name,
        charge: gamePlayers.charge,
        guest: gamePlayers.isGuest,
        billedToId: gamePlayers.billedToId,
        billedToName: billedTo.name,
      })
      .from(gamePlayers)
      .innerJoin(players, eq(players.id, gamePlayers.playerId))
      .leftJoin(billedTo, eq(billedTo.id, gamePlayers.billedToId))
      .where(inArray(gamePlayers.gameId, ids))
      .orderBy(asc(players.name)),
  ]);

  return gameRows.map((g) => {
    const items = itemRows.filter((i) => i.gameId === g.id);
    const ps = playerRows.filter((p) => p.gameId === g.id);
    const total = items.reduce((s, i) => s + i.amount, 0);
    const headcount = ps.filter((p) => !p.guest).length;
    const perHead = headcount ? perHeadCharge(total, headcount) : 0;
    return {
      id: g.id,
      playedOn: g.playedOn,
      note: g.note,
      items: items.map(({ id, label, amount }) => ({ id, label, amount })),
      players: ps.map(({ id, name, charge, guest, billedToId, billedToName }) => ({
        id, name, charge, guest, billedToId, billedToName,
      })),
      total,
      headcount,
      perHead,
      surplus: perHead * headcount - total,
    };
  });
}

export async function getGames() {
  await requireAdmin();
  return loadGames();
}

export async function getGame(id: number) {
  await requireAdmin();
  return (await loadGames(id))[0] ?? null;
}

// ---- players & ledger -----------------------------------------------------

async function loadLedger(playerId: number) {
  const attendee = alias(players, "attendee");
  const [chargeRows, paymentRows] = await Promise.all([
    db()
      .select({
        gameId: gamePlayers.gameId,
        playedOn: games.playedOn,
        charge: gamePlayers.charge,
        forId: gamePlayers.playerId,
        forName: attendee.name,
      })
      .from(gamePlayers)
      .innerJoin(games, eq(games.id, gamePlayers.gameId))
      .innerJoin(attendee, eq(attendee.id, gamePlayers.playerId))
      .where(and(sql`${billedPlayer} = ${playerId}`, gt(gamePlayers.charge, 0))),
    db()
      .select()
      .from(payments)
      .where(eq(payments.playerId, playerId))
      .orderBy(desc(payments.paidOn), desc(payments.id)),
  ]);
  const charged = chargeRows.reduce((s, c) => s + c.charge, 0);
  const paid = paymentRows.reduce((s, p) => s + p.amount, 0);
  const { games: allocated, credit } = allocatePayments(
    chargeRows,
    paymentRows.map((p) => ({ amount: p.amount, gameId: p.gameId })),
  );
  // Attach what each game's charge is made of (own share, people covered),
  // and how much of each share is paid, which decides if it can still move.
  const perGame = allocated.map((g) => ({
    ...g,
    lines: allocateToLines(
      chargeRows
        .filter((c) => c.gameId === g.gameId)
        .map((c) => ({ forId: c.forId, forName: c.forName, charge: c.charge, own: c.forId === playerId })),
      g.paid,
    ),
  }));
  return { perGame, credit, payments: paymentRows, charged, paid, balance: charged - paid };
}

export async function getPlayerBalance(playerId: number) {
  await requireAdmin();
  return (await loadLedger(playerId)).balance;
}

// What this player still owes for one game (own share + anyone they cover).
export async function getGameDue(playerId: number, gameId: number) {
  await requireAdmin();
  const g = (await loadLedger(playerId)).perGame.find((x) => x.gameId === gameId);
  return g ? g.due : 0;
}

export async function getPlayersWithBalances() {
  await requireAdmin();
  const [rows, charged, paid] = await Promise.all([
    db().select().from(players).orderBy(asc(players.name)),
    db()
      .select({ playerId: billedPlayer, total: sql<number>`coalesce(sum(${gamePlayers.charge}), 0)::int` })
      .from(gamePlayers)
      .groupBy(billedPlayer),
    db()
      .select({ playerId: payments.playerId, total: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
      .from(payments)
      .groupBy(payments.playerId),
  ]);
  const chargedBy = new Map(charged.map((r) => [Number(r.playerId), r.total]));
  const paidBy = new Map(paid.map((r) => [r.playerId, r.total]));
  return rows.map((p) => {
    const c = chargedBy.get(p.id) ?? 0;
    const pd = paidBy.get(p.id) ?? 0;
    return { ...p, charged: c, paid: pd, balance: c - pd };
  });
}

// Guests per game, so the "move share" picker never offers one as a payer.
async function guestIdsByGame(gameIds: number[]) {
  const map: Record<number, number[]> = {};
  if (gameIds.length === 0) return map;
  const rows = await db()
    .select({ gameId: gamePlayers.gameId, playerId: gamePlayers.playerId })
    .from(gamePlayers)
    .where(and(inArray(gamePlayers.gameId, gameIds), eq(gamePlayers.isGuest, true)));
  for (const r of rows) (map[r.gameId] ??= []).push(r.playerId);
  return map;
}

export async function getPlayerDetail(id: number) {
  await requireAdmin();
  const [player] = await db().select().from(players).where(eq(players.id, id));
  if (!player) return null;
  const ledger = await loadLedger(id);

  // Games this player played where someone else is covering their share.
  const billedTo = alias(players, "billed_to");
  const away = await db()
    .select({
      gameId: gamePlayers.gameId,
      playedOn: games.playedOn,
      charge: gamePlayers.charge,
      billedToId: gamePlayers.billedToId,
      billedToName: billedTo.name,
    })
    .from(gamePlayers)
    .innerJoin(games, eq(games.id, gamePlayers.gameId))
    .innerJoin(billedTo, eq(billedTo.id, gamePlayers.billedToId))
    .where(and(eq(gamePlayers.playerId, id), isNotNull(gamePlayers.billedToId)));

  // A covered share can only move while its payer hasn't paid any of it.
  const payerLedgers = new Map<number, Awaited<ReturnType<typeof loadLedger>>>();
  for (const a of away) {
    if (a.billedToId !== null && !payerLedgers.has(a.billedToId)) {
      payerLedgers.set(a.billedToId, await loadLedger(a.billedToId));
    }
  }
  const coveredAway = away.map((a) => {
    const line = payerLedgers
      .get(a.billedToId!)
      ?.perGame.find((g) => g.gameId === a.gameId)
      ?.lines.find((l) => l.forId === id);
    return { ...a, billedToId: a.billedToId!, movable: line ? line.movable : false };
  });

  const gameIds = [...new Set([...ledger.perGame.map((g) => g.gameId), ...coveredAway.map((a) => a.gameId)])];
  return { player, ...ledger, coveredAway, guestsByGame: await guestIdsByGame(gameIds) };
}

// Everything the "move share" action needs to know about one attendee's share.
export async function getShareState(gameId: number, forId: number) {
  await requireAdmin();
  const [row] = await db()
    .select()
    .from(gamePlayers)
    .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.playerId, forId)));
  if (!row) return null;
  const payerId = row.billedToId ?? row.playerId;
  const line = (await loadLedger(payerId)).perGame
    .find((g) => g.gameId === gameId)
    ?.lines.find((l) => l.forId === forId);
  return {
    guest: row.isGuest,
    billedToId: row.billedToId,
    paid: line?.paid ?? 0,
    guestIds: (await guestIdsByGame([gameId]))[gameId] ?? [],
  };
}

export async function getActivePlayers() {
  await requireAdmin();
  return db()
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name));
}

export async function getPlayersByIds(ids: number[]) {
  await requireAdmin();
  if (ids.length === 0) return [];
  return db().select({ id: players.id }).from(players).where(inArray(players.id, ids));
}

// ---- collecting for one game (admin) --------------------------------------

// Who owes money for this game, and how much of it is settled. A payer can
// owe for people other than themselves (a sponsor), and need not have played.
export async function getGameCollect(gameId: number) {
  await requireAdmin();
  const game = (await loadGames(gameId))[0];
  if (!game) return null;

  const payerIds = [
    ...new Set(game.players.filter((p) => !p.guest).map((p) => p.billedToId ?? p.id)),
  ];
  const nameOf = new Map<number, string>();
  for (const p of game.players) {
    nameOf.set(p.id, p.name);
    if (p.billedToId !== null && p.billedToName) nameOf.set(p.billedToId, p.billedToName);
  }

  const payers = await Promise.all(
    payerIds.map(async (payerId) => {
      const row = (await loadLedger(payerId)).perGame.find((g) => g.gameId === gameId);
      return {
        id: payerId,
        name: nameOf.get(payerId) ?? "Unknown",
        total: row?.charge ?? 0,
        paid: row?.paid ?? 0,
        due: row?.due ?? 0,
        lines: row?.lines ?? [],
      };
    }),
  );
  payers.sort((a, b) => a.name.localeCompare(b.name));

  // People who played but whose share is billed to someone else. The share
  // can still move while the person covering it hasn't paid any of it.
  const covered = game.players
    .filter((p) => !p.guest && p.billedToId !== null)
    .map((p) => {
      const payer = payers.find((x) => x.id === p.billedToId);
      const line = payer?.lines.find((l) => l.forId === p.id);
      return {
        id: p.id,
        name: p.name,
        charge: p.charge,
        billedToId: p.billedToId!,
        billedToName: p.billedToName ?? "Unknown",
        movable: line ? line.movable : false,
      };
    });

  return {
    game,
    payers,
    covered,
    guests: game.players.filter((p) => p.guest).map((p) => ({ id: p.id, name: p.name })),
  };
}

// ---- dashboard ------------------------------------------------------------

export async function getDashboard() {
  await requireAdmin();
  const [everyone, bkash] = await Promise.all([getPlayersWithBalances(), readSetting("bkash_number")]);
  const owing = everyone.filter((p) => p.balance > 0).sort((a, b) => b.balance - a.balance);
  return {
    owing,
    bkash,
    outstanding: owing.reduce((s, p) => s + p.balance, 0),
    collected: everyone.reduce((s, p) => s + p.paid, 0),
    settledCount: everyone.filter((p) => p.active && p.balance <= 0).length,
  };
}

// ---- share links (public: no requireAdmin, token is the credential) --------

export function newToken() {
  return randomBytes(18).toString("base64url");
}

export async function getGroupToken() {
  await requireAdmin();
  const existing = await readSetting("group_token");
  if (existing) return existing;
  const token = newToken();
  await db().insert(settings).values({ key: "group_token", value: token }).onConflictDoNothing();
  return (await readSetting("group_token")) ?? token;
}

// Everyone who played, their share, and a guest tag. It deliberately omits
// balances, payments and who a share was transferred to.
export async function getGroupShare(token: string) {
  const stored = await readSetting("group_token");
  if (!stored || !safeEqual(token, stored)) return null;
  const [all, bkash] = await Promise.all([loadGames(), readSetting("bkash_number")]);
  return {
    bkash,
    games: all.map((g) => ({
      id: g.id,
      playedOn: g.playedOn,
      note: g.note,
      items: g.items.map(({ label, amount }) => ({ label, amount })),
      total: g.total,
      headcount: g.headcount,
      perHead: g.perHead,
      people: g.players.map((p) => ({ name: p.name, guest: p.guest, amount: p.guest ? null : p.charge })),
    })),
  };
}

// One player's own data only, found by their personal token.
export async function getPlayerShare(token: string) {
  const [player] = await db()
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.token, token));
  if (!player) return null;
  const [ledger, bkash] = await Promise.all([loadLedger(player.id), readSetting("bkash_number")]);
  return { name: player.name, bkash, ...ledger };
}
