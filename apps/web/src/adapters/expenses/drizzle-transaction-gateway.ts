import 'server-only';
import { randomUUID } from 'node:crypto';
import { allocations, type DbOrTx, transactions } from '@nestwise/db';
import type { Allocation, ExpenseFilter, Transaction, TransactionGateway } from '@nestwise/domain/expenses';
import type { IsoDate } from '@nestwise/domain/shared';
import { and, desc, eq, exists, inArray, isNull, type SQL } from 'drizzle-orm';

type TxnRow = typeof transactions.$inferSelect;

const toTransaction = (row: TxnRow, parts: readonly Allocation[]): Transaction => ({
  id: row.id,
  familyId: row.familyId,
  kind: row.kind,
  amountMinor: row.amountMinor,
  currencyCode: row.currencyCode,
  txnDate: row.txnDate as IsoDate,
  period: { year: Number(row.txnDate.slice(0, 4)), month: Number(row.txnDate.slice(5, 7)) },
  merchant: row.merchant,
  note: row.note,
  enteredBy: row.enteredBy,
  paidBy: row.paidBy,
  // Stage 1a records typed, confirmed entries only.
  captureMethod: 'typed',
  status: 'confirmed',
  allocations: parts,
  entryTimeZone: row.entryTz,
  deletedAt: row.deletedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** Allocation row ids are storage-only (the domain model has none), so the adapter makes them. */
const allocationRows = (t: Transaction) =>
  t.allocations.map((a) => ({ id: randomUUID(), transactionId: t.id, familyId: t.familyId, itemId: a.itemId, planYear: a.planYear, amountMinor: a.amountMinor }));

export class DrizzleTransactionGateway implements TransactionGateway {
  constructor(private readonly db: DbOrTx) {}

  async findById(familyId: string, id: string): Promise<Transaction | undefined> {
    const [row] = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.familyId, familyId)))
      .limit(1);
    if (!row) return undefined;
    return toTransaction(row, (await this.partsOf(familyId, [id])).get(id) ?? []);
  }

  async insert(t: Transaction): Promise<boolean> {
    // A savepoint: the allocation-sum trigger checks the parts at commit, and a resend inserts nothing.
    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(transactions)
        .values({
          id: t.id,
          familyId: t.familyId,
          kind: t.kind,
          amountMinor: t.amountMinor,
          currencyCode: t.currencyCode,
          txnDate: t.txnDate,
          merchant: t.merchant,
          note: t.note,
          enteredBy: t.enteredBy,
          paidBy: t.paidBy,
          captureMethod: t.captureMethod,
          status: t.status,
          deletedAt: t.deletedAt,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          entryTz: t.entryTimeZone,
        })
        .onConflictDoNothing({ target: transactions.id })
        .returning({ id: transactions.id });
      if (inserted.length === 0) return false;
      await tx.insert(allocations).values(allocationRows(t));
      return true;
    });
  }

  async update(t: Transaction): Promise<void> {
    await this.db.transaction(async (tx) => {
      const updated = await tx
        .update(transactions)
        .set({
          amountMinor: t.amountMinor,
          txnDate: t.txnDate,
          merchant: t.merchant,
          note: t.note,
          paidBy: t.paidBy,
          deletedAt: t.deletedAt,
          updatedAt: t.updatedAt,
        })
        .where(and(eq(transactions.id, t.id), eq(transactions.familyId, t.familyId)))
        .returning({ id: transactions.id });
      if (updated.length === 0) return;
      await tx.delete(allocations).where(and(eq(allocations.transactionId, t.id), eq(allocations.familyId, t.familyId)));
      await tx.insert(allocations).values(allocationRows(t));
    });
  }

  async list(familyId: string, filter: ExpenseFilter): Promise<readonly Transaction[]> {
    const where: SQL[] = [
      eq(transactions.familyId, familyId),
      eq(transactions.periodYear, filter.period.year),
      eq(transactions.periodMonth, filter.period.month),
      isNull(transactions.deletedAt),
      isNull(transactions.mergedInto),
    ];
    if (filter.enteredBy) where.push(eq(transactions.enteredBy, filter.enteredBy));
    if (filter.itemId) {
      where.push(
        exists(
          this.db
            .select({ one: allocations.id })
            .from(allocations)
            .where(and(eq(allocations.transactionId, transactions.id), eq(allocations.itemId, filter.itemId))),
        ),
      );
    }
    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(...where))
      .orderBy(desc(transactions.txnDate), desc(transactions.createdAt));
    const parts = await this.partsOf(
      familyId,
      rows.map((r) => r.id),
    );
    return rows.map((r) => toTransaction(r, parts.get(r.id) ?? []));
  }

  private async partsOf(familyId: string, ids: readonly string[]): Promise<ReadonlyMap<string, Allocation[]>> {
    const byTxn = new Map<string, Allocation[]>();
    if (ids.length === 0) return byTxn;
    const rows = await this.db
      .select()
      .from(allocations)
      .where(and(eq(allocations.familyId, familyId), inArray(allocations.transactionId, [...ids])))
      .orderBy(desc(allocations.amountMinor));
    for (const row of rows) {
      const list = byTxn.get(row.transactionId) ?? [];
      list.push({ itemId: row.itemId, amountMinor: row.amountMinor, planYear: row.planYear });
      byTxn.set(row.transactionId, list);
    }
    return byTxn;
  }
}
