import { randomUUID } from 'node:crypto';
import { todayIn } from '@nestwise/domain/shared';
import { describe, expect, it } from 'vitest';
import { GET as getMonth } from '../../../app/api/v1/months/[ym]/route';
import { GET as getPot } from '../../../app/api/v1/pot/route';
import { POST as restore } from '../../../app/api/v1/transactions/[id]/restore/route';
import { DELETE as remove, PATCH as edit } from '../../../app/api/v1/transactions/[id]/route';
import { GET as list, POST as record } from '../../../app/api/v1/transactions/route';
import { GET as getYear } from '../../../app/api/v1/years/[y]/route';
import { makeEnsureYearPlanUseCase } from '@/composition/year-plan';
import { useTestDb } from '../setup';
import { adminWithPlan, params, request } from '../support/api';

const db = useTestDb();

const post = (token: string, body: unknown) => record(request('POST', '/api/v1/transactions', token, body));
const groceriesActual = async (token: string, ym: string, groceries: string) => {
  const body = (await (await getMonth(request('GET', `/api/v1/months/${ym}`, token), params({ ym }))).json()) as { lines: { itemId: string; actualMinor: number }[] };
  return body.lines.find((l) => l.itemId === groceries)!.actualMinor;
};

describe('/api/v1/transactions', () => {
  it('201, then 200 on a retry; 422 on a bad sum; 403 for a viewer; 404 for an unknown item; 401 signed out', async () => {
    const { token, itemId, join } = await adminWithPlan(db());
    const id = randomUUID();
    const body = { id, amountMinor: 94_500, txnDate: '2026-10-07', merchant: 'Local grocery shop', allocations: [{ itemId: itemId('groceries'), amountMinor: 94_500 }] };
    const created = await post(token, body);
    expect(created.status).toBe(201);
    expect(((await created.json()) as { transaction: { id: string; period: unknown } }).transaction).toMatchObject({ id, period: { year: 2026, month: 10 } });
    expect((await post(token, body)).status).toBe(200);
    expect((await post(token, { ...body, id: randomUUID(), amountMinor: 95_000 })).status).toBe(422);
    expect((await post(token, { ...body, id: randomUUID(), allocations: [{ itemId: randomUUID(), amountMinor: 94_500 }] })).status).toBe(404);
    expect((await post(await join('viewer'), { ...body, id: randomUUID() })).status).toBe(403);
    expect((await record(request('POST', '/api/v1/transactions', undefined, body))).status).toBe(401);
    expect((await post(token, { ...body, id: randomUUID(), amountMinor: '945' })).status).toBe(400);
    expect(await groceriesActual(token, '2026-10', itemId('groceries'))).toBe(94_500);
  });

  it('with no date, the expense is dated today in the family’s time zone', async () => {
    const { token, itemId } = await adminWithPlan(db());
    const response = await post(token, { id: randomUUID(), amountMinor: 100, allocations: [{ itemId: itemId('groceries'), amountMinor: 100 }] });
    expect(((await response.json()) as { transaction: { txnDate: string } }).transaction.txnDate).toBe(todayIn('Asia/Kolkata', new Date()));
  });

  it('lists, edits (date moves the month), deletes and restores', async () => {
    const { token, itemId } = await adminWithPlan(db());
    const groceries = itemId('groceries');
    const id = randomUUID();
    await post(token, { id, amountMinor: 94_500, txnDate: '2026-10-31', allocations: [{ itemId: groceries, amountMinor: 94_500 }] });

    const listed = await list(request('GET', '/api/v1/transactions?month=2026-10', token));
    expect(listed.status).toBe(200);
    expect(((await listed.json()) as { transactions: { id: string }[] }).transactions.map((t) => t.id)).toEqual([id]);
    expect((await list(request('GET', '/api/v1/transactions?month=2026-13', token))).status).toBe(400);

    const moved = await edit(request('PATCH', `/api/v1/transactions/${id}`, token, { txnDate: '2026-11-01' }), params({ id }));
    expect(moved.status).toBe(200);
    expect(await groceriesActual(token, '2026-10', groceries)).toBe(0);
    expect(await groceriesActual(token, '2026-11', groceries)).toBe(94_500);

    expect((await remove(request('DELETE', `/api/v1/transactions/${id}`, token), params({ id }))).status).toBe(200);
    expect(await groceriesActual(token, '2026-11', groceries)).toBe(0);
    expect((await edit(request('PATCH', `/api/v1/transactions/${id}`, token, { note: 'x' }), params({ id }))).status).toBe(404);
    expect((await restore(request('POST', `/api/v1/transactions/${id}/restore`, token), params({ id }))).status).toBe(200);
    expect(await groceriesActual(token, '2026-11', groceries)).toBe(94_500);
    expect((await remove(request('DELETE', '/api/v1/transactions/nope', token), params({ id: 'nope' }))).status).toBe(400);
  });

  it('a yearly payment lowers the pot and the line; deleting it puts both back (Review Focus 4)', async () => {
    const { token, itemId, familyId } = await adminWithPlan(db());
    const dress = itemId('diwali_dress');
    const line = async () => {
      const body = (await (await getYear(request('GET', '/api/v1/years/2026', token), params({ y: '2026' }))).json()) as {
        lines: { itemId: string; paidMinor: number; remainingMinor: number; status: string }[];
      };
      return body.lines.find((l) => l.itemId === dress)!;
    };
    const pot = async () => ((await (await getPot(request('GET', '/api/v1/pot', token))).json()) as { balanceMinor: number }).balanceMinor;
    await makeEnsureYearPlanUseCase(db()).execute({ familyId, year: 2026 });
    const id = randomUUID();
    // planYear 2026 explicitly, so the check does not depend on today's date.
    await post(token, { id, amountMinor: 500_000, txnDate: '2026-11-07', allocations: [{ itemId: dress, amountMinor: 500_000, planYear: 2026 }] });
    expect(await pot()).toBe(-500_000);
    expect(await line()).toMatchObject({ paidMinor: 500_000, remainingMinor: 0, status: 'paid' });
    await remove(request('DELETE', `/api/v1/transactions/${id}`, token), params({ id }));
    expect(await pot()).toBe(0);
    expect(await line()).toMatchObject({ paidMinor: 0, remainingMinor: 500_000 });
  });
});
