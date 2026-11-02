import { assembleTemplates, type PlanGateway } from '../../plan';
import type { IdGenerator } from '../../shared';
import type { EnsureYearPlanCommand, YearPlan } from '../models';
import type { YearPlanGateway } from '../ports';

/**
 * Returns the family's plan for the year, creating it from the yearly template if it does not exist.
 * A system step (no actor): used by the daily job on 1 December, at setup and lazily for the current year.
 */
export class EnsureYearPlanUseCase {
  constructor(
    private readonly yearPlans: YearPlanGateway,
    private readonly plan: PlanGateway,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: EnsureYearPlanCommand): Promise<YearPlan> {
    const existing = await this.yearPlans.findByYear(command.familyId, command.year);
    if (existing) return existing;

    const [groups, items, lines] = await Promise.all([
      this.plan.listGroups(command.familyId),
      this.plan.listItems(command.familyId, { includeArchived: false }),
      this.plan.listTemplateLines(command.familyId),
    ]);
    const { yearly } = assembleTemplates(groups, items, lines);
    return this.yearPlans.create({
      id: this.ids.next(),
      familyId: command.familyId,
      year: command.year,
      firstYearCheckAt: null,
      lines: yearly.map((e) => ({
        id: this.ids.next(),
        familyId: command.familyId,
        year: command.year,
        itemId: e.itemId,
        name: e.name,
        plannedMinor: e.amountMinor,
        dueYear: command.year,
        dueMonth: e.dueMonth,
        dueDay: e.dueDay,
        state: 'open',
      })),
    });
  }
}
