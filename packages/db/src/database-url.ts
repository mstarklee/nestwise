type Env = Readonly<Record<string, string | undefined>>;

const PARTS = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const;

function fromParts(env: Env, databaseName: string): string {
  const missing = PARTS.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Database settings missing: ${missing.join(', ')}`);
  const user = encodeURIComponent(env.DB_USER!);
  const password = encodeURIComponent(env.DB_PASSWORD!);
  return `postgres://${user}:${password}@${env.DB_HOST}:${env.DB_PORT}/${encodeURIComponent(databaseName)}`;
}

/** The app's database: DATABASE_URL if set, otherwise built from DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD. */
export function databaseUrl(env: Env = process.env): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  return fromParts(env, env.DB_NAME ?? '');
}

/**
 * The integration-test database: TEST_DATABASE_URL if set, otherwise the DB_* server with database
 * TEST_DB_NAME (default `nestwise_test`). Tests truncate it, so it may never be the main database or production.
 */
export function testDatabaseUrl(env: Env = process.env): string {
  if (env.VERCEL_ENV === 'production') throw new Error('Refusing to run tests against production');
  if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL;
  const name = env.TEST_DB_NAME ?? 'nestwise_test';
  if (name === env.DB_NAME) throw new Error('TEST_DB_NAME is the same database as DB_NAME; tests would erase it');
  return fromParts(env, name);
}

/**
 * Where `migrate` applies the committed migrations, or null to skip.
 *   dev    → DIRECT_DATABASE_URL, or the DB_* database
 *   prod   → PROD_DIRECT_DATABASE_URL only (by hand, RUNBOOK.md)
 *   deploy → the Vercel build: PROD_DIRECT_DATABASE_URL on production deploys only; previews and local builds skip
 */
export function migrationUrl(mode: 'dev' | 'prod' | 'deploy', env: Env = process.env): string | null {
  if (mode === 'dev') return env.DIRECT_DATABASE_URL ?? databaseUrl(env);
  if (mode === 'deploy' && env.VERCEL_ENV !== 'production') return null;
  if (!env.PROD_DIRECT_DATABASE_URL) {
    throw new Error('Set PROD_DIRECT_DATABASE_URL (the production session-pooler or direct connection, port 5432).');
  }
  return env.PROD_DIRECT_DATABASE_URL;
}
