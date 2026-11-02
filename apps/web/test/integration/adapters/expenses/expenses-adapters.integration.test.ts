import { randomUUID } from 'node:crypto';
import type { Transaction } from '@nestwise/domain/expenses';
import type { IsoDate } from '@nestwise/domain/shared';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DrizzleExpensesUnitOfWork } from '@/adapters/expenses/drizzle-expenses-unit-of-work';
import { DrizzleTransactionGateway } from '@/adapters/expenses/drizzle-transaction-gateway';
import { makeRecordExpenseUseCase } from '@/composition/expenses';
import { useTestDb } from '../../setup';
import { familyWithPlan } from '../../support/family-with-plan';

const db = useTestDb();
const OCT = { year: 2026, month: 10 };

const txn = (familyId: string, userId: string, overrides: Partial<Transaction> = {}): Transaction => ({
  id: randomUUID(),
  familyId,
  kind: 'expense',
  amountMinor: 94_500,
  currencyCode: 'INR',
  txnDate: '2026-10-07' as IsoDate,
  period: OCT,
  merchant: 'Local grocery shop',
  note: null,
  enteredBy: userId,
  paidBy: userId,
  captureMethod: 'typed',
  status: 'confirmed',
  allocations: [{ itemId: '', amountMinor: 94_500, planYear: null }],
  entryTimeZone: 'Asia/Kolkata',
  deletedAt: null,
  createdAt: new Date('2026-10-07T05:00:00Z'),
  updatedAt: new Date('2026-10-07T05:00:00Z'),
  ...overrides,
});

describe('DrizzleTransactionGateway', () => {
  it('two concurrent posts with the same id store one row', async () => {
    const f = await familyWithPlan(db());
    const id = randomUUID();
    const command = { actor: f.actor, id, amountMinor: 94_500, txnDate: '2026-10-07' as IsoDate, allocations: [{ itemId: f.itemId('groceries'), amountMinor: 94_500 }] };
    const [a, b] = await Promise.all([makeRecordExpenseUseCase(db()).execute(command), makeRecordExpenseUseCase(db()).execute(command)]);
    expect([a.created, b.created].sort()).toEqual([false, true]);
    expect(a.transaction.id).toBe(b.transaction.id);
    const { rows } = await db().execute(sql`select 1 from app.transactions where id = ${id}`);
    expect(rows).toHaveLength(1);
    const activity = await db().execute(sql`select 1 from app.activity where entity_id = ${id}`);
    expect(activity.rows).toHaveLength(1);
  });

  it('a split satisfies the allocation-sum trigger in one unit of work, and a re-split replaces the parts', async () => {
    const f = await familyWithPlan(db());
    const split = txn(f.familyId, f.userId, {
      allocations: [
        { itemId: f.itemId('groceries'), amountMinor: 80_000, planYear: null },
        { itemId: f.itemId('soaps'), amountMinor: 14_500, planYear: null },
      ],
    });
    const gateway = new DrizzleTransactionGateway(db());
    expect(await new DrizzleExpensesUnitOfWork(db()).run(({ transactions }) => transactions.insert(split))).toBe(true);
    expect(await gateway.insert(split)).toBe(false);
    const stored = (await gateway.findById(f.familyId, split.id))!;
    expect(stored).toMatchObject({ amountMinor: 94_500, period: OCT, txnDate: '2026-10-07', merchant: 'Local grocery shop', entryTimeZone: 'Asia/Kolkata' });
    expect(stored.allocations).toEqual(expect.arrayContaining([...split.allocations]));

    const moved = { ...split, amountMinor: 90_000, txnDate: '2026-11-01' as IsoDate, period: { year: 2026, month: 11 }, allocations: [{ itemId: f.itemId('groceries'), amountMinor: 90_000, planYear: null }] };
    await new DrizzleExpensesUnitOfWork(db()).run(({ transactions }) => transactions.update(moved));
    expect(await gateway.findById(f.familyId, split.id)).toMatchObject({ amountMinor: 90_000, period: { year: 2026, month: 11 }, allocations: moved.allocations });

    // Parts that do not add up are refused by the database at commit.
    await expect(
      new DrizzleExpensesUnitOfWork(db()).run(({ transactions }) => transactions.update({ ...moved, amountMinor: 1 })),
    ).rejects.toThrow();
    expect((await gateway.findById(f.familyId, split.id))!.amountMinor).toBe(90_000);
  });

  it('lists the month’s live transactions newest first, filters by item and person, and never shows another family’s', async () => {
    const f = await familyWithPlan(db());
    const other = await familyWithPlan(db());
    const gateway = new DrizzleTransactionGateway(db());
    const groceries = (overrides: Partial<Transaction>) =>
      txn(f.familyId, f.userId, { allocations: [{ itemId: f.itemId('groceries'), amountMinor: 94_500, planYear: null }], ...overrides });
    const first = groceries({ txnDate: '2026-10-07' as IsoDate });
    const later = groceries({ txnDate: '2026-10-20' as IsoDate });
    const deleted = groceries({ deletedAt: new Date() });
    const fruit = txn(f.familyId, f.userId, { enteredBy: randomUUID(), createdAt: new Date('2026-10-07T09:00:00Z'), allocations: [{ itemId: f.itemId('fruits'), amountMinor: 94_500, planYear: null }] });
    for (const t of [first, later, deleted, fruit]) await gateway.insert(t);
    await gateway.insert(txn(other.familyId, other.userId, { allocations: [{ itemId: other.itemId('groceries'), amountMinor: 94_500, planYear: null }] }));

    // Same date: the one entered later comes first.
    expect((await gateway.list(f.familyId, { period: OCT })).map((t) => t.id)).toEqual([later.id, fruit.id, first.id]);
    expect((await gateway.list(f.familyId, { period: OCT, itemId: f.itemId('fruits') })).map((t) => t.id)).toEqual([fruit.id]);
    expect((await gateway.list(f.familyId, { period: OCT, enteredBy: f.userId })).map((t) => t.id)).toEqual([later.id, first.id]);
    expect(await gateway.findById(other.familyId, first.id)).toBeUndefined();
    expect(await gateway.list(other.familyId, { period: { year: 2026, month: 9 } })).toEqual([]);
    expect((await gateway.findById(f.familyId, deleted.id))!.deletedAt).toBeInstanceOf(Date);
  });
});
