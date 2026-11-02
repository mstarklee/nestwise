import { assertCan, type Clock, daysInMonth } from '../../shared';
import { InvalidYearPlanCommandError, YearLineNotFoundError } from '../errors';
import type { SetYearLineScheduleCommand, YearLine } from '../models';
import type { YearPlanGateway, YearPlanUnitOfWork } from '../ports';

/** Gives a yearly line a due month (and day), or takes it away ("No month yet"). Never changes the template. */
export class SetYearLineScheduleUseCase {
  constructor(
    private readonly uow: YearPlanUnitOfWork,
    private readonly yearPlans: YearPlanGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: SetYearLineScheduleCommand): Promise<YearLine> {
    assertCan(command.actor, 'edit_plan');
    const familyId = command.actor.familyId;
    const line = await this.yearPlans.findLine(familyId, command.yearLineId);
    if (!line) throw new YearLineNotFoundError('That yearly item is not in your plan');
    validate(command, line.dueYear);

    const updated: YearLine = { ...line, dueMonth: command.dueMonth, dueDay: command.dueDay };
    return this.uow.run(async ({ yearPlans, activity }) => {
      await yearPlans.saveLine(updated);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'year_line.schedule',
        entityType: 'year_line',
        entityId: line.id,
        before: { dueMonth: line.dueMonth, dueDay: line.dueDay },
        after: { dueMonth: updated.dueMonth, dueDay: updated.dueDay },
        at: this.clock.now(),
      });
      return updated;
    });
  }
}

function validate(command: SetYearLineScheduleCommand, dueYear: number): void {
  const { dueMonth, dueDay } = command;
  if (dueMonth !== null && !(Number.isInteger(dueMonth) && dueMonth >= 1 && dueMonth <= 12)) {
    throw new InvalidYearPlanCommandError('The due month must be 1–12');
  }
  if (dueDay === null) return;
  if (dueMonth === null) throw new InvalidYearPlanCommandError('A due day needs a due month');
  if (!(Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= daysInMonth(dueYear, dueMonth))) {
    throw new InvalidYearPlanCommandError('That day is not in the due month');
  }
}
