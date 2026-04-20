CREATE TYPE "public"."email_integration_provider" AS ENUM('gmail', 'outlook', 'yahoo', 'imap', 'sendgrid', 'postmark');--> statement-breakpoint
CREATE TYPE "public"."email_integration_status" AS ENUM('active', 'error', 'pending');--> statement-breakpoint
CREATE TABLE "team_email_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"provider" "email_integration_provider" NOT NULL,
	"label" text NOT NULL,
	"email" text,
	"imap_host" text,
	"imap_port" integer,
	"credentials" jsonb,
	"status" "email_integration_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_email_integrations" ADD CONSTRAINT "team_email_integrations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
