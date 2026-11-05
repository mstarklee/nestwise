import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { importPlan } from '../../../../../scripts/import-plan';
import { POST as signup } from '../../../app/api/v1/auth/signup/route';
import { POST as createFamily } from '../../../app/api/v1/families/route';
import { PUT as setLine } from '../../../app/api/v1/months/[ym]/lines/[itemId]/route';
import { POST as reset } from '../../../app/api/v1/months/[ym]/reset/route';
import { GET as summary } from '../../../app/api/v1/months/[ym]/route';
import { DrizzlePlanGateway } from '@/adapters/plan/drizzle-plan-gateway';
import { useTestDb } from '../setup';
import { verifyEmailOf } from '../support/api';

const db = useTestDb();

const request = (method: string, url: string, token: string, body?: unknown) =>
  new Request(`https://nestwise.test${url}`, {
    method,
    headers: { 'content-type': 'application/json', cookie: `nw_session=${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

async function adminWithPlan() {
  process.env.ALLOWED_SIGNUP_EMAILS = 'priya@example.com';
  const signed = await signup(
    new Request('https://nestwise.test/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'priya@example.com', password: 'correct-horse' }),
    }),
  );
  const token = /nw_session=([^;]*)/.exec(signed.headers.get('set-cookie') ?? '')?.[1] ?? '';
  await verifyEmailOf('priya@example.com');
  const created = await createFamily(request('POST', '/api/v1/families', token, { name: 'Our Family', currencyCode: 'INR', timeZone: 'Asia/Kolkata', openingPotMinor: 0 }));
  const { family } = (await created.json()) as { family: { id: string } };
  await importPlan({ db: db(), familyId: family.id });
  const items = await new DrizzlePlanGateway(db()).listItems(family.id, { includeArchived: true });
  const user = (await (await signed.clone().json()) as { user: { id: string } }).user;
  return { token, familyId: family.id, userId: user.id, itemId: (k: string) => items.find((i) => i.seedKey === k)!.id };
}

type Summary = { totals: { plannedMinor: number; actualMinor: number }; lines: { itemId: string; plannedMinor: number; actualMinor: number }[]; savings: { plannedMinor: number } };

describe('/api/v1/months/[ym]', () => {
  it('returns the month summary, creating the month from the template on first use', async () => {
    const { token } = await adminWithPlan();
    const response = await summary(request('GET', '/api/v1/months/2026-11', token), params({ ym: '2026-11' }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Summary;
    expect(body.totals).toMatchObject({ plannedMinor: 8_150_000, actualMinor: 0 });
    expect(body.lines).toHaveLength(20);
    expect(body.savings.plannedMinor).toBe(1_700_000);
  });

  it('editing December leaves November alone; a bad month is 400', async () => {
    const { token, itemId } = await adminWithPlan();
    const groceries = itemId('groceries');
    const put = await setLine(request('PUT', `/api/v1/months/2026-12/lines/${groceries}`, token, { plannedMinor: 900_000 }), params({ ym: '2026-12', itemId: groceries }));
    expect(put.status).toBe(200);
    const nov = (await (await summary(request('GET', '/api/v1/months/2026-11', token), params({ ym: '2026-11' }))).json()) as Summary;
    const dec = (await (await summary(request('GET', '/api/v1/months/2026-12', token), params({ ym: '2026-12' }))).json()) as Summary;
    expect(nov.lines.find((l) => l.itemId === groceries)!.plannedMinor).toBe(800_000);
    expect(dec.lines.find((l) => l.itemId === groceries)!.plannedMinor).toBe(900_000);
    expect((await summary(request('GET', '/api/v1/months/2026-13', token), params({ ym: '2026-13' }))).status).toBe(400);
  });

  it('blank works on an empty month; once the month has an expense, reset is 409', async () => {
    const { token, familyId, userId, itemId } = await adminWithPlan();
    const blank = await reset(request('POST', '/api/v1/months/2026-11/reset', token, { mode: 'blank' }), params({ ym: '2026-11' }));
    expect(blank.status).toBe(200);
    const id = randomUUID();
    await db().transaction(async (tx) => {
      await tx.execute(sql`insert into app.transactions (id, family_id, kind, amount_minor, currency_code, txn_date, entered_by, capture_method, status, entry_tz)
        values (${id}, ${familyId}, 'expense', 94500, 'INR', '2026-11-03', ${userId}, 'typed', 'confirmed', 'Asia/Kolkata')`);
      await tx.execute(sql`insert into app.allocations (id, transaction_id, family_id, item_id, amount_minor) values (${randomUUID()}, ${id}, ${familyId}, ${itemId('groceries')}, 94500)`);
    });
    const refused = await reset(request('POST', '/api/v1/months/2026-11/reset', token, { mode: 'copy_previous' }), params({ ym: '2026-11' }));
    expect(refused.status).toBe(409);
    const nov = (await (await summary(request('GET', '/api/v1/months/2026-11', token), params({ ym: '2026-11' }))).json()) as Summary;
    expect(nov.lines.find((l) => l.itemId === itemId('groceries'))).toMatchObject({ plannedMinor: 0, actualMinor: 94_500 });
  });
});
