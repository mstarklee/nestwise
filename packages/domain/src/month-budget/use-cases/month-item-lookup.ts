import type { PlanGateway } from '../../plan';
import { MonthItemNotFoundError } from '../errors';
import type { MonthLine } from '../models';

/** Internal: a live monthly or savings item of the family, described as a month line (not exported). */
export async function monthLineFor(plan: PlanGateway, familyId: string, itemId: string, id: string, plannedMinor: number): Promise<MonthLine> {
  const item = await plan.findItem(familyId, itemId);
  if (!item || item.archived || item.kind === 'yearly') throw new MonthItemNotFoundError('That item is not in the monthly or savings plan');
  const group = await plan.findGroup(familyId, item.groupId);
  return { id, itemId, kind: item.kind, nameSnapshot: item.name, groupNameSnapshot: group?.name ?? '', plannedMinor };
}
