import { randomUUID } from 'node:crypto';
import type { IsoDate } from '@nestwise/domain/shared';
import { describe, expect, it } from 'vitest';
import { DrizzleDuplicateMatchGateway } from '@/adapters/duplicates/drizzle-duplicate-match-gateway';
import { DrizzleTransactionGateway } from '@/adapters/expenses/drizzle-transaction-gateway';
import { makeRecordExpenseUseCase } from '@/composition/expenses';
import { useTestDb } from '../../setup';
import { familyWithPlan } from '../../support/family-with-plan';

const db = useTestDb();
const day = (value: string) => value as IsoDate;

async function spend(f: Awaited<ReturnType<typeof familyWithPlan>>, txnDate: string, amountMinor = 94_500) {
  const id = randomUUID();
  await makeRecordExpenseUseCase(db()).execute({
    actor: f.actor,
    id,
    amountMinor,
    txnDate: day(txnDate),
    allocations: [{ itemId: f.itemId('groceries'), amountMinor }],
  });
  return id;
}

describe('DrizzleDuplicateMatchGateway', () => {
  it('one question per pair of expenses, whichever way round', async () => {
    const f = await familyWithPlan(db());
    const [a, b] = [await spend(f, '2026-10-07'), await spend(f, '2026-10-20')];
    const gateway = new DrizzleDuplicateMatchGateway(db());
    const match = { familyId: f.familyId, reasons: ['other_person'] as const, status: 'pending' as const, resolvedBy: null, resolvedAt: null, createdAt: new Date() };
    expect(await gateway.create({ ...match, id: randomUUID(), txnA: a, txnB: b })).toBe(true);
    expect(await gateway.create({ ...match, id: randomUUID(), txnA: b, txnB: a })).toBe(false);
    expect(await gateway.listPending(f.familyId)).toHaveLength(1);
    expect(await gateway.clearPendingFor(f.familyId, b)).toHaveLength(1);
    expect(await gateway.listPending(f.familyId)).toEqual([]);
  });
});

describe('DrizzleTransactionGateway.listNear', () => {
  it('finds the same amount within a day in the same family only', async () => {
    const f = await familyWithPlan(db());
    const other = await familyWithPlan(db());
    const near = await spend(f, '2026-10-08');
    await spend(f, '2026-10-10');
    await spend(f, '2026-10-07', 95_000);
    await spend(other, '2026-10-07');
    const found = await new DrizzleTransactionGateway(db()).listNear(f.familyId, day('2026-10-07'), 94_500, 'expense');
    expect(found.map((t) => t.id)).toEqual([near]);
  });
});
