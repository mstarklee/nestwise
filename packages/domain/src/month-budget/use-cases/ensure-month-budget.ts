import { assembleTemplates, type PlanGateway } from '../../plan';
import type { IdGenerator } from '../../shared';
import type { EnsureMonthBudgetCommand, MonthBudget, MonthLine } from '../models';
import type { MonthBudgetGateway } from '../ports';

/**
 * Returns the family's budget for the month, creating it from the monthly and savings templates if it does not exist.
 * A system step (no actor): used by the daily job and lazily by any write into a month.
 */
export class EnsureMonthBudgetUseCase {
  constructor(
    private readonly budgets: MonthBudgetGateway,
    private readonly plan: PlanGateway,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: EnsureMonthBudgetCommand): Promise<MonthBudget> {
    const existing = await this.budgets.findByPeriod(command.familyId, command.period);
    if (existing) return existing;

    const [groups, items, lines] = await Promise.all([
      this.plan.listGroups(command.familyId),
      this.plan.listItems(command.familyId, { includeArchived: false }),
      this.plan.listTemplateLines(command.familyId),
    ]);
    const templates = assembleTemplates(groups, items, lines);
    const toLine = (kind: MonthLine['kind']) => (e: (typeof templates.monthly)[number]): MonthLine => ({
      id: this.ids.next(),
      itemId: e.itemId,
      kind,
      nameSnapshot: e.name,
      groupNameSnapshot: e.groupName,
      plannedMinor: e.amountMinor,
    });

    return this.budgets.create({
      id: this.ids.next(),
      familyId: command.familyId,
      period: command.period,
      status: 'active',
      createdFrom: 'template',
      lines: [...templates.monthly.map(toLine('monthly')), ...templates.savings.map(toLine('savings'))],
    });
  }
}
