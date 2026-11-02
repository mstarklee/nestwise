import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DrizzleYearPaidGateway } from '@/adapters/year-plan/drizzle-year-paid-gateway';
import { DrizzleYearPlanGateway } from '@/adapters/year-plan/drizzle-year-plan-gateway';
import { makeEnsureYearPlanUseCase } from '@/composition/year-plan';
import { useTestDb } from '../../setup';
import { familyWithPlan } from '../../support/family-with-plan';

const db = useTestDb();

type Txn = {
  kind?: 'expense' | 'refund';
  status?: 'pending' | 'confirmed';
  date?: string;
  deleted?: boolean;
  mergedInto?: string;
  planYear?: number | null;
  amount: number;
  itemId: string;
};

async function insertTxn(familyId: string, userId: string, t: Txn): Promise<string> {
  const id = randomUUID();
  await db().transaction(async (tx) => {
    await tx.execute(sql`insert into app.transactions
        (id, family_id, kind, amount_minor, currency_code, txn_date, entered_by, capture_method, status, entry_tz, deleted_at, merged_into)
      values (${id}, ${familyId}, ${t.kind ?? 'expense'}, ${t.amount}, 'INR', ${t.date ?? '2026-11-07'}, ${userId}, 'typed',
              ${t.status ?? 'confirmed'}, 'Asia/Kolkata', ${t.deleted ? new Date().toISOString() : null}, ${t.mergedInto ?? null})`);
    await tx.execute(sql`insert into app.allocations (id, transaction_id, family_id, item_id, plan_year, amount_minor)
      values (${randomUUID()}, ${id}, ${familyId}, ${t.itemId}, ${t.planYear === undefined ? 2026 : t.planYear}, ${t.amount})`);
  });
  return id;
}

describe('DrizzleYearPlanGateway', () => {
  it('two simultaneous ensures for a year create one plan, in template order, and both get it', async () => {
    const f = await familyWithPlan(db());
    const [a, b] = await Promise.all([
      makeEnsureYearPlanUseCase(db()).execute({ familyId: f.familyId, year: 2026 }),
      makeEnsureYearPlanUseCase(db()).execute({ familyId: f.familyId, year: 2026 }),
    ]);
    expect(a.id).toBe(b.id);
    const { rows } = await db().execute(sql`select 1 from app.year_plans where family_id = ${f.familyId}`);
    expect(rows).toHaveLength(1);
    const stored = (await new DrizzleYearPlanGateway(db()).findByYear(f.familyId, 2026))!;
    expect(stored.lines).toHaveLength(22);
    expect(stored.lines[0]).toMatchObject({ name: 'Car Insurance', plannedMinor: 650_000, dueYear: 2026, dueMonth: 10, year: 2026, state: 'open' });
    expect(stored.lines.find((l) => l.itemId === f.itemId('tour'))).toMatchObject({ dueMonth: null, dueDay: null });
    expect(stored.firstYearCheckAt).toBeNull();
  });

  it('round-trips a line, guards the first-year check, and never touches another family’s plan', async () => {
    const f = await familyWithPlan(db());
    const other = await familyWithPlan(db());
    const plan = await makeEnsureYearPlanUseCase(db()).execute({ familyId: f.familyId, year: 2026 });
    const gateway = new DrizzleYearPlanGateway(db());
    const tour = plan.lines.find((l) => l.itemId === f.itemId('tour'))!;

    await gateway.saveLine({ ...tour, dueMonth: 5, dueDay: 20, state: 'cancelled' });
    expect(await gateway.findLine(f.familyId, tour.id)).toMatchObject({ dueMonth: 5, dueDay: 20, state: 'cancelled', year: 2026 });

    expect(await gateway.findLine(other.familyId, tour.id)).toBeUndefined();
    expect(await gateway.findByYear(other.familyId, 2026)).toBeUndefined();
    await gateway.saveLine({ ...tour, familyId: other.familyId, state: 'done' });
    expect((await gateway.findLine(f.familyId, tour.id))!.state).toBe('cancelled');

    expect(await gateway.markFirstYearCheck(other.familyId, plan.id, new Date())).toBe(false);
    const at = new Date('2026-11-01T04:00:00Z');
    const [first, second] = await Promise.all([gateway.markFirstYearCheck(f.familyId, plan.id, at), gateway.markFirstYearCheck(f.familyId, plan.id, at)]);
    expect([first, second].sort()).toEqual([false, true]);
    expect((await gateway.findByYear(f.familyId, 2026))!.firstYearCheckAt).toEqual(at);
  });
});

describe('DrizzleYearPaidGateway', () => {
  it('sums confirmed allocations per line for the plan year, subtracts refunds, ignores pending, deleted, merged and other years', async () => {
    const f = await familyWithPlan(db());
    const plan2026 = await makeEnsureYearPlanUseCase(db()).execute({ familyId: f.familyId, year: 2026 });
    const plan2027 = await makeEnsureYearPlanUseCase(db()).execute({ familyId: f.familyId, year: 2027 });
    const clothing = f.itemId('diwali_dress');
    const keeper = await insertTxn(f.familyId, f.userId, { amount: 400_000, itemId: clothing });
    await insertTxn(f.familyId, f.userId, { amount: 50_000, itemId: clothing, kind: 'refund' });
    await insertTxn(f.familyId, f.userId, { amount: 11_000, itemId: clothing, status: 'pending' });
    await insertTxn(f.familyId, f.userId, { amount: 12_000, itemId: clothing, deleted: true });
    await insertTxn(f.familyId, f.userId, { amount: 13_000, itemId: clothing, mergedInto: keeper });
    await insertTxn(f.familyId, f.userId, { amount: 70_000, itemId: clothing, planYear: 2027 });
    await insertTxn(f.familyId, f.userId, { amount: 20_000, itemId: clothing, planYear: null, date: '2027-01-05' });
    await insertTxn(f.familyId, f.userId, { amount: 150_000, itemId: f.itemId('bike_ins') });

    const other = await familyWithPlan(db());
    await makeEnsureYearPlanUseCase(db()).execute({ familyId: other.familyId, year: 2026 });
    await insertTxn(other.familyId, other.userId, { amount: 99_000, itemId: other.itemId('diwali_dress') });

    const paid = new DrizzleYearPaidGateway(db());
    const lineId = (plan: typeof plan2026, itemId: string) => plan.lines.find((l) => l.itemId === itemId)!.id;
    const in2026 = await paid.paidByLine(f.familyId, 2026);
    expect(Object.fromEntries(in2026)).toEqual({ [lineId(plan2026, clothing)]: 350_000, [lineId(plan2026, f.itemId('bike_ins'))]: 150_000 });
    // planYear null falls back to the year of the date
    expect(Object.fromEntries(await paid.paidByLine(f.familyId, 2027))).toEqual({ [lineId(plan2027, clothing)]: 90_000 });
    expect((await paid.paidByLine(other.familyId, 2027)).size).toBe(0);
  });
});
