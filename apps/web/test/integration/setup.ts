import type { Db } from '@nestwise/db';
import { testDatabaseUrl } from '@nestwise/db';
import { getTestDb, truncateApp } from '@nestwise/db/testing';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { settleBackground } from '@/http/background';

// Route handlers build their own pool through getDb(), which reads DATABASE_URL: point it at the test database so a
// test can never touch the real one.
process.env.DATABASE_URL = testDatabaseUrl();

/**
 * Registers the integration-test lifecycle: one migrated test database (TEST_DATABASE_URL, or DB_* with
 * TEST_DB_NAME / nestwise_test), every app table emptied before each test. Returns a getter for the Db.
 */
export function useTestDb(): () => Db {
  let db: Db | undefined;
  beforeAll(async () => {
    db = await getTestDb();
  });
  beforeEach(async () => {
    // Work a route started after its response (spending alerts) must finish before the tables are emptied.
    await settleBackground();
    await truncateApp(db!);
  });
  afterAll(async () => {
    await settleBackground();
    await db?.$client.end();
  });
  return () => db!;
}
