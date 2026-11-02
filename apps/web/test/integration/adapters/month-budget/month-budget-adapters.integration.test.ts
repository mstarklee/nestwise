import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DrizzleActualsGateway } from '@/adapters/month-budget/drizzle-actuals-gateway';
import { DrizzleMonthBudgetGateway } from '@/adapters/month-budget/drizzle-month-budget-gateway';
import { makeEnsureMonthBudgetUseCase } from '@/composition/month-budget';
import { useTestDb } from '../../setup';
import { familyWithPlan } from '../../support/family-with-plan';

const db = useTestDb();
const OCT = { year: 2026, month: 10 };
const NOV = { year: 2026, month: 11 };

type Txn = { kind?: 'expense' | 'refund'; status?: 'pending' | 'confirmed'; date?: string; deleted?: boolean; mergedInto?: string; amount: number; itemId: string };

async function insertTxn(familyId: string, userId: string, t: Txn): Promise<string> {
  const id = randomUUID();
  await db().transaction(async (tx) => {
    await tx.execute(sql`insert into app.transactions
        (id, family_id, kind, amount_minor, currency_code, txn_date, entered_by, capture_method, status, entry_tz, deleted_at, merged_into)
      values (${id}, ${familyId}, ${t.kind ?? 'expense'}, ${t.amount}, 'INR', ${t.date ?? '2026-10-07'}, ${userId}, 'typed',
              ${t.status ?? 'confirmed'}, 'Asia/Kolkata', ${t.deleted ? new Date().toISOString() : null}, ${t.mergedInto ?? null})`);
    await tx.execute(sql`insert into app.allocations (id, transaction_id, family_id, item_id, amount_minor)
      values (${randomUUID()}, ${id}, ${familyId}, ${t.itemId}, ${t.amount})`);
  });
  return id;
}

describe('DrizzleActualsGateway', () => {
  it('sums confirmed allocations per item in the month, subtracts refunds, ignores pending, deleted and merged', async () => {
    const f = await familyWithPlan(db());
    const groceries = f.itemId('groceries');
    const keeper = await insertTxn(f.familyId, f.userId, { amount: 100_000, itemId: groceries });
    await insertTxn(f.familyId, f.userId, { amount: 30_000, itemId: groceries, kind: 'refund' });
    await insertTxn(f.familyId, f.userId, { amount: 50_000, itemId: groceries, status: 'pending' });
    await insertTxn(f.familyId, f.userId, { amount: 70_000, itemId: groceries, deleted: true });
    await insertTxn(f.familyId, f.userId, { amount: 40_000, itemId: groceries, mergedInto: keeper });
    await insertTxn(f.familyId, f.userId, { amount: 99_900, itemId: groceries, date: '2026-11-01' });
    await insertTxn(f.familyId, f.userId, { amount: 20_450, itemId: f.itemId('fruits') });

    const other = await familyWithPlan(db());
    await insertTxn(other.familyId, other.userId, { amount: 12_345, itemId: other.itemId('groceries') });

    const actuals = new DrizzleActualsGateway(db());
    const october = await actuals.sumByItem(f.familyId, OCT);
    expect(Object.fromEntries(october)).toEqual({ [groceries]: 70_000, [f.itemId('fruits')]: 20_450 });
    expect((await actuals.sumByItem(f.familyId, NOV)).get(groceries)).toBe(99_900);
    expect(await actuals.hasExpenses(f.familyId, OCT)).toBe(true);
    expect(await actuals.hasExpenses(f.familyId, { year: 2026, month: 9 })).toBe(false);
  });
});

describe('DrizzleMonthBudgetGateway', () => {
  it('two simultaneous ensures for a new month create one budget, and both get it', async () => {
    const f = await familyWithPlan(db());
    const [a, b] = await Promise.all([
      makeEnsureMonthBudgetUseCase(db()).execute({ familyId: f.familyId, period: NOV }),
      makeEnsureMonthBudgetUseCase(db()).execute({ familyId: f.familyId, period: NOV }),
    ]);
    expect(a.id).toBe(b.id);
    const { rows } = await db().execute(sql`select 1 from app.month_budgets where family_id = ${f.familyId}`);
    expect(rows).toHaveLength(1);
    expect(a.lines).toHaveLength(22);
    expect(a.lines.find((l) => l.itemId === f.itemId('gold'))).toMatchObject({ kind: 'savings', plannedMinor: 1_500_000 });
  });

  it('round-trips lines, replaces them, and never returns another family’s month', async () => {
    const f = await familyWithPlan(db());
    const other = await familyWithPlan(db());
    const budget = await makeEnsureMonthBudgetUseCase(db()).execute({ familyId: f.familyId, period: NOV });
    const gateway = new DrizzleMonthBudgetGateway(db());
    const groceries = budget.lines.find((l) => l.itemId === f.itemId('groceries'))!;

    await gateway.saveLine(f.familyId, budget.id, { ...groceries, plannedMinor: 900_000 });
    expect((await gateway.findByPeriod(f.familyId, NOV))!.lines.find((l) => l.itemId === groceries.itemId)!.plannedMinor).toBe(900_000);

    await gateway.replaceLines(f.familyId, budget.id, 'blank', budget.lines.map((l) => ({ ...l, id: randomUUID(), plannedMinor: 0 })));
    const blank = (await gateway.findByPeriod(f.familyId, NOV))!;
    expect(blank.createdFrom).toBe('blank');
    expect(blank.lines.every((l) => l.plannedMinor === 0)).toBe(true);
    expect(blank.lines).toHaveLength(22);

    expect(await gateway.findByPeriod(other.familyId, NOV)).toBeUndefined();
    await gateway.saveLine(other.familyId, budget.id, { ...groceries, id: randomUUID(), plannedMinor: 1 });
    expect((await gateway.findByPeriod(f.familyId, NOV))!.lines.find((l) => l.itemId === groceries.itemId)!.plannedMinor).toBe(0);
  });
});
