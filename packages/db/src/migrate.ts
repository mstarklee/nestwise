import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';
import { databaseUrl } from './database-url';
import { migrationsFolder } from './migrations-folder';

// Applies the committed migrations.
//   pnpm --filter @nestwise/db migrate        → DIRECT_DATABASE_URL, or the DB_* database (development)
//   pnpm --filter @nestwise/db migrate:prod   → PROD_DIRECT_DATABASE_URL only (a deliberate release step, RUNBOOK.md)
const prod = process.argv.includes('--prod');
const url = prod ? process.env.PROD_DIRECT_DATABASE_URL : (process.env.DIRECT_DATABASE_URL ?? databaseUrl());
if (!url) {
  console.error('Set PROD_DIRECT_DATABASE_URL (the production direct connection, port 5432) for migrate:prod.');
  process.exit(1);
}
const db = createDb(url, { max: 1 });
try {
  await migrate(db, { migrationsFolder });
  console.log(prod ? 'Production migrations applied.' : 'Migrations applied.');
} finally {
  await db.$client.end();
}
