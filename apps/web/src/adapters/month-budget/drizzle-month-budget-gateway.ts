import 'server-only';
import { type DbOrTx, groups, items, monthBudgets, monthLines } from '@nestwise/db';
import type { MonthBudget, MonthBudgetGateway, MonthCreatedFrom, MonthLine, MonthStatus, MonthStatusGateway } from '@nestwise/domain/month-budget';
import type { Period } from '@nestwise/domain/shared';
import { and, asc, eq, gt, ne, or } from 'drizzle-orm';
import { isUniqueViolation } from '../shared/postgres-errors';

const lineRow = (familyId: string, budgetId: string, line: MonthLine) => ({
  id: line.id,
  monthBudgetId: budgetId,
  familyId,
  itemId: line.itemId,
  nameSnapshot: line.nameSnapshot,
  groupNameSnapshot: line.groupNameSnapshot,
  plannedMinor: line.plannedMinor,
});

export class DrizzleMonthBudgetGateway implements MonthBudgetGateway, MonthStatusGateway {
  constructor(private readonly db: DbOrTx) {}

  async statusOf(familyId: string, period: Period): Promise<MonthStatus | undefined> {
    const [row] = await this.db
      .select({ status: monthBudgets.status })
      .from(monthBudgets)
      .where(and(eq(monthBudgets.familyId, familyId), eq(monthBudgets.year, period.year), eq(monthBudgets.month, period.month)))
      .limit(1);
    return row?.status;
  }

  async listPeriodsAfter(familyId: string, period: Period): Promise<readonly Period[]> {
    const rows = await this.db
      .select({ year: monthBudgets.year, month: monthBudgets.month })
      .from(monthBudgets)
      .where(
        and(
          eq(monthBudgets.familyId, familyId),
          or(gt(monthBudgets.year, period.year), and(eq(monthBudgets.year, period.year), gt(monthBudgets.month, period.month))),
        ),
      )
      .orderBy(asc(monthBudgets.year), asc(monthBudgets.month));
    return rows;
  }

  async close(familyId: string, budgetId: string, closedBy: string | null, at: Date): Promise<boolean> {
    // Only an open month changes, so two closes at once close it once.
    const closed = await this.db
      .update(monthBudgets)
      .set({ status: 'closed', closedAt: at, closedBy })
      .where(and(eq(monthBudgets.id, budgetId), eq(monthBudgets.familyId, familyId), ne(monthBudgets.status, 'closed')))
      .returning({ id: monthBudgets.id });
    return closed.length > 0;
  }

  async findByPeriod(familyId: string, period: Period): Promise<MonthBudget | undefined> {
    const [budget] = await this.db
      .select()
      .from(monthBudgets)
      .where(and(eq(monthBudgets.familyId, familyId), eq(monthBudgets.year, period.year), eq(monthBudgets.month, period.month)))
      .limit(1);
    if (!budget) return undefined;

    // The item's kind decides monthly vs savings; lines follow the template order.
    const rows = await this.db
      .select({ line: monthLines, kind: items.kind })
      .from(monthLines)
      .innerJoin(items, eq(items.id, monthLines.itemId))
      .innerJoin(groups, eq(groups.id, items.groupId))
      .where(and(eq(monthLines.monthBudgetId, budget.id), eq(monthLines.familyId, familyId)))
      .orderBy(asc(groups.sort), asc(items.sort));

    return {
      id: budget.id,
      familyId: budget.familyId,
      period: { year: budget.year, month: budget.month },
      status: budget.status,
      createdFrom: budget.createdFrom,
      lines: rows.map(({ line, kind }) => ({
        id: line.id,
        itemId: line.itemId,
        kind: kind === 'savings' ? 'savings' : 'monthly',
        nameSnapshot: line.nameSnapshot,
        groupNameSnapshot: line.groupNameSnapshot,
        plannedMinor: line.plannedMinor,
      })),
    };
  }

  async create(budget: MonthBudget): Promise<MonthBudget> {
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(monthBudgets).values({
          id: budget.id,
          familyId: budget.familyId,
          year: budget.period.year,
          month: budget.period.month,
          status: budget.status,
          createdFrom: budget.createdFrom,
        });
        if (budget.lines.length > 0) await tx.insert(monthLines).values(budget.lines.map((l) => lineRow(budget.familyId, budget.id, l)));
      });
      return budget;
    } catch (error) {
      // Another request created this month first (the unique constraint is the real guard): use that one.
      if (isUniqueViolation(error, 'month_budgets_family_period_key')) {
        const existing = await this.findByPeriod(budget.familyId, budget.period);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async saveLine(familyId: string, budgetId: string, line: MonthLine): Promise<void> {
    if (!(await this.belongs(familyId, budgetId))) return;
    await this.db
      .insert(monthLines)
      .values(lineRow(familyId, budgetId, line))
      .onConflictDoUpdate({ target: [monthLines.monthBudgetId, monthLines.itemId], set: { plannedMinor: line.plannedMinor } });
  }

  async replaceLines(familyId: string, budgetId: string, createdFrom: MonthCreatedFrom, lines: readonly MonthLine[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const owned = await tx
        .select({ id: monthBudgets.id })
        .from(monthBudgets)
        .where(and(eq(monthBudgets.id, budgetId), eq(monthBudgets.familyId, familyId)));
      if (owned.length === 0) return;
      await tx.delete(monthLines).where(and(eq(monthLines.monthBudgetId, budgetId), eq(monthLines.familyId, familyId)));
      if (lines.length > 0) await tx.insert(monthLines).values(lines.map((l) => lineRow(familyId, budgetId, l)));
      await tx.update(monthBudgets).set({ createdFrom }).where(eq(monthBudgets.id, budgetId));
    });
  }

  private async belongs(familyId: string, budgetId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: monthBudgets.id })
      .from(monthBudgets)
      .where(and(eq(monthBudgets.id, budgetId), eq(monthBudgets.familyId, familyId)))
      .limit(1);
    return rows.length === 1;
  }
}
