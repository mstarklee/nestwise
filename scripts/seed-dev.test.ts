import { describe, expect, it } from 'vitest';
import type { IsoDate } from '@nestwise/domain/shared';
import { showcaseRows } from '../fixtures/sample-family';
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

describe('seed:dev --showcase', () => {
  const today = '2026-11-05' as IsoDate;
  const total = (keys: string[]) =>
    showcaseRows(today)
      .filter((r) => keys.includes(r.itemKey))
      .reduce((sum, r) => sum + r.amountMinor, 0);

  it('showcase rows are dated in today’s month, never after today', () => {
    expect(showcaseRows(today).every((r) => r.date >= '2026-11-01' && r.date <= '2026-11-05')).toBe(true);
    expect(showcaseRows('2026-11-03' as IsoDate).every((r) => r.date <= '2026-11-03')).toBe(true);
  });

  it('showcase rows make Food over plan, Kids nearly used up and Housing exactly used', () => {
    expect(total(['groceries', 'fruits', 'vegetables', 'non_veg', 'outside_food'])).toBe(2_630_000); // 26,300 of 24,000
    expect(total(['kids_maintenance', 'football', 'diapers'])).toBe(720_000); // 7,200 of 8,000
    expect(total(['rent'])).toBe(2_000_000); // exactly 100%
  });

  it('the seed still refuses production with --showcase', async () => {
    await expect(runSeedDev({ VERCEL_ENV: 'production' }, undefined, { showcase: true })).rejects.toThrow(/production/);
  });
});
