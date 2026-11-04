CREATE TABLE "app"."capture_batches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"transcript" text NOT NULL,
	"stt_model" text NOT NULL,
	"parse_model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."capture_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"amount_minor" bigint,
	"item_id" uuid,
	"year_line_id" uuid,
	"kind" text NOT NULL,
	"txn_date" date NOT NULL,
	"merchant" text,
	"note" text NOT NULL,
	"heard" text NOT NULL,
	"confidence_amount" real NOT NULL,
	"confidence_item" real NOT NULL,
	"dropped" boolean DEFAULT false NOT NULL,
	"sort" integer NOT NULL,
	CONSTRAINT "capture_entries_kind_check" CHECK ("app"."capture_entries"."kind" in ('expense', 'yearly_bill')),
	CONSTRAINT "capture_entries_amount_check" CHECK ("app"."capture_entries"."amount_minor" is null or "app"."capture_entries"."amount_minor" > 0),
	CONSTRAINT "capture_entries_confidence_check" CHECK ("app"."capture_entries"."confidence_amount" between 0 and 1 and "app"."capture_entries"."confidence_item" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "app"."capture_batches" ADD CONSTRAINT "capture_batches_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."capture_entries" ADD CONSTRAINT "capture_entries_batch_id_capture_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "app"."capture_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."capture_entries" ADD CONSTRAINT "capture_entries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."capture_entries" ADD CONSTRAINT "capture_entries_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "app"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."capture_entries" ADD CONSTRAINT "capture_entries_year_line_id_year_lines_id_fk" FOREIGN KEY ("year_line_id") REFERENCES "app"."year_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capture_batches_waiting_idx" ON "app"."capture_batches" USING btree ("family_id","resolved_at","created_at");--> statement-breakpoint
CREATE INDEX "capture_entries_batch_idx" ON "app"."capture_entries" USING btree ("batch_id","sort");--> statement-breakpoint
-- Guards for the two new tables (0001_guards.sql §2 applies to every app table; the guards test enforces it).
ALTER TABLE "app"."capture_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY nestwise_app_all ON "app"."capture_batches" FOR ALL TO nestwise_app USING (true) WITH CHECK (true);--> statement-breakpoint
ALTER TABLE "app"."capture_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY nestwise_app_all ON "app"."capture_entries" FOR ALL TO nestwise_app USING (true) WITH CHECK (true);
