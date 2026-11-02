import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';
import { databaseUrl } from './database-url';
import { migrationsFolder } from './migrations-folder';

// Applies migrations to DIRECT_DATABASE_URL, or the DB_* database. Run with: pnpm --filter @nestwise/db migrate
const db = createDb(process.env.DIRECT_DATABASE_URL ?? databaseUrl(), { max: 1 });
try {
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied.');
} finally {
  await db.$client.end();
}
