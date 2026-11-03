import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { POST as close } from '../../../app/api/v1/months/[ym]/close/route';
import { GET as getReview } from '../../../app/api/v1/months/[ym]/review/route';
import { POST as record } from '../../../app/api/v1/transactions/route';
import { makeEnsureMonthBudgetUseCase } from '@/composition/month-budget';
import { makeEnsureYearPlanUseCase } from '@/composition/year-plan';
import { runDailyJob } from '@/orchestration/run-daily-job';
import { useTestDb } from '../setup';
import { adminWithPlan, params, request } from '../support/api';

const db = useTestDb();
const OCT = { year: 2026, month: 10 };
const noDelivery = { push: { send: async () => 'ok' as const }, email: { send: async () => true } };

const closeOctober = (token: string | undefined) => close(request('POST', '/api/v1/months/2026-10/close', token), params({ ym: '2026-10' }));
const status = async (familyId: string) =>
  (await db().execute<{ status: string }>(sql`select status from app.month_budgets where family_id = ${familyId} and year = 2026 and month = 10`)).rows[0]?.status;

describe('/api/v1/months/{ym}/review and /close', () => {
  it('the October review shows totals and bills; closing is 204, then 409; a member gets 403', async () => {
    const { token, familyId, itemId, join } = await adminWithPlan(db());
    const groceries = itemId('groceries');
    await record(request('POST', '/api/v1/transactions', token, { id: randomUUID(), amountMinor: 1_000_000, txnDate: '2026-10-05', allocations: [{ itemId: groceries, amountMinor: 1_000_000 }] }));
    const review = await getReview(request('GET', '/api/v1/months/2026-10/review', token), params({ ym: '2026-10' }));
    expect(review.status).toBe(200);
    const body = (await review.json()) as { status: string; totals: { actualMinor: number }; over: { itemId: string }[] };
    expect(body).toMatchObject({ status: 'active', totals: { actualMinor: 1_000_000 } });
    expect(body.over[0]!.itemId).toBe(groceries);
    expect((await closeOctober(await join('member'))).status).toBe(403);
    expect((await closeOctober(undefined)).status).toBe(401);
    expect((await closeOctober(token)).status).toBe(204);
    expect(await status(familyId)).toBe('closed');
    expect((await closeOctober(token)).status).toBe(409);
  });

  it('a late expense into closed October is saved and its activity row is marked late (Review Focus 3)', async () => {
    const { token, familyId, itemId } = await adminWithPlan(db());
    await makeEnsureMonthBudgetUseCase(db()).execute({ familyId, period: OCT });
    expect((await closeOctober(token)).status).toBe(204);
    const id = randomUUID();
    const response = await record(request('POST', '/api/v1/transactions', token, { id, amountMinor: 5_000, txnDate: '2026-10-30', allocations: [{ itemId: itemId('groceries'), amountMinor: 5_000 }] }));
    expect(response.status).toBe(201);
    const { rows } = await db().execute<{ late_edit: boolean }>(sql`select late_edit from app.activity where entity_id = ${id}`);
    expect(rows).toEqual([{ late_edit: true }]);
  });
});

describe('runDailyJob closing last month', () => {
  it('on 10 November closes October once; on the 11th nothing more happens', async () => {
    const { familyId } = await adminWithPlan(db());
    await makeEnsureMonthBudgetUseCase(db()).execute({ familyId, period: OCT });
    // The job only runs for families whose setup is finished.
    await makeEnsureYearPlanUseCase(db()).execute({ familyId, year: 2026 });
    await db().execute(sql`update app.year_plans set first_year_check_at = now() where family_id = ${familyId}`);
    await runDailyJob(new Date('2026-11-09T21:00:00Z'), { db: db(), ...noDelivery });
    expect(await status(familyId)).toBe('closed');
    const closedAt = (await db().execute<{ closed_at: Date; closed_by: string | null }>(sql`select closed_at, closed_by from app.month_budgets where family_id = ${familyId} and year = 2026 and month = 10`)).rows[0]!;
    expect(closedAt.closed_by).toBeNull();
    await runDailyJob(new Date('2026-11-10T21:00:00Z'), { db: db(), ...noDelivery });
    const again = (await db().execute<{ closed_at: Date }>(sql`select closed_at from app.month_budgets where family_id = ${familyId} and year = 2026 and month = 10`)).rows[0]!;
    expect(again.closed_at).toEqual(closedAt.closed_at);
  });
});
