import type { Actor, Clock } from '../../shared';
import type { YearLine } from '../models';
import type { YearPlanUnitOfWork } from '../ports';

/** Internal: saves a new state for a line with its activity row, in one unit of work (not exported). */
export async function saveState(
  uow: YearPlanUnitOfWork,
  clock: Clock,
  actor: Actor,
  line: YearLine,
  state: YearLine['state'],
  action: string,
): Promise<YearLine> {
  const updated: YearLine = { ...line, state };
  return uow.run(async ({ yearPlans, activity }) => {
    await yearPlans.saveLine(updated);
    await activity.record({
      familyId: actor.familyId,
      actorId: actor.userId,
      action,
      entityType: 'year_line',
      entityId: line.id,
      before: { state: line.state },
      after: { state },
      at: clock.now(),
    });
    return updated;
  });
}
