import 'server-only';
import { allocations, type DbOrTx, transactions, yearLines, yearPlans } from '@nestwise/db';
import type { YearPaidGateway } from '@nestwise/domain/year-plan';
import { and, eq, isNull, sql } from 'drizzle-orm';

export class DrizzleYearPaidGateway implements YearPaidGateway {
  constructor(private readonly db: DbOrTx) {}

  /** A missing plan_year means the year of the transaction date (the default the expense use case sets). */
  async paidByLine(familyId: string, year: number): Promise<ReadonlyMap<string, number>> {
    const rows = await this.db
      .select({
        lineId: yearLines.id,
        total: sql<string>`sum(case when ${transactions.kind} = 'refund' then -${allocations.amountMinor} else ${allocations.amountMinor} end)`,
      })
      .from(yearLines)
      .innerJoin(yearPlans, and(eq(yearPlans.id, yearLines.yearPlanId), eq(yearPlans.year, year)))
      .innerJoin(allocations, and(eq(allocations.itemId, yearLines.itemId), eq(allocations.familyId, familyId)))
      .innerJoin(transactions, eq(transactions.id, allocations.transactionId))
      .where(
        and(
          eq(yearLines.familyId, familyId),
          eq(transactions.familyId, familyId),
          eq(transactions.status, 'confirmed'),
          isNull(transactions.deletedAt),
          isNull(transactions.mergedInto),
          sql`coalesce(${allocations.planYear}, ${transactions.periodYear}) = ${year}`,
        ),
      )
      .groupBy(yearLines.id);
    return new Map(rows.map((r) => [r.lineId, Number(r.total)]));
  }
}
