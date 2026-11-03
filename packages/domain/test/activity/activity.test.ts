import { describe, expect, it } from 'vitest';
import { type ActivityReader, type ActivityRow, ListActivityUseCase, MAX_ACTIVITY_PAGE } from '../../src/activity';
import { ListLedgerUseCase, type Transaction } from '../../src/expenses';
import type { Actor, IsoDate } from '../../src/shared';
import { InMemoryExpensesUnitOfWork, InMemoryTransactionGateway } from '../fakes/in-memory-expenses-gateways';

const viewer: Actor = { userId: 'u3', familyId: 'f1', role: 'viewer' };
const OCT = { year: 2026, month: 10 };

const row = (id: number, familyId = 'f1'): ActivityRow & { familyId: string } => ({
  id,
  familyId,
  actorId: 'u1',
  actorEmail: 'me@example.com',
  action: 'expense.record',
  entityType: 'transaction',
  entityId: `t${id}`,
  before: null,
  after: null,
  at: new Date(Date.UTC(2026, 9, 1, 0, id)),
  lateEdit: id === 3,
});

class FakeReader implements ActivityReader {
  constructor(private readonly rows: (ActivityRow & { familyId: string })[]) {}
  async list(familyId: string, page: { before?: number; limit: number }) {
    return this.rows
      .filter((r) => r.familyId === familyId && (page.before === undefined || r.id < page.before))
      .sort((a, b) => b.id - a.id)
      .slice(0, page.limit);
  }
}

describe('ListActivityUseCase', () => {
  const reader = new FakeReader([row(1), row(2), row(3), row(4), row(5, 'f2')]);
  const list = new ListActivityUseCase(reader);

  it('lists the family’s rows newest first, a page at a time, with the late mark', async () => {
    const first = await list.execute({ actor: viewer, limit: 2 });
    expect(first.rows.map((r) => r.id)).toEqual([4, 3]);
    expect(first.rows[1]!.lateEdit).toBe(true);
    expect(first.nextBefore).toBe(3);
    const second = await list.execute({ actor: viewer, before: 3, limit: 2 });
    expect(second.rows.map((r) => r.id)).toEqual([2, 1]);
    expect(second.nextBefore).toBe(1);
    expect((await list.execute({ actor: viewer, before: 1, limit: 2 })).nextBefore).toBeNull();
  });

  it(`caps a page at ${MAX_ACTIVITY_PAGE} and refuses a nonsense limit`, async () => {
    expect((await list.execute({ actor: viewer, limit: 500 })).rows.length).toBeLessThanOrEqual(MAX_ACTIVITY_PAGE);
    await expect(list.execute({ actor: viewer, limit: 0 })).rejects.toThrow();
  });
});

describe('ListLedgerUseCase', () => {
  const t = (id: string, overrides: Partial<Transaction>): Transaction => ({
    id,
    familyId: 'f1',
    kind: 'expense',
    amountMinor: 100,
    currencyCode: 'INR',
    txnDate: '2026-10-05' as IsoDate,
    period: OCT,
    merchant: null,
    note: null,
    enteredBy: 'u1',
    paidBy: 'u1',
    captureMethod: 'typed',
    status: 'confirmed',
    mergedInto: null,
    allocations: [{ itemId: 'groceries', amountMinor: 100, planYear: null }],
    entryTimeZone: 'Asia/Kolkata',
    deletedAt: null,
    createdAt: new Date('2026-10-05T06:00:00Z'),
    updatedAt: new Date('2026-10-05T06:00:00Z'),
    ...overrides,
  });

  async function ledger() {
    const transactions = new InMemoryTransactionGateway();
    const uow = new InMemoryExpensesUnitOfWork(transactions);
    for (const x of [
      t('a', {}),
      t('b', { paidBy: 'u2', captureMethod: 'receipt' }),
      t('c', { enteredBy: 'u2', paidBy: 'u2', allocations: [{ itemId: 'fruits', amountMinor: 100, planYear: null }] }),
      t('d', { mergedInto: 'a' }),
      t('e', { status: 'pending' }),
    ]) {
      await transactions.insert(x);
    }
    await uow.evidence.add({ id: 'p1', familyId: 'f1', transactionId: 'a', kind: 'merged_entry', extracted: {}, createdBy: 'u1', createdAt: new Date() });
    return new ListLedgerUseCase(transactions, uow.evidence);
  }

  it('lists confirmed expenses only, never merged or pending ones, each with its proof count', async () => {
    const entries = await (await ledger()).execute({ actor: viewer, period: OCT });
    expect(entries.map((e) => e.transaction.id).sort()).toEqual(['a', 'b', 'c']);
    expect(entries.find((e) => e.transaction.id === 'a')!.proofs).toBe(2);
    expect(entries.find((e) => e.transaction.id === 'b')!.proofs).toBe(1);
  });

  it('combines the month, item, person and method filters', async () => {
    const list = await ledger();
    expect((await list.execute({ actor: viewer, period: OCT, paidBy: 'u2' })).map((e) => e.transaction.id).sort()).toEqual(['b', 'c']);
    expect((await list.execute({ actor: viewer, period: OCT, paidBy: 'u2', captureMethod: 'receipt' })).map((e) => e.transaction.id)).toEqual(['b']);
    expect((await list.execute({ actor: viewer, period: OCT, itemId: 'fruits', enteredBy: 'u2' })).map((e) => e.transaction.id)).toEqual(['c']);
    expect(await list.execute({ actor: viewer, period: { year: 2026, month: 9 } })).toEqual([]);
  });

});
