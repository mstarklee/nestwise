import type { FamilyGateway } from '../../family';
import { addMonths, assertCan, type Clock, comparePeriods, periodOf, todayIn } from '../../shared';
import { InvalidMonthCommandError, MonthAlreadyClosedError } from '../errors';
import type { MonthBudgetUnitOfWork } from '../ports';
import { AUTO_CLOSE_DAY, type AutoCloseMonthCommand, type CloseMonthCommand } from '../review';

/**
 * "Close October": marks a past month reviewed (PRD §6.12). Closing never blocks writes: later changes to it are
 * accepted and recorded as late.
 */
export class CloseMonthUseCase {
  constructor(
    private readonly uow: MonthBudgetUnitOfWork,
    private readonly families: FamilyGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: CloseMonthCommand): Promise<void> {
    assertCan(command.actor, 'edit_plan');
    const familyId = command.actor.familyId;
    const family = await this.families.findById(familyId);
    if (!family) throw new InvalidMonthCommandError('Your family was not found');
    const now = this.clock.now();
    if (comparePeriods(command.period, periodOf(todayIn(family.timeZone, now))) >= 0) {
      throw new InvalidMonthCommandError('Only a month that has ended can be closed');
    }
    await this.uow.run(async ({ budgets, activity }) => {
      const budget = await budgets.findByPeriod(familyId, command.period);
      if (!budget) throw new InvalidMonthCommandError('That month has no budget');
      if (!(await budgets.close(familyId, budget.id, command.actor.userId, now))) throw new MonthAlreadyClosedError('That month is already closed');
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'month.close',
        entityType: 'month_budget',
        entityId: budget.id,
        before: { status: budget.status },
        after: { status: 'closed' },
        at: now,
      });
    });
  }
}

/** The daily job's part: on or after the 10th, close last month if nobody did (TRD §5.7). True if it closed one. */
export class AutoCloseMonthUseCase {
  constructor(
    private readonly uow: MonthBudgetUnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(command: AutoCloseMonthCommand): Promise<boolean> {
    if (Number(command.today.slice(8, 10)) < AUTO_CLOSE_DAY) return false;
    const previous = addMonths(periodOf(command.today), -1);
    return this.uow.run(async ({ budgets }) => {
      const budget = await budgets.findByPeriod(command.familyId, previous);
      if (!budget || budget.status === 'closed') return false;
      return budgets.close(command.familyId, budget.id, null, this.clock.now());
    });
  }
}
