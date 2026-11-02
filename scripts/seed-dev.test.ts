import { describe, expect, it } from 'vitest';
import { runSeedDev } from './seed-dev';

const local = { DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'nestwise', DB_USER: 'u', DB_PASSWORD: 'p' };

describe('seed:dev guard', () => {
  it('seed:dev refuses to run against production', async () => {
    await expect(runSeedDev({ VERCEL_ENV: 'production', DATABASE_URL: 'postgres://prod' })).rejects.toThrow(/production/);
    await expect(runSeedDev({ ...local, NODE_ENV: 'production' })).rejects.toThrow(/production/);
  });

  it('refuses a database that is not on this computer, and never uses DATABASE_URL', async () => {
    await expect(runSeedDev({ ...local, DB_HOST: 'aws-0-ap-south-1.pooler.supabase.com' })).rejects.toThrow(/this computer/);
    await expect(runSeedDev({ DATABASE_URL: 'postgres://localhost/x' })).rejects.toThrow(/DB_HOST/);
  });
});
