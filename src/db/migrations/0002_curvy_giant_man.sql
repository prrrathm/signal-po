-- Step 1: Create enum and new tables
CREATE TYPE "public"."team_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Step 2: Drop old global PO number unique constraint (replaced by per-team composite unique)
ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_po_number_unique";--> statement-breakpoint

-- Step 3: Add team_id columns as nullable first (to allow backfill)
ALTER TABLE "audit_logs" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "team_id" uuid;--> statement-breakpoint

-- Step 4: Create personal teams for every existing user
-- Slug is sanitized email prefix + 6-char md5 suffix to ensure uniqueness
INSERT INTO "teams" ("id", "name", "slug", "created_at")
SELECT
  gen_random_uuid(),
  COALESCE(NULLIF(TRIM(name), ''), split_part(email, '@', 1)),
  LOWER(REGEXP_REPLACE(split_part(email, '@', 1), '[^a-z0-9]', '-', 'gi'))
    || '-' || SUBSTR(MD5(id::text), 1, 6),
  created_at
FROM "users";--> statement-breakpoint

-- Step 5: Create owner memberships linking each user to their personal team
-- We match by the slug pattern we just generated
INSERT INTO "team_members" ("id", "team_id", "user_id", "role", "created_at")
SELECT
  gen_random_uuid(),
  t.id,
  u.id,
  'owner',
  NOW()
FROM "users" u
JOIN "teams" t ON t.slug = LOWER(REGEXP_REPLACE(split_part(u.email, '@', 1), '[^a-z0-9]', '-', 'gi'))
    || '-' || SUBSTR(MD5(u.id::text), 1, 6);--> statement-breakpoint

-- Step 6: Create a system team for any pre-existing data (deterministic UUID for idempotency)
INSERT INTO "teams" ("id", "name", "slug", "created_at")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'System (Migration Data)',
  'system-migration',
  NOW()
) ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Step 7: Assign all existing purchase_orders and emails to the system team
UPDATE "purchase_orders" SET "team_id" = '00000000-0000-0000-0000-000000000001' WHERE "team_id" IS NULL;--> statement-breakpoint
UPDATE "emails" SET "team_id" = '00000000-0000-0000-0000-000000000001' WHERE "team_id" IS NULL;--> statement-breakpoint

-- Step 8: Add NOT NULL constraints now that all rows are backfilled
ALTER TABLE "emails" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint

-- Step 9: Add foreign key constraints
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

-- Step 10: Add unique indexes
CREATE UNIQUE INDEX "team_members_team_user_idx" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_team_po_number_idx" ON "purchase_orders" USING btree ("team_id","po_number");
