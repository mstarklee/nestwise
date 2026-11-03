import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GET as getActivity } from '../../../app/api/v1/activity/route';
import { GET as list, POST as record } from '../../../app/api/v1/transactions/route';
import { useTestDb } from '../setup';
import { adminWithPlan, request } from '../support/api';

const db = useTestDb();

type Page = { rows: { id: number; action: string; actorEmail: string; entityId: string; lateEdit: boolean }[]; nextBefore: number | null };
const activity = async (token: string | undefined, query = '') => getActivity(request('GET', `/api/v1/activity${query}`, token));

describe('/api/v1/activity', () => {
  it('lists the family’s history newest first, a page at a time; another family sees none; 401 signed out', async () => {
    const { token, itemId } = await adminWithPlan(db());
    const spend = (id: string) => ({ id, amountMinor: 1_000, txnDate: '2026-10-05', allocations: [{ itemId: itemId('groceries'), amountMinor: 1_000 }] });
    const [a, b] = [randomUUID(), randomUUID()];
    await record(request('POST', '/api/v1/transactions', token, spend(a)));
    await record(request('POST', '/api/v1/transactions', token, spend(b)));
    const first = (await (await activity(token, '?limit=1')).json()) as Page;
    expect(first.rows).toMatchObject([{ action: 'expense.record', entityId: b, lateEdit: false }]);
    expect(first.rows[0]!.actorEmail).toMatch(/@example\.com$/);
    const second = (await (await activity(token, `?limit=1&before=${first.nextBefore}`)).json()) as Page;
    expect(second.rows[0]!.entityId).toBe(a);
    const stranger = await adminWithPlan(db());
    expect(((await (await activity(stranger.token)).json()) as Page).rows.some((r) => r.entityId === a)).toBe(false);
    expect((await activity(undefined)).status).toBe(401);
    expect((await activity(token, '?limit=abc')).status).toBe(400);
  });
});

describe('/api/v1/transactions ledger filters', () => {
  it('filters by who paid and how it was captured', async () => {
    const { token, itemId, join } = await adminWithPlan(db());
    const spouse = await join('member');
    const groceries = itemId('groceries');
    const mine = randomUUID();
    const theirs = randomUUID();
    await record(request('POST', '/api/v1/transactions', token, { id: mine, amountMinor: 1_000, txnDate: '2026-10-05', allocations: [{ itemId: groceries, amountMinor: 1_000 }] }));
    await record(request('POST', '/api/v1/transactions', spouse, { id: theirs, amountMinor: 2_000, txnDate: '2026-10-06', allocations: [{ itemId: groceries, amountMinor: 2_000 }] }));
    const ids = async (query: string) =>
      ((await (await list(request('GET', `/api/v1/transactions?month=2026-10${query}`, token))).json()) as { transactions: { id: string }[] }).transactions.map((t) => t.id);
    const spouseId = ((await (await list(request('GET', '/api/v1/transactions?month=2026-10', spouse))).json()) as { transactions: { id: string; enteredBy: string }[] }).transactions.find(
      (t) => t.id === theirs,
    )!.enteredBy;
    expect(await ids(`&paidBy=${spouseId}`)).toEqual([theirs]);
    expect((await ids('&method=typed')).sort()).toEqual([mine, theirs].sort());
    expect(await ids('&method=receipt')).toEqual([]);
  });
});
