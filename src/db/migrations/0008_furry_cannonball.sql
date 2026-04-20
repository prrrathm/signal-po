ALTER TYPE "public"."job_status" ADD VALUE 'dead_lettered';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "max_retries" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "retry_after" timestamp with time zone;