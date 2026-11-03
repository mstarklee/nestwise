import type { ListInboxUseCase } from '../../duplicates';
import type { TransactionGateway } from '../../expenses';
import type { FamilyGateway } from '../../family';
import type { PlanGateway } from '../../plan';
import type { GetChecklistUseCase } from '../../pot';
import { addMonths, assertCan, type Period, samePeriod } from '../../shared';
import { type GetYearPlanUseCase, YearPlanNotFoundError } from '../../year-plan';
import type { MonthBudgetGateway } from '../ports';
import { type ChecklistAnswer, type GetMonthReviewCommand, type MonthReview, overStreaks, REVIEW_TOP, STREAK_MONTHS } from '../review';
import type { GetMonthSummaryUseCase } from './get-month-summary';

/** One screen for the month just ended (PRD §6.12): over and under, bills, savings, the Inbox, and repeat overs. */
export class GetMonthReviewUseCase {
  constructor(
    private readonly summary: GetMonthSummaryUseCase,
    private readonly budgets: MonthBudgetGateway,
    private readonly transactions: TransactionGateway,
    private readonly plan: PlanGateway,
    private readonly yearPlan: GetYearPlanUseCase,
    private readonly checklist: GetChecklistUseCase,
    private readonly inbox: ListInboxUseCase,
    private readonly families: FamilyGateway,
  ) {}

  async execute(command: GetMonthReviewCommand): Promise<MonthReview> {
    assertCan(command.actor, 'read');
    const { actor, period } = command;
    const familyId = actor.familyId;
    const [month, checklist, inbox, family, items, spending] = await Promise.all([
      this.summary.execute({ actor, period }),
      this.checklist.execute({ actor, period }),
      this.inbox.execute({ actor }),
      this.families.findById(familyId),
      this.plan.listItems(familyId, { includeArchived: true }),
      this.transactions.list(familyId, { period }),
    ]);

    const bySize = (a: { varianceMinor: number }, b: { varianceMinor: number }) => Math.abs(b.varianceMinor) - Math.abs(a.varianceMinor);
    const yearly = new Map(items.filter((i) => i.kind === 'yearly').map((i) => [i.id, i.name]));
    const paid = new Map<string, number>();
    for (const t of spending) {
      if (t.status !== 'confirmed') continue;
      for (const a of t.allocations) {
        if (yearly.has(a.itemId)) paid.set(a.itemId, (paid.get(a.itemId) ?? 0) + (t.kind === 'refund' ? -a.amountMinor : a.amountMinor));
      }
    }

    const answer = (status: 'pending' | 'done' | 'skipped', confirmedMinor: number | null, plannedMinor: number): ChecklistAnswer =>
      status === 'pending' ? 'unanswered' : status === 'skipped' ? 'skipped' : confirmedMinor === plannedMinor ? 'done' : 'different';

    return {
      period,
      status: month.status,
      totals: month.totals,
      over: month.lines.filter((l) => l.varianceMinor > 0).sort(bySize).slice(0, REVIEW_TOP),
      under: month.lines.filter((l) => l.varianceMinor < 0).sort(bySize).slice(0, REVIEW_TOP),
      billsPaid: [...paid].filter(([, minor]) => minor > 0).map(([itemId, paidMinor]) => ({ itemId, name: yearly.get(itemId)!, paidMinor })),
      billsUnpaid: await this.unpaidBills(actor, period),
      potDeposit: answer(checklist.pot.status, checklist.pot.confirmedMinor, checklist.pot.suggestedMinor),
      savings: checklist.savings.map((s) => ({
        itemId: s.itemId,
        name: s.name,
        plannedMinor: s.plannedMinor,
        answer: answer(s.status, s.confirmedMinor, s.plannedMinor),
        amountMinor: s.confirmedMinor,
      })),
      inboxCount: inbox.filter((e) => samePeriod(e.pending.period, period)).length,
      streaks: overStreaks(await this.history(actor, period), STREAK_MONTHS, 100 * 10 ** (family?.minorUnit ?? 2)),
    };
  }

  /** Bills due this month and not fully paid: this year's, and last year's carried into this year ("Still to pay"). */
  private async unpaidBills(actor: GetMonthReviewCommand['actor'], period: Period) {
    const bills = [];
    for (const year of [period.year - 1, period.year]) {
      let view;
      try {
        view = await this.yearPlan.execute({ actor, year });
      } catch (error) {
        if (error instanceof YearPlanNotFoundError) continue;
        throw error;
      }
      bills.push(
        ...view.lines
          .filter((l) => l.state === 'open' && l.dueYear === period.year && l.dueMonth === period.month && l.remainingMinor > 0)
          .map((l) => ({ lineId: l.id, name: l.name, remainingMinor: l.remainingMinor })),
      );
    }
    return bills;
  }

  /** The reviewed month and the ones before it that have a budget (never creating one just to look). */
  private async history(actor: GetMonthReviewCommand['actor'], period: Period) {
    const months = [];
    for (let back = STREAK_MONTHS - 1; back >= 1; back -= 1) {
      const earlier = addMonths(period, -back);
      if (!(await this.budgets.findByPeriod(actor.familyId, earlier))) return [];
      months.push(await this.summary.execute({ actor, period: earlier }));
    }
    months.push(await this.summary.execute({ actor, period }));
    return months;
  }
}
