-- Hand-written guards (TRD §3, §6). Every later migration that adds an app table must also enable RLS on it
-- and add the nestwise_app policy, or the "every app table has RLS enabled" test fails.

-- 1. The role the app connects through. NOLOGIN: a login user is granted this role per environment (RUNBOOK).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nestwise_app') THEN
    CREATE ROLE nestwise_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO nestwise_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO nestwise_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO nestwise_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nestwise_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO nestwise_app;
--> statement-breakpoint

-- 2. Row-level security on every table, with no policy for anon or authenticated (the Data API sees nothing).
--    The app role gets one allow-all policy; family isolation is enforced by the Actor-scoped gateways.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('CREATE POLICY nestwise_app_all ON app.%I FOR ALL TO nestwise_app USING (true) WITH CHECK (true)', t.tablename);
  END LOOP;
END
$$;
--> statement-breakpoint

-- 3. Activity is append-only for the app.
REVOKE UPDATE, DELETE ON app.activity FROM nestwise_app;
--> statement-breakpoint

-- 4. A family's currency and minor unit are locked once created.
CREATE FUNCTION app.reject_currency_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.currency_code IS DISTINCT FROM OLD.currency_code OR NEW.minor_unit IS DISTINCT FROM OLD.minor_unit THEN
    RAISE EXCEPTION 'A family''s currency cannot be changed' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER families_currency_locked
  BEFORE UPDATE OF currency_code, minor_unit ON app.families
  FOR EACH ROW EXECUTE FUNCTION app.reject_currency_change();
--> statement-breakpoint

-- 5. Allocations must add up to their transaction's amount, checked at commit so a split can be written row by row.
CREATE FUNCTION app.check_allocation_sum(txn_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  expected bigint;
  actual bigint;
BEGIN
  SELECT amount_minor INTO expected FROM app.transactions WHERE id = txn_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT COALESCE(SUM(amount_minor), 0) INTO actual FROM app.allocations WHERE transaction_id = txn_id;
  IF actual <> expected THEN
    RAISE EXCEPTION 'Allocations (%) do not add up to the transaction amount (%)', actual, expected
      USING ERRCODE = 'check_violation';
  END IF;
END
$$;
--> statement-breakpoint
CREATE FUNCTION app.allocations_sum_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM app.check_allocation_sum(OLD.transaction_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM app.check_allocation_sum(NEW.transaction_id);
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE FUNCTION app.transactions_sum_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM app.check_allocation_sum(NEW.id);
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER allocations_add_up
  AFTER INSERT OR UPDATE OR DELETE ON app.allocations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app.allocations_sum_trigger();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER transactions_allocations_add_up
  AFTER INSERT OR UPDATE OF amount_minor ON app.transactions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app.transactions_sum_trigger();
