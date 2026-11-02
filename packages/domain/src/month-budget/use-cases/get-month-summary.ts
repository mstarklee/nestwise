import type { PlanGateway } from '../../plan';
import { assertCan, sumMinor } from '../../shared';
import { type GetMonthSummaryCommand, groupFigures, lineFigures, type MonthSummary, type MonthSummaryLine, monthTotals } from '../models';
import type { ActualsGateway } from '../ports';
import type { EnsureMonthBudgetUseCase } from './ensure-month-budget';

/**
 * Planned vs actual for every monthly line, group and the whole month, plus the savings plan.
 * Yearly items are paid from the pot and never count here (PRD test 9). Spending on a monthly item that has no line
 * in this month shows as unplanned (planned 0).
 */
export class GetMonthSummaryUseCase {
  constructor(
    private readonly ensure: EnsureMonthBudgetUseCase,
    private readonly actuals: ActualsGateway,
    private readonly plan: PlanGateway,
  ) {}

  async execute(command: GetMonthSummaryCommand): Promise<MonthSummary> {
    assertCan(command.actor, 'read');
    const familyId = command.actor.familyId;
    const [budget, actual] = await Promise.all([
      this.ensure.execute({ familyId, period: command.period }),
      this.actuals.sumByItem(familyId, command.period),
    ]);

    const monthlyLines = budget.lines.filter((l) => l.kind === 'monthly');
    const lines: MonthSummaryLine[] = monthlyLines.map((l) => ({
      ...lineFigures(l.plannedMinor, actual.get(l.itemId) ?? 0),
      itemId: l.itemId,
      name: l.nameSnapshot,
      groupName: l.groupNameSnapshot,
    }));

    const inBudget = new Set(budget.lines.map((l) => l.itemId));
    const unplannedIds = [...actual.keys()].filter((id) => !inBudget.has(id));
    if (unplannedIds.length > 0) {
      const [items, groups] = await Promise.all([
        this.plan.listItems(familyId, { includeArchived: true }),
        this.plan.listGroups(familyId),
      ]);
      const groupName = new Map(groups.map((g) => [g.id, g.name]));
      for (const item of items) {
        if (item.kind !== 'monthly' || !unplannedIds.includes(item.id)) continue;
        lines.push({ ...lineFigures(0, actual.get(item.id) ?? 0), itemId: item.id, name: item.name, groupName: groupName.get(item.groupId) ?? '' });
      }
    }

    const savingsLines = budget.lines
      .filter((l) => l.kind === 'savings')
      .map((l) => ({ itemId: l.itemId, name: l.nameSnapshot, plannedMinor: l.plannedMinor }));

    return {
      period: budget.period,
      status: budget.status,
      lines,
      groups: [...groupFigures(lines)].map(([groupName, figures]) => ({ groupName, ...figures })),
      totals: monthTotals(lines),
      savings: { lines: savingsLines, plannedMinor: sumMinor(savingsLines.map((l) => l.plannedMinor)) },
    };
  }
}
