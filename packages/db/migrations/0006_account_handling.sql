CREATE TABLE "app"."auth_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app"."users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "google_subject" text;--> statement-breakpoint
ALTER TABLE "app"."auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_tokens_user_purpose_idx" ON "app"."auth_tokens" USING btree ("user_id","purpose");--> statement-breakpoint
ALTER TABLE "app"."users" ADD CONSTRAINT "users_googleSubject_unique" UNIQUE("google_subject");--> statement-breakpoint
-- Accounts made before email verification existed are the family's own: count them as verified (owner, 2026-11-06).
UPDATE "app"."users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;--> statement-breakpoint
ALTER TABLE "app"."auth_tokens" ADD CONSTRAINT "auth_tokens_purpose_check" CHECK ("purpose" IN ('verify_email', 'reset_password'));--> statement-breakpoint
-- Same guards as 0001 for the new table: RLS on, app-role policy, no anon/authenticated policies.
ALTER TABLE "app"."auth_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY nestwise_app_all ON "app"."auth_tokens" FOR ALL TO nestwise_app USING (true) WITH CHECK (true);