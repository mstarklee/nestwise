import type { Db } from '@nestwise/db';
import { getTestDb, truncateApp } from '@nestwise/db/testing';
import { afterAll, beforeAll, beforeEach } from 'vitest';

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
    await truncateApp(db!);
  });
  afterAll(async () => {
    await db?.$client.end();
  });
  return () => db!;
}
