CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."month_budgets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" smallint NOT NULL,
	"status" text NOT NULL,
	"created_from" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	CONSTRAINT "month_budgets_family_period_key" UNIQUE("family_id","year","month"),
	CONSTRAINT "month_budgets_month_check" CHECK ("app"."month_budgets"."month" between 1 and 12),
	CONSTRAINT "month_budgets_status_check" CHECK ("app"."month_budgets"."status" in ('draft', 'active', 'closed')),
	CONSTRAINT "month_budgets_created_from_check" CHECK ("app"."month_budgets"."created_from" in ('template', 'copy', 'blank'))
);
--> statement-breakpoint
CREATE TABLE "app"."month_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"month_budget_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"group_name_snapshot" text NOT NULL,
	"planned_minor" bigint NOT NULL,
	CONSTRAINT "month_lines_budget_item_key" UNIQUE("month_budget_id","item_id"),
	CONSTRAINT "month_lines_planned_check" CHECK ("app"."month_lines"."planned_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."year_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"year_plan_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"name_snapshot" text NOT NULL,
	"planned_minor" bigint NOT NULL,
	"due_year" integer NOT NULL,
	"due_month" smallint,
	"due_day" smallint,
	"state" text NOT NULL,
	CONSTRAINT "year_lines_plan_item_key" UNIQUE("year_plan_id","item_id"),
	CONSTRAINT "year_lines_planned_check" CHECK ("app"."year_lines"."planned_minor" >= 0),
	CONSTRAINT "year_lines_due_month_check" CHECK ("app"."year_lines"."due_month" is null or "app"."year_lines"."due_month" between 1 and 12),
	CONSTRAINT "year_lines_due_day_check" CHECK ("app"."year_lines"."due_day" is null or "app"."year_lines"."due_day" between 1 and 31),
	CONSTRAINT "year_lines_state_check" CHECK ("app"."year_lines"."state" in ('open', 'done', 'cancelled', 'before_nestwise'))
);
--> statement-breakpoint
CREATE TABLE "app"."year_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_year_check_at" timestamp with time zone,
	CONSTRAINT "year_plans_family_year_key" UNIQUE("family_id","year")
);
--> statement-breakpoint
CREATE TABLE "app"."families" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"currency_code" char(3) NOT NULL,
	"minor_unit" smallint NOT NULL,
	"number_locale" text NOT NULL,
	"timezone" text NOT NULL,
	"country_code" char(2),
	"set_aside_override_minor" bigint,
	"alert_thresholds" smallint[] DEFAULT '{80,100}'::smallint[] NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "families_minor_unit_check" CHECK ("app"."families"."minor_unit" between 0 and 3),
	CONSTRAINT "families_set_aside_override_check" CHECK ("app"."families"."set_aside_override_minor" is null or "app"."families"."set_aside_override_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_by" uuid,
	"used_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "invites_tokenHash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invites_role_check" CHECK ("app"."invites"."role" in ('admin', 'member', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "app"."members" (
	"family_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "members_family_id_user_id_pk" PRIMARY KEY("family_id","user_id"),
	CONSTRAINT "members_role_check" CHECK ("app"."members"."role" in ('admin', 'member', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "app"."profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."duplicate_matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"txn_a" uuid NOT NULL,
	"txn_b" uuid NOT NULL,
	"reasons" jsonb NOT NULL,
	"status" text NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duplicate_matches_status_check" CHECK ("app"."duplicate_matches"."status" in ('pending', 'same', 'different')),
	CONSTRAINT "duplicate_matches_distinct_check" CHECK ("app"."duplicate_matches"."txn_a" <> "app"."duplicate_matches"."txn_b")
);
--> statement-breakpoint
CREATE TABLE "app"."evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"transaction_id" uuid,
	"kind" text NOT NULL,
	"storage_path" text,
	"transcript" text,
	"extracted" jsonb,
	"confidence" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "evidence_kind_check" CHECK ("app"."evidence"."kind" in ('voice', 'receipt', 'merged_entry'))
);
--> statement-breakpoint
CREATE TABLE "app"."allocations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"plan_year" integer,
	"amount_minor" bigint NOT NULL,
	CONSTRAINT "allocations_amount_check" CHECK ("app"."allocations"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."checklist_skips" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" smallint NOT NULL,
	"item_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checklist_skips_family_period_item_key" UNIQUE NULLS NOT DISTINCT("family_id","year","month","item_id"),
	CONSTRAINT "checklist_skips_month_check" CHECK ("app"."checklist_skips"."month" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "app"."pot_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"entry_date" date NOT NULL,
	"period_year" integer NOT NULL,
	"period_month" smallint NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "pot_entries_kind_check" CHECK ("app"."pot_entries"."kind" in ('opening', 'deposit', 'extra_in', 'taken_out')),
	CONSTRAINT "pot_entries_amount_check" CHECK ("app"."pot_entries"."amount_minor" > 0 or ("app"."pot_entries"."kind" = 'opening' and "app"."pot_entries"."amount_minor" >= 0)),
	CONSTRAINT "pot_entries_month_check" CHECK ("app"."pot_entries"."period_month" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "app"."savings_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" smallint NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "savings_entries_family_item_period_key" UNIQUE("family_id","item_id","year","month"),
	CONSTRAINT "savings_entries_amount_check" CHECK ("app"."savings_entries"."amount_minor" >= 0),
	CONSTRAINT "savings_entries_month_check" CHECK ("app"."savings_entries"."month" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "app"."transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency_code" char(3) NOT NULL,
	"txn_date" date NOT NULL,
	"period_year" integer GENERATED ALWAYS AS ((extract(year from txn_date))::integer) STORED,
	"period_month" integer GENERATED ALWAYS AS ((extract(month from txn_date))::integer) STORED,
	"merchant" text,
	"note" text,
	"entered_by" uuid NOT NULL,
	"paid_by" uuid,
	"capture_method" text NOT NULL,
	"status" text NOT NULL,
	"merged_into" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entry_tz" text NOT NULL,
	CONSTRAINT "transactions_amount_check" CHECK ("app"."transactions"."amount_minor" > 0),
	CONSTRAINT "transactions_kind_check" CHECK ("app"."transactions"."kind" in ('expense', 'refund')),
	CONSTRAINT "transactions_capture_check" CHECK ("app"."transactions"."capture_method" in ('typed', 'voice', 'receipt')),
	CONSTRAINT "transactions_status_check" CHECK ("app"."transactions"."status" in ('pending', 'confirmed'))
);
--> statement-breakpoint
CREATE TABLE "app"."notifications_sent" (
	"user_id" uuid NOT NULL,
	"dedupe_key" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_sent_user_id_dedupe_key_pk" PRIMARY KEY("user_id","dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "app"."push_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_ok_at" timestamp with time zone,
	"failed_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "app"."usage" (
	"family_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" smallint NOT NULL,
	"voice_count" integer DEFAULT 0 NOT NULL,
	"voice_seconds" integer DEFAULT 0 NOT NULL,
	"receipt_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_family_id_year_month_pk" PRIMARY KEY("family_id","year","month")
);
--> statement-breakpoint
CREATE TABLE "app"."groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"sort" integer NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "groups_kind_check" CHECK ("app"."groups"."kind" in ('monthly', 'yearly', 'savings'))
);
--> statement-breakpoint
CREATE TABLE "app"."items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"sort" integer NOT NULL,
	"archived_at" timestamp with time zone,
	"seed_key" text,
	CONSTRAINT "items_kind_check" CHECK ("app"."items"."kind" in ('monthly', 'yearly', 'savings'))
);
--> statement-breakpoint
CREATE TABLE "app"."template_lines" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"family_id" uuid NOT NULL,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"due_month" smallint,
	"due_day" smallint,
	"hint_min_minor" bigint,
	"hint_max_minor" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "template_lines_amount_check" CHECK ("app"."template_lines"."amount_minor" >= 0),
	CONSTRAINT "template_lines_due_month_check" CHECK ("app"."template_lines"."due_month" is null or "app"."template_lines"."due_month" between 1 and 12),
	CONSTRAINT "template_lines_due_day_check" CHECK ("app"."template_lines"."due_day" is null or "app"."template_lines"."due_day" between 1 and 31)
);
--> statement-breakpoint
ALTER TABLE "app"."month_budgets" ADD CONSTRAINT "month_budgets_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."month_lines" ADD CONSTRAINT "month_lines_month_budget_id_month_budgets_id_fk" FOREIGN KEY ("month_budget_id") REFERENCES "app"."month_budgets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."month_lines" ADD CONSTRAINT "month_lines_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."month_lines" ADD CONSTRAINT "month_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "app"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."year_lines" ADD CONSTRAINT "year_lines_year_plan_id_year_plans_id_fk" FOREIGN KEY ("year_plan_id") REFERENCES "app"."year_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."year_lines" ADD CONSTRAINT "year_lines_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."year_lines" ADD CONSTRAINT "year_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "app"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."year_plans" ADD CONSTRAINT "year_plans_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invites" ADD CONSTRAINT "invites_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."members" ADD CONSTRAINT "members_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."activity" ADD CONSTRAINT "activity_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."duplicate_matches" ADD CONSTRAINT "duplicate_matches_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."duplicate_matches" ADD CONSTRAINT "duplicate_matches_txn_a_transactions_id_fk" FOREIGN KEY ("txn_a") REFERENCES "app"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."duplicate_matches" ADD CONSTRAINT "duplicate_matches_txn_b_transactions_id_fk" FOREIGN KEY ("txn_b") REFERENCES "app"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."evidence" ADD CONSTRAINT "evidence_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."evidence" ADD CONSTRAINT "evidence_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "app"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."allocations" ADD CONSTRAINT "allocations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "app"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."allocations" ADD CONSTRAINT "allocations_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."allocations" ADD CONSTRAINT "allocations_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "app"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."checklist_skips" ADD CONSTRAINT "checklist_skips_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."checklist_skips" ADD CONSTRAINT "checklist_skips_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "app"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."pot_entries" ADD CONSTRAINT "pot_entries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."savings_entries" ADD CONSTRAINT "savings_entries_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."savings_entries" ADD CONSTRAINT "savings_entries_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "app"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."transactions" ADD CONSTRAINT "transactions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."usage" ADD CONSTRAINT "usage_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."groups" ADD CONSTRAINT "groups_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."items" ADD CONSTRAINT "items_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."items" ADD CONSTRAINT "items_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."template_lines" ADD CONSTRAINT "template_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "app"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."template_lines" ADD CONSTRAINT "template_lines_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "month_lines_family_idx" ON "app"."month_lines" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "year_lines_family_idx" ON "app"."year_lines" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "invites_family_idx" ON "app"."invites" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "members_user_idx" ON "app"."members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_family_at_idx" ON "app"."activity" USING btree ("family_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "duplicate_matches_pair_idx" ON "app"."duplicate_matches" USING btree (least("txn_a", "txn_b"),greatest("txn_a", "txn_b"));--> statement-breakpoint
CREATE INDEX "evidence_transaction_idx" ON "app"."evidence" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "allocations_transaction_idx" ON "app"."allocations" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "allocations_family_item_idx" ON "app"."allocations" USING btree ("family_id","item_id");--> statement-breakpoint
CREATE INDEX "pot_entries_family_idx" ON "app"."pot_entries" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pot_entries_one_live_deposit_idx" ON "app"."pot_entries" USING btree ("family_id","period_year","period_month") WHERE "app"."pot_entries"."kind" = 'deposit' and "app"."pot_entries"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "transactions_family_period_idx" ON "app"."transactions" USING btree ("family_id","period_year","period_month");--> statement-breakpoint
CREATE INDEX "groups_family_idx" ON "app"."groups" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "items_family_idx" ON "app"."items" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_family_seed_key_idx" ON "app"."items" USING btree ("family_id","seed_key") WHERE "app"."items"."seed_key" is not null;--> statement-breakpoint
CREATE INDEX "template_lines_family_idx" ON "app"."template_lines" USING btree ("family_id");