import { randomBytes } from "node:crypto";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { gameItems, gamePlayers, games, payments, players, settings } from "@/db/schema";
import { requireAdmin } from "./auth";
import { allocatePayments } from "./ledger";
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

// ---- games ----------------------------------------------------------------

export type GameView = {
  id: number;
  playedOn: string;
  note: string | null;
  items: { id: number; label: string; amount: number }[];
  players: { id: number; name: string; charge: number }[];
  total: number;
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

  const ids = gameRows.map((g) => g.id);
  const [itemRows, playerRows] = await Promise.all([
    db().select().from(gameItems).where(inArray(gameItems.gameId, ids)).orderBy(asc(gameItems.id)),
    db()
      .select({
        gameId: gamePlayers.gameId,
        id: players.id,
        name: players.name,
        charge: gamePlayers.charge,
      })
      .from(gamePlayers)
      .innerJoin(players, eq(players.id, gamePlayers.playerId))
      .where(inArray(gamePlayers.gameId, ids))
      .orderBy(asc(players.name)),
  ]);

  return gameRows.map((g) => {
    const items = itemRows.filter((i) => i.gameId === g.id);
    const ps = playerRows.filter((p) => p.gameId === g.id);
    const total = items.reduce((s, i) => s + i.amount, 0);
    const perHead = ps.length ? perHeadCharge(total, ps.length) : 0;
    return {
      id: g.id,
      playedOn: g.playedOn,
      note: g.note,
      items: items.map(({ id, label, amount }) => ({ id, label, amount })),
      players: ps.map(({ id, name, charge }) => ({ id, name, charge })),
      total,
      perHead,
      surplus: perHead * ps.length - total,
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
  const [chargeRows, paymentRows] = await Promise.all([
    db()
      .select({ gameId: gamePlayers.gameId, playedOn: games.playedOn, charge: gamePlayers.charge })
      .from(gamePlayers)
      .innerJoin(games, eq(games.id, gamePlayers.gameId))
      .where(eq(gamePlayers.playerId, playerId)),
    db()
      .select()
      .from(payments)
      .where(eq(payments.playerId, playerId))
      .orderBy(desc(payments.paidOn), desc(payments.id)),
  ]);
  const charged = chargeRows.reduce((s, c) => s + c.charge, 0);
  const paid = paymentRows.reduce((s, p) => s + p.amount, 0);
  const { games: perGame, credit } = allocatePayments(chargeRows, paid);
  return { perGame, credit, payments: paymentRows, charged, paid, balance: charged - paid };
}

export async function getPlayerBalance(playerId: number) {
  await requireAdmin();
  return (await loadLedger(playerId)).balance;
}

export async function getPlayersWithBalances() {
  await requireAdmin();
  const total = (col: typeof gamePlayers.charge | typeof payments.amount) =>
    sql<number>`coalesce(sum(${col}), 0)::int`;
  const [rows, charged, paid] = await Promise.all([
    db().select().from(players).orderBy(asc(players.name)),
    db()
      .select({ playerId: gamePlayers.playerId, total: total(gamePlayers.charge) })
      .from(gamePlayers)
      .groupBy(gamePlayers.playerId),
    db()
      .select({ playerId: payments.playerId, total: total(payments.amount) })
      .from(payments)
      .groupBy(payments.playerId),
  ]);
  const chargedBy = new Map(charged.map((r) => [r.playerId, r.total]));
  const paidBy = new Map(paid.map((r) => [r.playerId, r.total]));
  return rows.map((p) => {
    const c = chargedBy.get(p.id) ?? 0;
    const pd = paidBy.get(p.id) ?? 0;
    return { ...p, charged: c, paid: pd, balance: c - pd };
  });
}

export async function getPlayerDetail(id: number) {
  await requireAdmin();
  const [player] = await db().select().from(players).where(eq(players.id, id));
  if (!player) return null;
  return { player, ...(await loadLedger(id)) };
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

export async function getGroupToken() {
  await requireAdmin();
  const existing = await readSetting("group_token");
  if (existing) return existing;
  const token = newToken();
  await db().insert(settings).values({ key: "group_token", value: token }).onConflictDoNothing();
  return (await readSetting("group_token")) ?? token;
}

export function newToken() {
  return randomBytes(18).toString("base64url");
}

// Games with player names and costs only: never balances or who has paid.
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
      perHead: g.perHead,
      playerNames: g.players.map((p) => p.name),
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
