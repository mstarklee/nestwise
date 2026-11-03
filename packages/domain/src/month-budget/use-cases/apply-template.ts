import type { FamilyGateway } from '../../family';
import type { PlanGateway } from '../../plan';
import { type Actor, assertCan, type Clock, type IdGenerator, type Period, periodOf, samePeriod, todayIn } from '../../shared';
import { InvalidMonthCommandError, MonthItemNotFoundError } from '../errors';
import type { MonthBudgetGateway, MonthBudgetUnitOfWork } from '../ports';
import { monthLineFor } from './month-item-lookup';

async function currentPeriod(families: FamilyGateway, familyId: string, clock: Clock): Promise<Period> {
  const family = await families.findById(familyId);
  if (!family) throw new InvalidMonthCommandError('Your family was not found');
  return periodOf(todayIn(family.timeZone, clock.now()));
}

/** Months after this one that already have a budget: the ones a template change may also be applied to (PRD §6.2). */
export class PreviewFutureMonthsUseCase {
  constructor(
    private readonly budgets: MonthBudgetGateway,
    private readonly families: FamilyGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: { readonly actor: Actor }): Promise<{ readonly months: readonly Period[] }> {
    assertCan(command.actor, 'read');
    const current = await currentPeriod(this.families, command.actor.familyId, this.clock);
    return { months: await this.budgets.listPeriodsAfter(command.actor.familyId, current) };
  }
}

/**
 * After a template change, sets that item's line in the chosen future months to the template amount (Admin). Only
 * months the preview offers can be chosen; this month, past months and every other month stay as they are.
 */
export class ApplyTemplateToMonthsUseCase {
  constructor(
    private readonly uow: MonthBudgetUnitOfWork,
    private readonly budgets: MonthBudgetGateway,
    private readonly plan: PlanGateway,
    private readonly families: FamilyGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: { readonly actor: Actor; readonly itemId: string; readonly months: readonly Period[] }): Promise<void> {
    assertCan(command.actor, 'edit_plan');
    const familyId = command.actor.familyId;
    const current = await currentPeriod(this.families, familyId, this.clock);
    const offered = await this.budgets.listPeriodsAfter(familyId, current);
    if (command.months.some((m) => !offered.some((o) => samePeriod(o, m)))) {
      throw new InvalidMonthCommandError('Only months after this one that already exist can take a template change');
    }
    const template = await this.plan.findTemplateLine(familyId, command.itemId);
    if (!template) throw new MonthItemNotFoundError('That item is not in the monthly or savings plan');

    await this.uow.run(async ({ budgets, activity }) => {
      for (const period of command.months) {
        const budget = await budgets.findByPeriod(familyId, period);
        if (!budget) continue;
        const existing = budget.lines.find((l) => l.itemId === command.itemId);
        const line = existing
          ? { ...existing, plannedMinor: template.amountMinor }
          : await monthLineFor(this.plan, familyId, command.itemId, this.ids.next(), template.amountMinor);
        await budgets.saveLine(familyId, budget.id, line);
        await activity.record({
          familyId,
          actorId: command.actor.userId,
          action: 'month_line.set',
          entityType: 'month_line',
          entityId: line.id,
          before: existing ?? null,
          after: { ...line, period, fromTemplate: true },
          at: this.clock.now(),
        });
      }
    });
  }
}
