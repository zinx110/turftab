import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Money is stored as whole taka (integers). No decimals anywhere.

const newToken = () => randomBytes(18).toString("base64url");

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  // Personal share link: /p/<token>
  token: text("token").notNull().unique().$defaultFn(newToken),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  playedOn: date("played_on").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const gameItems = pgTable(
  "game_items",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amount: integer("amount").notNull(),
  },
  (t) => [
    index("game_items_game_idx").on(t.gameId),
    check("game_items_amount_positive", sql`${t.amount} > 0`),
  ],
);

// One row per player who actually played. `charge` is that player's share,
// fixed at save time. Guests play free (charge 0, excluded from the split).
// `billedToId` transfers the share to another player; null = they pay it.
export const gamePlayers = pgTable(
  "game_players",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    // restrict: players with history are archived, never deleted
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    charge: integer("charge").notNull(),
    isGuest: boolean("is_guest").notNull().default(false),
    billedToId: integer("billed_to_id").references(() => players.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.playerId] }),
    index("game_players_player_idx").on(t.playerId),
    index("game_players_billed_to_idx").on(t.billedToId),
    check("game_players_charge_nonneg", sql`${t.charge} >= 0`),
    check("game_players_guest_is_free", sql`not ${t.isGuest} or (${t.charge} = 0 and ${t.billedToId} is null)`),
    check("game_players_no_self_transfer", sql`${t.billedToId} is null or ${t.billedToId} <> ${t.playerId}`),
  ],
);

// A payment reduces the player's running balance. `gameId` is optional: set
// when "Mark paid" is used on a specific game, so that game is settled first.
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    gameId: integer("game_id").references(() => games.id, { onDelete: "set null" }),
    paidOn: date("paid_on").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("payments_player_idx").on(t.playerId),
    check("payments_amount_positive", sql`${t.amount} > 0`),
  ],
);

// Key/value: bkash_number, group_token
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: serial("id").primaryKey(),
    ip: text("ip").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("login_attempts_at_idx").on(t.attemptedAt)],
);
