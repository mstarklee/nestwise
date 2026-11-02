import 'server-only';
import { createDb, databaseUrl, type Db } from '@nestwise/db';
import { attachDatabasePool } from '@vercel/functions';

let db: Db | undefined;

/**
 * The one database pool per server instance (the only singleton; use cases are built per request).
 * attachDatabasePool keeps a Vercel instance alive until idle connections close, so a paused instance never
 * wakes up holding a dead connection (Stage 0 finding).
 */
export function getDb(): Db {
  if (!db) {
    db = createDb(databaseUrl());
    attachDatabasePool(db.$client);
  }
  return db;
}
