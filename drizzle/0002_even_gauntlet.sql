ALTER TABLE "game_players" ADD COLUMN "team" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "score_a" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "score_b" integer;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_team_valid" CHECK ("game_players"."team" is null or "game_players"."team" in ('A', 'B'));--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_scores_valid" CHECK (("games"."score_a" is null) = ("games"."score_b" is null) and ("games"."score_a" is null or ("games"."score_a" between 0 and 99 and "games"."score_b" between 0 and 99)));