import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const ignored = ['**/node_modules/**', '**/.next/**', 'spikes/**'];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/test/**/*.test.ts', 'apps/web/test/unit/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: [...ignored, '**/*.integration.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['**/*.integration.test.ts'],
          exclude: ignored,
          // DB_* (or TEST_DATABASE_URL) from .env.local; tests use their own database, never DB_NAME.
          env: loadEnv('test', process.cwd(), ''),
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
