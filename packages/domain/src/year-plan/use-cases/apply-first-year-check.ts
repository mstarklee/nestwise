import { assertCan, type Clock, comparePeriods } from '../../shared';
import { FirstYearCheckDoneError, InvalidYearPlanCommandError } from '../errors';
import type { ApplyFirstYearCheckCommand, YearLine, YearPlan } from '../models';
import type { YearPlanUnitOfWork } from '../ports';
import type { EnsureYearPlanUseCase } from './ensure-year-plan';

/**
 * At setup, partway through a year (PRD §6.1, TRD §5.7): lines due before the setup month, and lines the family
 * did not tick as still to come, become "Before NestWise". Ticked lines stay open. It runs once per year plan.
 */
export class ApplyFirstYearCheckUseCase {
  constructor(
    private readonly uow: YearPlanUnitOfWork,
    private readonly ensure: EnsureYearPlanUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(command: ApplyFirstYearCheckCommand): Promise<YearPlan> {
    assertCan(command.actor, 'edit_plan');
    if (command.setupPeriod.year !== command.year) {
      throw new InvalidYearPlanCommandError('The first-year check is for the year the family starts in');
    }
    const familyId = command.actor.familyId;
    const plan = await this.ensure.execute({ familyId, year: command.year });
    if (plan.firstYearCheckAt) throw new FirstYearCheckDoneError('The first-year check has already been answered');
    const lineIds = new Set(plan.lines.map((l) => l.id));
    if (!command.stillToComeLineIds.every((id) => lineIds.has(id))) {
      throw new InvalidYearPlanCommandError('Every ticked item must be in this year’s plan');
    }

    const ticked = new Set(command.stillToComeLineIds);
    const dueBefore = (l: YearLine) =>
      l.dueMonth !== null && comparePeriods({ year: l.dueYear, month: l.dueMonth }, command.setupPeriod) < 0;
    const lines = plan.lines.map(
      (l): YearLine => (l.state === 'open' && (dueBefore(l) || !ticked.has(l.id)) ? { ...l, state: 'before_nestwise' } : l),
    );
    const changed = lines.filter((l, i) => l.state !== plan.lines[i]?.state);
    const at = this.clock.now();

    return this.uow.run(async ({ yearPlans, activity }) => {
      if (!(await yearPlans.markFirstYearCheck(familyId, plan.id, at))) {
        throw new FirstYearCheckDoneError('The first-year check has already been answered');
      }
      for (const line of changed) await yearPlans.saveLine(line);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'year_plan.first_year_check',
        entityType: 'year_plan',
        entityId: plan.id,
        before: null,
        after: { setupPeriod: command.setupPeriod, stillToCome: [...ticked], beforeNestwise: changed.map((l) => l.id) },
        at,
      });
      return { ...plan, firstYearCheckAt: at, lines };
    });
  }
}
