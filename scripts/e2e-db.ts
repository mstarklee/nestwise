/**
 * Prepares the browser-test database (TEST_DB_NAME, e.g. nestwise_e2e, on the DB_* server): creates it if needed,
 * applies the migrations and empties every app table. Run by apps/web/test/e2e/global-setup.ts.
 */
import { getTestDb, truncateApp } from '@nestwise/db/testing';

async function main() {
  if (!process.env.TEST_DB_NAME) throw new Error('Set TEST_DB_NAME to the browser-test database');
  const db = await getTestDb();
  try {
    await truncateApp(db);
    console.log(`Browser-test database ${process.env.TEST_DB_NAME} is ready.`);
  } finally {
    await db.$client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
