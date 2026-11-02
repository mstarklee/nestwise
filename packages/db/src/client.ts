import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const isLocalHost = (url: string) => /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

export function createDb(url: string, options: { max?: number } = {}) {
  const client = postgres(url, {
    prepare: false, // the Supabase pooler (transaction mode) does not support prepared statements
    ssl: isLocalHost(url) ? false : 'require',
    max: options.max ?? 5,
    onnotice: () => {},
  });
  return drizzle({ client, schema, casing: 'snake_case' });
}

export type Db = ReturnType<typeof createDb>;
/** A Drizzle transaction handle, usable wherever a gateway takes a `Db`-like executor. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;
