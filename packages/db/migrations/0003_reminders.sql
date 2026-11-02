CREATE TABLE "app"."red_alert_state" (
	"family_id" uuid PRIMARY KEY NOT NULL,
	"first_red_year" integer NOT NULL,
	"first_red_month" smallint NOT NULL,
	"shortfall_minor" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."red_alert_state" ADD CONSTRAINT "red_alert_state_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Same guards as 0001 for the new table: RLS on, app-role policy, no anon/authenticated policies.
ALTER TABLE "app"."red_alert_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY nestwise_app_all ON "app"."red_alert_state" FOR ALL TO nestwise_app USING (true) WITH CHECK (true);
