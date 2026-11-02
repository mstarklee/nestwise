import { describe, expect, it } from 'vitest';
import { clockFrom } from '@/adapters/shared/system-clock';

describe('clockFrom', () => {
  it('uses the real time unless a fixed time is given outside production (browser tests only)', () => {
    const before = Date.now();
    expect(clockFrom({}).now().getTime()).toBeGreaterThanOrEqual(before);
    expect(clockFrom({ NESTWISE_FIXED_NOW: '2026-11-01T04:00:00Z', NODE_ENV: 'development' }).now().toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(clockFrom({ NESTWISE_FIXED_NOW: '2026-11-01T04:00:00Z', NODE_ENV: 'production' }).now().getTime()).toBeGreaterThanOrEqual(before);
    expect(clockFrom({ NESTWISE_FIXED_NOW: '2026-11-01T04:00:00Z', NODE_ENV: 'development', VERCEL_ENV: 'production' }).now().getTime()).toBeGreaterThanOrEqual(before);
  });
});
