import { describe, expect, it } from 'vitest';
import { GET as health } from '../../../app/api/v1/health/route';
import { useTestDb } from '../setup';

useTestDb();

describe('/api/v1/health', () => {
  it('is 200 when the app can reach its database, with nothing about any family', async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', database: 'ok' });
  });
});
