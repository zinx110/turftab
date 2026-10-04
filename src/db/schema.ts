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

// One row per player who actually played. `charge` is fixed at save time.
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
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.playerId] }),
    index("game_players_player_idx").on(t.playerId),
    check("game_players_charge_nonneg", sql`${t.charge} >= 0`),
  ],
);

// Not tied to a game: a payment just reduces the player's running balance.
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
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
