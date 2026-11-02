import { assertCan, type Clock } from '../../shared';
import { YearLineNotCancellableError, YearLineNotFoundError } from '../errors';
import { isPaid, type YearLine, type YearLineCommand } from '../models';
import type { YearPaidGateway, YearPlanGateway, YearPlanUnitOfWork } from '../ports';
import { saveState } from './year-line-state';

/** "Drop this year": the line leaves the year total and the forecast. A paid line cannot be dropped. */
export class CancelYearLineUseCase {
  constructor(
    private readonly uow: YearPlanUnitOfWork,
    private readonly yearPlans: YearPlanGateway,
    private readonly paid: YearPaidGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: YearLineCommand): Promise<YearLine> {
    assertCan(command.actor, 'edit_plan');
    const familyId = command.actor.familyId;
    const line = await this.yearPlans.findLine(familyId, command.yearLineId);
    if (!line) throw new YearLineNotFoundError('That yearly item is not in your plan');
    if (line.state === 'cancelled') return line;
    const paidMinor = (await this.paid.paidByLine(familyId, line.year)).get(line.id) ?? 0;
    if (isPaid(line, paidMinor)) throw new YearLineNotCancellableError('A paid yearly item cannot be cancelled');
    return saveState(this.uow, this.clock, command.actor, line, 'cancelled', 'year_line.cancel');
  }
}
