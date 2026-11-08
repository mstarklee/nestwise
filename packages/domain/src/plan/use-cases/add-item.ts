import { assertCan, type Clock, type IdGenerator } from '../../shared';
import { GroupNotFoundError } from '../errors';
import { type AddItemCommand, checkBill, checkName, type Item, toTemplateLine } from '../models';
import type { PlanGateway, PlanUnitOfWork } from '../ports';

export class AddItemUseCase {
  constructor(
    private readonly uow: PlanUnitOfWork,
    private readonly plan: PlanGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: AddItemCommand): Promise<Item> {
    assertCan(command.actor, 'edit_plan');
    const familyId = command.actor.familyId;
    const name = checkName(command.name, 'item');
    const group = await this.plan.findGroup(familyId, command.groupId);
    if (!group || group.archived) throw new GroupNotFoundError('That group does not exist');

    const isBill = checkBill(group.kind, command.isBill);
    const id = this.ids.next();
    const line = toTemplateLine(id, group.kind, command);
    const siblings = (await this.plan.listItems(familyId, { includeArchived: true })).filter((i) => i.groupId === group.id);
    const item: Item = {
      id,
      familyId,
      groupId: group.id,
      kind: group.kind,
      name,
      sort: siblings.reduce((max, i) => Math.max(max, i.sort + 1), 0),
      archived: false,
      seedKey: null,
      isBill,
    };

    return this.uow.run(async ({ plan, activity }) => {
      await plan.saveItem(item);
      await plan.saveTemplateLine(familyId, line);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'item.added',
        entityType: 'item',
        entityId: id,
        before: null,
        after: { item, line },
        at: this.clock.now(),
      });
      return item;
    });
  }
}
