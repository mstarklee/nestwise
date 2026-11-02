import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Local browser test of the core flow (plan Task 13). It runs the dev server against its own database,
// nestwise_e2e on the DB_* server, which global-setup empties first. It never uses DATABASE_URL (Supabase).
const envFile = fileURLToPath(new URL('../../.env.local', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const PORT = 3100;
export const E2E_EMAIL = 'e2e-admin@example.com';
export const E2E_DB_NAME = 'nestwise_e2e';

function e2eDatabaseUrl(): string {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_PORT || !DB_USER || !DB_PASSWORD) throw new Error('The browser test needs DB_HOST, DB_PORT, DB_USER and DB_PASSWORD');
  if (DB_NAME === E2E_DB_NAME) throw new Error('DB_NAME is the browser-test database; the test would erase it');
  return `postgres://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${E2E_DB_NAME}`;
}

export default defineConfig({
  testDir: './test/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  globalSetup: './test/e2e/global-setup.ts',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure', locale: 'en-IN', timezoneId: 'Asia/Kolkata' },
  projects: [{ name: 'webkit-iphone', use: { ...devices['iPhone 15'] } }],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/sign-in`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: e2eDatabaseUrl(),
      TEST_DB_NAME: E2E_DB_NAME,
      // "Today" is 1 November 2026 in India, so the expectations match the PRD's November example.
      NESTWISE_FIXED_NOW: '2026-11-01T04:00:00Z',
      SIGNUP_MODE: 'invite',
      ALLOWED_SIGNUP_EMAILS: E2E_EMAIL,
      PLAN_IMPORT_EMAILS: E2E_EMAIL,
    },
  },
});
