import { assertCan, type Clock } from '../../shared';
import { GroupNotFoundError, InvalidPlanCommandError } from '../errors';
import type { Item, ReorderItemsCommand } from '../models';
import type { PlanGateway, PlanUnitOfWork } from '../ports';

export class ReorderItemsUseCase {
  constructor(
    private readonly uow: PlanUnitOfWork,
    private readonly plan: PlanGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: ReorderItemsCommand): Promise<readonly Item[]> {
    assertCan(command.actor, 'edit_plan');
    const familyId = command.actor.familyId;
    const group = await this.plan.findGroup(familyId, command.groupId);
    if (!group) throw new GroupNotFoundError('That group does not exist');

    const live = (await this.plan.listItems(familyId, { includeArchived: false })).filter((i) => i.groupId === group.id);
    const byId = new Map(live.map((i) => [i.id, i]));
    const unique = new Set(command.itemIds);
    if (unique.size !== command.itemIds.length || unique.size !== live.length || command.itemIds.some((id) => !byId.has(id))) {
      throw new InvalidPlanCommandError('The new order must list every item of the group exactly once');
    }
    const reordered = command.itemIds.map((id, sort) => ({ ...byId.get(id)!, sort }));

    return this.uow.run(async ({ plan, activity }) => {
      for (const item of reordered) await plan.saveItem(item);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'items.reordered',
        entityType: 'group',
        entityId: group.id,
        before: live.map((i) => i.id),
        after: command.itemIds,
        at: this.clock.now(),
      });
      return reordered;
    });
  }
}
