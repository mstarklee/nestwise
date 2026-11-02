import { assertCan, type Clock, type IdGenerator } from '../../shared';
import { InvalidPlanCommandError, PlanAlreadyImportedError } from '../errors';
import { checkName, type Group, ITEM_KINDS, type ImportPlanCommand, type Item, type TemplateLine, toTemplateLine } from '../models';
import type { PlanGateway, PlanUnitOfWork } from '../ports';

/** Loads a whole plan (groups, items, template amounts) into a family that has none yet. */
export class ImportPlanUseCase {
  constructor(
    private readonly uow: PlanUnitOfWork,
    private readonly plan: PlanGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: ImportPlanCommand): Promise<{ groups: number; items: number }> {
    assertCan(command.actor, 'edit_plan');
    const familyId = command.actor.familyId;

    // Build and check everything before writing anything.
    const groups: Group[] = [];
    const items: Item[] = [];
    const lines: TemplateLine[] = [];
    const seen = new Set<string>();
    command.plan.groups.forEach((g, groupIndex) => {
      if (!ITEM_KINDS.includes(g.kind)) throw new InvalidPlanCommandError(`Unknown kind: ${String(g.kind)}`);
      const group: Group = { id: this.ids.next(), familyId, kind: g.kind, name: checkName(g.name, 'group'), sort: groupIndex, archived: false };
      groups.push(group);
      g.items.forEach((i, itemIndex) => {
        if (seen.has(i.key)) throw new InvalidPlanCommandError(`Duplicate item key: ${i.key}`);
        seen.add(i.key);
        const item: Item = {
          id: this.ids.next(),
          familyId,
          groupId: group.id,
          kind: g.kind,
          name: checkName(i.name, 'item'),
          sort: itemIndex,
          archived: false,
          seedKey: i.key,
        };
        items.push(item);
        lines.push(toTemplateLine(item.id, g.kind, i));
      });
    });

    if ((await this.plan.listItems(familyId, { includeArchived: true })).length > 0) {
      throw new PlanAlreadyImportedError('This family already has a plan');
    }

    return this.uow.run(async ({ plan, activity }) => {
      for (const group of groups) await plan.saveGroup(group);
      for (const item of items) await plan.saveItem(item);
      for (const line of lines) await plan.saveTemplateLine(familyId, line);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'plan.imported',
        entityType: 'plan',
        entityId: familyId,
        before: null,
        after: { groups: groups.length, items: items.length },
        at: this.clock.now(),
      });
      return { groups: groups.length, items: items.length };
    });
  }
}
