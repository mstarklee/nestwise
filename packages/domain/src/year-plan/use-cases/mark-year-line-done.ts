import { assertCan, type Clock } from '../../shared';
import { YearLineNotCompletableError, YearLineNotFoundError } from '../errors';
import type { YearLine, YearLineCommand } from '../models';
import type { YearPlanGateway, YearPlanUnitOfWork } from '../ports';
import { saveState } from './year-line-state';

/** "Done": nothing more is owed on the line, whatever was paid; any leftover stays in the pot. */
export class MarkYearLineDoneUseCase {
  constructor(
    private readonly uow: YearPlanUnitOfWork,
    private readonly yearPlans: YearPlanGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: YearLineCommand): Promise<YearLine> {
    assertCan(command.actor, 'edit_plan');
    const line = await this.yearPlans.findLine(command.actor.familyId, command.yearLineId);
    if (!line) throw new YearLineNotFoundError('That yearly item is not in your plan');
    if (line.state === 'done') return line;
    if (line.state !== 'open') throw new YearLineNotCompletableError('Only an open yearly item can be marked done');
    return saveState(this.uow, this.clock, command.actor, line, 'done', 'year_line.done');
  }
}
