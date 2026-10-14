CREATE TABLE "match_players" (
	"match_id" integer NOT NULL,
	"game_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"team" text NOT NULL,
	CONSTRAINT "match_players_match_id_player_id_pk" PRIMARY KEY("match_id","player_id"),
	CONSTRAINT "match_players_team_valid" CHECK ("match_players"."team" in ('A', 'B'))
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"number" integer NOT NULL,
	"score_a" integer,
	"score_b" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_id_game_unique" UNIQUE("id","game_id"),
	CONSTRAINT "matches_scores_valid" CHECK (("matches"."score_a" is null) = ("matches"."score_b" is null) and ("matches"."score_a" is null or ("matches"."score_a" between 0 and 99 and "matches"."score_b" between 0 and 99)))
);
--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_game_id_matches_id_game_id_fk" FOREIGN KEY ("match_id","game_id") REFERENCES "public"."matches"("id","game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_game_id_player_id_game_players_game_id_player_id_fk" FOREIGN KEY ("game_id","player_id") REFERENCES "public"."game_players"("game_id","player_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_players_player_idx" ON "match_players" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "matches_game_idx" ON "matches" USING btree ("game_id");--> statement-breakpoint
-- Carry existing teams/scores over: a game that already has teams or a score becomes "Match 1".
INSERT INTO "matches" ("game_id", "number", "score_a", "score_b")
SELECT g."id", 1, g."score_a", g."score_b" FROM "games" g
WHERE g."score_a" IS NOT NULL
   OR EXISTS (SELECT 1 FROM "game_players" gp WHERE gp."game_id" = g."id" AND gp."team" IS NOT NULL);--> statement-breakpoint
INSERT INTO "match_players" ("match_id", "game_id", "player_id", "team")
SELECT m."id", gp."game_id", gp."player_id", gp."team"
FROM "game_players" gp
JOIN "matches" m ON m."game_id" = gp."game_id" AND m."number" = 1
WHERE gp."team" IS NOT NULL;
