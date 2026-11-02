import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const isLocalHost = (url: string) => /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

export interface CreateDbOptions {
  max?: number;
  /** Hard limit for any single query, client side and server side. */
  queryTimeoutMs?: number;
}

/**
 * A node-postgres pool with time limits on connecting and on every query, so a dead connection fails fast instead
 * of hanging (Stage 0 finding). On Vercel, apps/web also passes the pool to `attachDatabasePool`.
 */
export function createDb(url: string, options: CreateDbOptions = {}) {
  const connection = new URL(url);
  connection.searchParams.delete('sslmode'); // TLS is set explicitly below
  const queryTimeout = options.queryTimeoutMs ?? 10_000;
  const pool = new Pool({
    connectionString: connection.toString(),
    ssl: isLocalHost(url) ? false : { rejectUnauthorized: false },
    max: options.max ?? 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 8_000,
    query_timeout: queryTimeout,
    statement_timeout: queryTimeout,
  });
  return drizzle({ client: pool, schema, casing: 'snake_case' });
}

export type Db = ReturnType<typeof createDb>;
/** A Drizzle transaction handle, usable wherever a gateway takes a `Db`-like executor. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;
