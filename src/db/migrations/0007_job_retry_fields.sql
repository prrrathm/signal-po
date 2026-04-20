ALTER TYPE "public"."job_status" ADD VALUE 'dead_lettered';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "retry_count" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "max_retries" integer NOT NULL DEFAULT 3;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "retry_after" timestamp with time zone;
