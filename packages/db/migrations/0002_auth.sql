CREATE TABLE "app"."sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "app"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "app"."sessions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "app"."members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Same guards as 0001 for the new tables: RLS on, app-role policy, no anon/authenticated policies.
ALTER TABLE "app"."users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY nestwise_app_all ON "app"."users" FOR ALL TO nestwise_app USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY nestwise_app_all ON "app"."sessions" FOR ALL TO nestwise_app USING (true) WITH CHECK (true);
