import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

type Env = Record<string, string | undefined>;

/**
 * Builds the Postgres connection URL from DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD.
 * The user and password are URL-encoded, so special characters in the password are safe.
 * A full DATABASE_URL, if set, wins.
 */
export function databaseUrl(env: Env = process.env): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const missing = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"].filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Database settings missing: ${missing.join(", ")}`);
  const user = encodeURIComponent(env.DB_USER!);
  const password = encodeURIComponent(env.DB_PASSWORD!);
  return `postgres://${user}:${password}@${env.DB_HOST}:${env.DB_PORT}/${encodeURIComponent(env.DB_NAME!)}`;
}

const isLocal = (url: string) => /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

/** Tagged-template query: values become $1, $2 … parameters (never string-joined). Resolves to the rows. */
export type Sql = <R extends readonly unknown[] = Record<string, unknown>[]>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<R>;

let pool: Pool | undefined;

// Lesson from the iPhone test: a long-lived connection goes dead while Vercel pauses the function, and with one
// connection and no time limits every later request hung for 300 s. So: Vercel's attachDatabasePool (closes idle
// connections before a pause), short idle timeout, and hard time limits on connecting and on every query.
function getPool(): Pool {
  if (pool) return pool;
  const url = new URL(databaseUrl());
  url.searchParams.delete("sslmode");
  pool = new Pool({
    connectionString: url.toString(),
    ssl: isLocal(url.toString()) ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 8_000,
    query_timeout: 10_000,
    statement_timeout: 10_000,
  });
  attachDatabasePool(pool);
  return pool;
}

export async function getSql(): Promise<Sql> {
  const db = getPool();
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.reduce((acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""), "");
    const result = await db.query(text, values);
    return result.rows;
  }) as Sql;
}

// The spike's tables (spike_users, spike_sessions, spike_entries, spike_push_subscriptions) are created once by
// setup.sql, not on every start-up: the old per-start `ALTER TABLE … ENABLE ROW LEVEL SECURITY` took table locks.
