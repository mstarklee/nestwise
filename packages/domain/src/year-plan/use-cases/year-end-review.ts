import { assertCan, assertMinor, type Clock } from '../../shared';
import { InvalidYearPlanCommandError, YearEndAlreadyAnsweredError, YearLineNotFoundError, YearPlanNotFoundError } from '../errors';
import { remainingMinor, type YearLine } from '../models';
import type { YearPaidGateway, YearPlanGateway, YearPlanUnitOfWork } from '../ports';
import type {
  AnswerYearEndLineCommand,
  GetYearEndReviewCommand,
  NextYearReview,
  NextYearReviewCommand,
  SetYearLineAmountCommand,
  YearEndReview,
} from '../year-end';
import type { GetYearPlanUseCase } from './get-year-plan';

/** Last year's lines still open with something left to pay, dated or not (PRD §5.3, TRD §5.7). */
export class GetYearEndReviewUseCase {
  constructor(
    private readonly yearPlans: YearPlanGateway,
    private readonly paid: YearPaidGateway,
  ) {}

  async execute(command: GetYearEndReviewCommand): Promise<YearEndReview> {
    assertCan(command.actor, 'read');
    const familyId = command.actor.familyId;
    const plan = await this.yearPlans.findByYear(familyId, command.year);
    if (!plan) return { year: command.year, lines: [] };
    const paid = await this.paid.paidByLine(familyId, command.year);
    const lines = plan.lines
      // A line already carried into the next year has been answered.
      .filter((l) => l.state === 'open' && l.dueYear === l.year)
      .map((l) => {
        const paidMinor = paid.get(l.id) ?? 0;
        return { id: l.id, name: l.name, plannedMinor: l.plannedMinor, paidMinor, remainingMinor: remainingMinor(l, paidMinor), dueMonth: l.dueMonth };
      })
      .filter((l) => l.remainingMinor > 0);
    return { year: command.year, lines };
  }
}

/** Done, drop, or carry into the next year (with a month or "No month yet"). Admin only; each line answered once. */
export class AnswerYearEndLineUseCase {
  constructor(
    private readonly uow: YearPlanUnitOfWork,
    private readonly yearPlans: YearPlanGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: AnswerYearEndLineCommand): Promise<YearLine> {
    assertCan(command.actor, 'edit_plan');
    const familyId = command.actor.familyId;
    const line = await this.yearPlans.findLine(familyId, command.lineId);
    if (!line || line.year !== command.year) throw new YearLineNotFoundError('That yearly item is not in that year’s plan');
    if (line.state !== 'open' || line.dueYear !== line.year) throw new YearEndAlreadyAnsweredError('That item was already answered');
    const { answer } = command;
    if (answer.kind === 'carry' && answer.dueMonth !== null && !(Number.isInteger(answer.dueMonth) && answer.dueMonth >= 1 && answer.dueMonth <= 12)) {
      throw new InvalidYearPlanCommandError('The due month must be 1–12');
    }
    const updated: YearLine =
      answer.kind === 'done'
        ? { ...line, state: 'done' }
        : answer.kind === 'drop'
          ? { ...line, state: 'cancelled' }
          : // Carried: the line keeps its plan year (so payments with that plan year still count) and is due next year.
            { ...line, dueYear: line.year + 1, dueMonth: answer.dueMonth, dueDay: null };
    return this.uow.run(async ({ yearPlans, activity }) => {
      await yearPlans.saveLine(updated);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: `year_end.${answer.kind}`,
        entityType: 'year_line',
        entityId: line.id,
        before: { state: line.state, dueYear: line.dueYear, dueMonth: line.dueMonth },
        after: { state: updated.state, dueYear: updated.dueYear, dueMonth: updated.dueMonth },
        at: this.clock.now(),
      });
      return updated;
    });
  }
}

/** Next year's bills for the 1 December review, and whether an Admin has confirmed them. */
export class GetNextYearReviewUseCase {
  constructor(
    private readonly yearPlan: GetYearPlanUseCase,
    private readonly yearPlans: YearPlanGateway,
  ) {}

  async execute(command: NextYearReviewCommand): Promise<NextYearReview> {
    const view = await this.yearPlan.execute({ actor: command.actor, year: command.year });
    const plan = await this.yearPlans.findByYear(command.actor.familyId, command.year);
    return { year: command.year, lines: view.lines, confirmed: plan?.nextYearReviewedAt != null };
  }
}

/** "Looks right": the next-year card goes away for the whole family. Confirming again changes nothing. */
export class ConfirmNextYearReviewUseCase {
  constructor(
    private readonly uow: YearPlanUnitOfWork,
    private readonly yearPlans: YearPlanGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: NextYearReviewCommand): Promise<void> {
    assertCan(command.actor, 'edit_plan');
    const familyId = command.actor.familyId;
    const plan = await this.yearPlans.findByYear(familyId, command.year);
    if (!plan) throw new YearPlanNotFoundError(`There is no plan for ${command.year} yet`);
    const at = this.clock.now();
    await this.uow.run(async ({ yearPlans, activity }) => {
      if (!(await yearPlans.markNextYearReviewed(familyId, plan.id, at))) return;
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'year_plan.reviewed',
        entityType: 'year_plan',
        entityId: plan.id,
        before: null,
        after: { reviewedAt: at },
        at,
      });
    });
  }
}

/** Changes one open line's amount in one year's plan; the template and other years stay as they are. */
export class SetYearLineAmountUseCase {
  constructor(
    private readonly uow: YearPlanUnitOfWork,
    private readonly yearPlans: YearPlanGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: SetYearLineAmountCommand): Promise<YearLine> {
    assertCan(command.actor, 'edit_plan');
    try {
      assertMinor(command.plannedMinor);
    } catch {
      throw new InvalidYearPlanCommandError('The amount must be a whole number of paise');
    }
    if (command.plannedMinor < 0) throw new InvalidYearPlanCommandError('The amount cannot be negative');
    const familyId = command.actor.familyId;
    const line = await this.yearPlans.findLine(familyId, command.lineId);
    if (!line) throw new YearLineNotFoundError('That yearly item is not in your plan');
    if (line.state !== 'open') throw new InvalidYearPlanCommandError('Only an open item’s amount can change');
    const updated: YearLine = { ...line, plannedMinor: command.plannedMinor };
    return this.uow.run(async ({ yearPlans, activity }) => {
      await yearPlans.saveLine(updated);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'year_line.amount',
        entityType: 'year_line',
        entityId: line.id,
        before: { plannedMinor: line.plannedMinor },
        after: { plannedMinor: updated.plannedMinor },
        at: this.clock.now(),
      });
      return updated;
    });
  }
}
