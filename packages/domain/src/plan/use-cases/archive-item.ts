import { assertCan, type Clock } from '../../shared';
import { ItemNotFoundError } from '../errors';
import type { ArchiveItemCommand, Item } from '../models';
import type { PlanGateway, PlanUnitOfWork } from '../ports';

/** Hides an item from the templates and pickers; its history stays. Archiving twice is harmless. */
export class ArchiveItemUseCase {
  constructor(
    private readonly uow: PlanUnitOfWork,
    private readonly plan: PlanGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: ArchiveItemCommand): Promise<Item> {
    assertCan(command.actor, 'edit_plan');
    const familyId = command.actor.familyId;
    const item = await this.plan.findItem(familyId, command.itemId);
    if (!item) throw new ItemNotFoundError('That item does not exist');
    if (item.archived) return item;

    const archived: Item = { ...item, archived: true };
    return this.uow.run(async ({ plan, activity }) => {
      await plan.saveItem(archived);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'item.archived',
        entityType: 'item',
        entityId: item.id,
        before: item,
        after: archived,
        at: this.clock.now(),
      });
      return archived;
    });
  }
}
