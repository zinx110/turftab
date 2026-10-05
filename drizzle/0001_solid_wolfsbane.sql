ALTER TABLE "game_players" ADD COLUMN "is_guest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "game_players" ADD COLUMN "billed_to_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "game_id" integer;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_billed_to_id_players_id_fk" FOREIGN KEY ("billed_to_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_players_billed_to_idx" ON "game_players" USING btree ("billed_to_id");--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_guest_is_free" CHECK (not "game_players"."is_guest" or ("game_players"."charge" = 0 and "game_players"."billed_to_id" is null));--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_no_self_transfer" CHECK ("game_players"."billed_to_id" is null or "game_players"."billed_to_id" <> "game_players"."player_id");