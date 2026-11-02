import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/client';
import { testDatabaseUrl } from '../src/database-url';
import { getTestDb } from '../src/testing';

const opened: Db[] = [];
afterAll(async () => {
  await Promise.all(opened.map((db) => db.$client.end()));
});

describe('createDb', () => {
  it('gives every query a time limit, so a stuck call fails instead of hanging', async () => {
    await getTestDb(); // makes sure the test database exists
    const db = createDb(testDatabaseUrl(), { queryTimeoutMs: 300 });
    opened.push(db);
    const started = Date.now();
    await expect(db.execute(sql`select pg_sleep(3)`)).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('returns rows from execute()', async () => {
    const db = createDb(testDatabaseUrl());
    opened.push(db);
    const result = await db.execute<{ one: number }>(sql`select 1 as one`);
    expect(result.rows).toEqual([{ one: 1 }]);
  });
});
