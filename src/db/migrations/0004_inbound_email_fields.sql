ALTER TABLE "emails" ADD COLUMN "message_id" text;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "from_email" text;--> statement-breakpoint
CREATE UNIQUE INDEX "emails_team_message_id_idx" ON "emails" USING btree ("team_id","message_id");
