import type { PlanGateway } from '../../plan';
import { assertCan, type Clock, type IdGenerator } from '../../shared';
import { InvalidMonthCommandError } from '../errors';
import type { MonthLine, SetMonthLineCommand } from '../models';
import type { MonthBudgetUnitOfWork } from '../ports';
import type { EnsureMonthBudgetUseCase } from './ensure-month-budget';
import { monthLineFor } from './month-item-lookup';

/** Changes one item's plan for one month only (AC-07). */
export class SetMonthLineUseCase {
  constructor(
    private readonly uow: MonthBudgetUnitOfWork,
    private readonly ensure: EnsureMonthBudgetUseCase,
    private readonly plan: PlanGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: SetMonthLineCommand): Promise<MonthLine> {
    assertCan(command.actor, 'edit_month_budget');
    if (!Number.isSafeInteger(command.plannedMinor) || command.plannedMinor < 0) {
      throw new InvalidMonthCommandError('The planned amount must be zero or more, in whole minor units');
    }
    const familyId = command.actor.familyId;
    const budget = await this.ensure.execute({ familyId, period: command.period });
    const existing = budget.lines.find((l) => l.itemId === command.itemId);
    const line: MonthLine = existing
      ? { ...existing, plannedMinor: command.plannedMinor }
      : await monthLineFor(this.plan, familyId, command.itemId, this.ids.next(), command.plannedMinor);

    return this.uow.run(async ({ budgets, activity }) => {
      await budgets.saveLine(familyId, budget.id, line);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'month_line.set',
        entityType: 'month_line',
        entityId: line.id,
        before: existing ?? null,
        after: { ...line, period: command.period },
        at: this.clock.now(),
      });
      return line;
    });
  }
}
