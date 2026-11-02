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
          fileParallelism: false,
        },
      },
    ],
  },
});
