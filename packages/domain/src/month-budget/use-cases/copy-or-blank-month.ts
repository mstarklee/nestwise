import { addMonths, assertCan, type Clock, type IdGenerator } from '../../shared';
import { InvalidMonthCommandError, MonthHasExpensesError } from '../errors';
import type { CopyOrBlankMonthCommand, MonthBudget, MonthLine } from '../models';
import type { ActualsGateway, MonthBudgetGateway, MonthBudgetUnitOfWork } from '../ports';
import type { EnsureMonthBudgetUseCase } from './ensure-month-budget';

/** Before any expense is logged in a month, replace its plan with last month's or with all zeros. */
export class CopyOrBlankMonthUseCase {
  constructor(
    private readonly uow: MonthBudgetUnitOfWork,
    private readonly ensure: EnsureMonthBudgetUseCase,
    private readonly budgets: MonthBudgetGateway,
    private readonly actuals: ActualsGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: CopyOrBlankMonthCommand): Promise<MonthBudget> {
    assertCan(command.actor, 'edit_month_budget');
    const familyId = command.actor.familyId;
    if (await this.actuals.hasExpenses(familyId, command.period)) {
      throw new MonthHasExpensesError('This month already has expenses, so its plan can only be edited line by line');
    }
    const budget = await this.ensure.execute({ familyId, period: command.period });

    let lines: MonthLine[];
    if (command.mode === 'copy_previous') {
      const previous = await this.budgets.findByPeriod(familyId, addMonths(command.period, -1));
      if (!previous) throw new InvalidMonthCommandError('There is no previous month to copy');
      lines = previous.lines.map((l) => ({ ...l, id: this.ids.next() }));
    } else {
      lines = budget.lines.map((l) => ({ ...l, id: this.ids.next(), plannedMinor: 0 }));
    }
    const createdFrom = command.mode === 'copy_previous' ? 'copy' : 'blank';

    return this.uow.run(async ({ budgets, activity }) => {
      await budgets.replaceLines(familyId, budget.id, createdFrom, lines);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: `month.${createdFrom}`,
        entityType: 'month_budget',
        entityId: budget.id,
        before: budget.lines,
        after: lines,
        at: this.clock.now(),
      });
      return { ...budget, createdFrom, lines };
    });
  }
}
