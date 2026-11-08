ALTER TABLE "app"."items" ADD COLUMN "is_bill" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."items" ADD CONSTRAINT "items_bill_monthly_check" CHECK (not "app"."items"."is_bill" or "app"."items"."kind" = 'monthly');--> statement-breakpoint
-- The family's plan marks nine monthly items as bills (owner, 2026-11-07); families that imported it before this
-- column existed get the same marks.
UPDATE "app"."items" SET "is_bill" = true WHERE "kind" = 'monthly' AND "seed_key" IN ('rent', 'electricity', 'internet', 'gas', 'housekeeping', 'football', 'books_cloud', 'ott', 'spouse');
