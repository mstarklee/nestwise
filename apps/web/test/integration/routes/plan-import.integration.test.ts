import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { POST as createFamily } from '../../../app/api/v1/families/route';
import { POST as importPlan } from '../../../app/api/v1/plan/import/route';
import { GET as getTemplates } from '../../../app/api/v1/templates/route';
import { useTestDb } from '../setup';
import { request, signUp } from '../support/api';

useTestDb();

describe('/api/v1/plan/import', () => {
  it('imports the family plan once for a listed email; 403 for anyone else; 409 the second time', async () => {
    const email = `${randomUUID()}@example.com`;
    process.env.ALLOWED_SIGNUP_EMAILS = email;
    process.env.PLAN_IMPORT_EMAILS = '';
    const { token } = await signUp(email);
    await createFamily(request('POST', '/api/v1/families', token, { name: 'F', currencyCode: 'INR', timeZone: 'Asia/Kolkata', openingPotMinor: 0 }));
    expect((await importPlan(request('POST', '/api/v1/plan/import', token))).status).toBe(403);

    process.env.PLAN_IMPORT_EMAILS = email.toUpperCase();
    const first = await importPlan(request('POST', '/api/v1/plan/import', token));
    expect(first.status).toBe(201);
    expect((await importPlan(request('POST', '/api/v1/plan/import', token))).status).toBe(409);
    const templates = (await (await getTemplates(request('GET', '/api/v1/templates', token))).json()) as { totals: { yearly: number } };
    expect(templates.totals.yearly).toBe(44_300_000);
  });
});
