import { assertCan, type Clock } from '../../shared';
import { ItemArchivedError, ItemNotFoundError } from '../errors';
import { checkName, type Item, toTemplateLine, type UpdateItemCommand } from '../models';
import type { PlanGateway, PlanUnitOfWork } from '../ports';

/** Renames an item and/or changes its template line. Existing month budgets and year plans are not touched. */
export class UpdateItemUseCase {
  constructor(
    private readonly uow: PlanUnitOfWork,
    private readonly plan: PlanGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: UpdateItemCommand): Promise<Item> {
    assertCan(command.actor, 'edit_plan');
    const familyId = command.actor.familyId;
    const item = await this.plan.findItem(familyId, command.itemId);
    if (!item) throw new ItemNotFoundError('That item does not exist');
    if (item.archived) throw new ItemArchivedError('An archived item cannot be edited');

    const updated: Item = command.name === undefined ? item : { ...item, name: checkName(command.name, 'item') };
    const line = command.template ? toTemplateLine(item.id, item.kind, command.template) : undefined;
    const before = { item, line: await this.plan.findTemplateLine(familyId, item.id) };

    return this.uow.run(async ({ plan, activity }) => {
      await plan.saveItem(updated);
      if (line) await plan.saveTemplateLine(familyId, line);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'item.updated',
        entityType: 'item',
        entityId: item.id,
        before,
        after: { item: updated, line: line ?? before.line },
        at: this.clock.now(),
      });
      return updated;
    });
  }
}
