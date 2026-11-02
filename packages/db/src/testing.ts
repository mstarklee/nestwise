import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';
import { createDb, type Db } from './client';
import { testDatabaseUrl } from './database-url';
import { migrationsFolder } from './migrations-folder';

// Integration-test support only. Never import from app code.

/** Creates the test database on the DB_* server if it does not exist yet. */
async function ensureDatabaseExists(url: string): Promise<void> {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const admin = new Client({ connectionString: maintenance.toString() });
  await admin.connect();
  try {
    const { rows } = await admin.query('select 1 from pg_database where datname = $1', [name]);
    if (rows.length === 0) await admin.query(`create database "${name.replaceAll('"', '""')}"`);
  } finally {
    await admin.end();
  }
}

let shared: Promise<Db> | undefined;

/** One migrated test database per test run. */
export function getTestDb(): Promise<Db> {
  shared ??= (async () => {
    const url = testDatabaseUrl();
    if (!process.env.TEST_DATABASE_URL) await ensureDatabaseExists(url);
    const db = createDb(url, { max: 5 });
    await migrate(db, { migrationsFolder });
    return db;
  })();
  return shared;
}

/** Empties every table in schema `app`. */
export async function truncateApp(db: Db): Promise<void> {
  const { rows } = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'app'`);
  if (rows.length === 0) return;
  const tables = rows.map((r) => `app."${r.tablename}"`).join(', ');
  await db.execute(sql.raw(`truncate ${tables} restart identity cascade`));
}
