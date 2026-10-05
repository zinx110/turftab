import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { gamePlayers, games, payments, players } from "@/db/schema";
import { requireAdmin } from "./auth";
import { toCsv } from "./csv";
import { getGames, getPlayersWithBalances } from "./data";

export const EXPORTS = ["players", "games", "charges", "payments", "balances"] as const;
export type ExportName = (typeof EXPORTS)[number];

export function isExportName(s: string): s is ExportName {
  return (EXPORTS as readonly string[]).includes(s);
}

export async function buildExport(name: ExportName) {
  await requireAdmin();

  switch (name) {
    case "players": {
      const rows = await getPlayersWithBalances();
      return toCsv(
        ["id", "name", "phone", "active", "created_at"],
        rows.map((p) => [p.id, p.name, p.phone, p.active, p.createdAt.toISOString()]),
      );
    }
    case "games": {
      const rows = await getGames();
      return toCsv(
        ["id", "date", "note", "items", "total", "players", "per_head", "surplus"],
        rows.map((g) => [
          g.id,
          g.playedOn,
          g.note,
          g.items.map((i) => `${i.label} ${i.amount}`).join("; "),
          g.total,
          g.players.length,
          g.perHead,
          g.surplus,
        ]),
      );
    }
    case "charges": {
      const billedTo = alias(players, "billed_to");
      const rows = await db()
        .select({
          gameId: gamePlayers.gameId,
          playedOn: games.playedOn,
          playerId: players.id,
          player: players.name,
          guest: gamePlayers.isGuest,
          charge: gamePlayers.charge,
          billedToId: gamePlayers.billedToId,
          billedTo: billedTo.name,
        })
        .from(gamePlayers)
        .innerJoin(games, eq(games.id, gamePlayers.gameId))
        .innerJoin(players, eq(players.id, gamePlayers.playerId))
        .leftJoin(billedTo, eq(billedTo.id, gamePlayers.billedToId))
        .orderBy(asc(games.playedOn), asc(gamePlayers.gameId), asc(players.name));
      return toCsv(
        ["game_id", "date", "player_id", "player", "guest", "charge", "billed_to_id", "billed_to"],
        rows.map((r) => [r.gameId, r.playedOn, r.playerId, r.player, r.guest, r.charge, r.billedToId, r.billedTo]),
      );
    }
    case "payments": {
      const rows = await db()
        .select({
          id: payments.id,
          playerId: players.id,
          player: players.name,
          amount: payments.amount,
          gameId: payments.gameId,
          paidOn: payments.paidOn,
          note: payments.note,
        })
        .from(payments)
        .innerJoin(players, eq(players.id, payments.playerId))
        .orderBy(asc(payments.paidOn), asc(payments.id));
      return toCsv(
        ["id", "player_id", "player", "amount", "game_id", "paid_on", "note"],
        rows.map((r) => [r.id, r.playerId, r.player, r.amount, r.gameId, r.paidOn, r.note]),
      );
    }
    case "balances": {
      const rows = await getPlayersWithBalances();
      return toCsv(
        ["player_id", "player", "active", "charged", "paid", "balance"],
        rows.map((p) => [p.id, p.name, p.active, p.charged, p.paid, p.balance]),
      );
    }
  }
}
