import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';
import { migrationUrl } from './database-url';
import { migrationsFolder } from './migrations-folder';

// Applies the committed migrations.
//   pnpm --filter @nestwise/db migrate          → DIRECT_DATABASE_URL, or the DB_* database (development)
//   pnpm --filter @nestwise/db migrate:prod     → PROD_DIRECT_DATABASE_URL only (by hand, RUNBOOK.md)
//   pnpm --filter @nestwise/db migrate:deploy   → the Vercel build: production deploys only, previews skip
const mode = process.argv.includes('--deploy') ? 'deploy' : process.argv.includes('--prod') ? 'prod' : 'dev';
let url: string | null;
try {
  url = migrationUrl(mode);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
if (url === null) {
  console.log('Not a production deploy: migrations skipped.');
  process.exit(0);
}
const db = createDb(url, { max: 1 });
try {
  await migrate(db, { migrationsFolder });
  console.log(mode === 'dev' ? 'Migrations applied.' : 'Production migrations applied.');
} finally {
  await db.$client.end();
}
