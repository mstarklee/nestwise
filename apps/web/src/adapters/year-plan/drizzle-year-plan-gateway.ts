import 'server-only';
import { type DbOrTx, groups, items, yearLines, yearPlans } from '@nestwise/db';
import type { YearLine, YearPlan, YearPlanGateway } from '@nestwise/domain/year-plan';
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { isUniqueViolation } from '../shared/postgres-errors';

type LineRow = typeof yearLines.$inferSelect;

const toYearLine = (row: LineRow, year: number): YearLine => ({
  id: row.id,
  familyId: row.familyId,
  year,
  itemId: row.itemId,
  name: row.nameSnapshot,
  plannedMinor: row.plannedMinor,
  dueYear: row.dueYear,
  dueMonth: row.dueMonth,
  dueDay: row.dueDay,
  state: row.state,
});

export class DrizzleYearPlanGateway implements YearPlanGateway {
  constructor(private readonly db: DbOrTx) {}

  async findByYear(familyId: string, year: number): Promise<YearPlan | undefined> {
    const [plan] = await this.db
      .select()
      .from(yearPlans)
      .where(and(eq(yearPlans.familyId, familyId), eq(yearPlans.year, year)))
      .limit(1);
    if (!plan) return undefined;

    // Lines follow the template order.
    const rows = await this.db
      .select({ line: yearLines })
      .from(yearLines)
      .innerJoin(items, eq(items.id, yearLines.itemId))
      .innerJoin(groups, eq(groups.id, items.groupId))
      .where(and(eq(yearLines.yearPlanId, plan.id), eq(yearLines.familyId, familyId)))
      .orderBy(asc(groups.sort), asc(items.sort));

    return {
      id: plan.id,
      familyId: plan.familyId,
      year: plan.year,
      firstYearCheckAt: plan.firstYearCheckAt,
      nextYearReviewedAt: plan.nextYearReviewedAt,
      lines: rows.map(({ line }) => toYearLine(line, plan.year)),
    };
  }

  async create(plan: YearPlan): Promise<YearPlan> {
    try {
      await this.db.transaction(async (tx) => {
        await tx
          .insert(yearPlans)
          .values({ id: plan.id, familyId: plan.familyId, year: plan.year, firstYearCheckAt: plan.firstYearCheckAt, nextYearReviewedAt: plan.nextYearReviewedAt });
        if (plan.lines.length === 0) return;
        await tx.insert(yearLines).values(
          plan.lines.map((l) => ({
            id: l.id,
            yearPlanId: plan.id,
            familyId: plan.familyId,
            itemId: l.itemId,
            nameSnapshot: l.name,
            plannedMinor: l.plannedMinor,
            dueYear: l.dueYear,
            dueMonth: l.dueMonth,
            dueDay: l.dueDay,
            state: l.state,
          })),
        );
      });
      return plan;
    } catch (error) {
      // Another request created this year first (the unique constraint is the real guard): use that one.
      if (isUniqueViolation(error, 'year_plans_family_year_key')) {
        const existing = await this.findByYear(plan.familyId, plan.year);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async findLine(familyId: string, yearLineId: string): Promise<YearLine | undefined> {
    const [row] = await this.db
      .select({ line: yearLines, year: yearPlans.year })
      .from(yearLines)
      .innerJoin(yearPlans, eq(yearPlans.id, yearLines.yearPlanId))
      .where(and(eq(yearLines.id, yearLineId), eq(yearLines.familyId, familyId)))
      .limit(1);
    return row ? toYearLine(row.line, row.year) : undefined;
  }

  async saveLine(line: YearLine): Promise<void> {
    await this.db
      .update(yearLines)
      .set({ plannedMinor: line.plannedMinor, dueYear: line.dueYear, dueMonth: line.dueMonth, dueDay: line.dueDay, state: line.state })
      .where(and(eq(yearLines.id, line.id), eq(yearLines.familyId, line.familyId)));
  }

  async markNextYearReviewed(familyId: string, yearPlanId: string, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(yearPlans)
      .set({ nextYearReviewedAt: at })
      .where(and(eq(yearPlans.id, yearPlanId), eq(yearPlans.familyId, familyId), isNull(yearPlans.nextYearReviewedAt)))
      .returning({ id: yearPlans.id });
    return rows.length === 1;
  }

  async markFirstYearCheck(familyId: string, yearPlanId: string, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(yearPlans)
      .set({ firstYearCheckAt: at })
      .where(and(eq(yearPlans.id, yearPlanId), eq(yearPlans.familyId, familyId), isNull(yearPlans.firstYearCheckAt)))
      .returning({ id: yearPlans.id });
    return rows.length === 1;
  }

  async hasFirstYearCheck(familyId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: yearPlans.id })
      .from(yearPlans)
      .where(and(eq(yearPlans.familyId, familyId), isNotNull(yearPlans.firstYearCheckAt)))
      .limit(1);
    return rows.length === 1;
  }
}
