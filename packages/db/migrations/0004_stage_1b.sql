ALTER TABLE "app"."year_plans" ADD COLUMN "next_year_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."activity" ADD COLUMN "late_edit" boolean DEFAULT false NOT NULL;