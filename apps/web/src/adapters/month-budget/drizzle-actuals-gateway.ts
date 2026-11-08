import 'server-only';
import { allocations, type DbOrTx, transactions } from '@nestwise/db';
import type { ActualsGateway } from '@nestwise/domain/month-budget';
import { type IsoDate, type Period, toIsoDate } from '@nestwise/domain/shared';
import { and, eq, isNull, max, sql } from 'drizzle-orm';

/** Only confirmed, live (not deleted, not merged) transactions count, in the period decided by txn_date. */
const counted = (familyId: string, period: Period) =>
  and(
    eq(transactions.familyId, familyId),
    eq(transactions.periodYear, period.year),
    eq(transactions.periodMonth, period.month),
    eq(transactions.status, 'confirmed'),
    isNull(transactions.deletedAt),
    isNull(transactions.mergedInto),
  );

export class DrizzleActualsGateway implements ActualsGateway {
  constructor(private readonly db: DbOrTx) {}

  async sumByItem(familyId: string, period: Period): Promise<ReadonlyMap<string, number>> {
    const rows = await this.db
      .select({
        itemId: allocations.itemId,
        total: sql<string>`sum(case when ${transactions.kind} = 'refund' then -${allocations.amountMinor} else ${allocations.amountMinor} end)`,
      })
      .from(allocations)
      .innerJoin(transactions, eq(transactions.id, allocations.transactionId))
      .where(and(eq(allocations.familyId, familyId), counted(familyId, period)))
      .groupBy(allocations.itemId);
    return new Map(rows.map((r) => [r.itemId, Number(r.total)]));
  }

  async lastDateByItem(familyId: string, period: Period): Promise<ReadonlyMap<string, IsoDate>> {
    const rows = await this.db
      .select({ itemId: allocations.itemId, last: max(transactions.txnDate) })
      .from(allocations)
      .innerJoin(transactions, eq(transactions.id, allocations.transactionId))
      .where(and(eq(allocations.familyId, familyId), counted(familyId, period), eq(transactions.kind, 'expense')))
      .groupBy(allocations.itemId);
    return new Map(rows.flatMap((r) => (r.last ? [[r.itemId, toIsoDate(r.last)] as const] : [])));
  }

  async hasExpenses(familyId: string, period: Period): Promise<boolean> {
    const rows = await this.db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(counted(familyId, period), eq(transactions.kind, 'expense')))
      .limit(1);
    return rows.length > 0;
  }
}
