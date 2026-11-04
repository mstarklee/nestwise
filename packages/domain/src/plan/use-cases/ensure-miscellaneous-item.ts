import type { Clock, IdGenerator } from '../../shared';
import type { Group, Item } from '../models';
import type { PlanGateway, PlanUnitOfWork } from '../ports';

/** The item's stored name. Stored plan data, not UI copy, so the family can rename it like any other item. */
export const MISCELLANEOUS_NAME = 'Miscellaneous';

/** Marks the one item voice falls back to, so it is found again whatever it has been renamed to. */
export const MISCELLANEOUS_SEED_KEY = 'miscellaneous';

/**
 * Makes sure the family has somewhere to put spending that matches nothing in the plan — a dress bought once, say
 * (design §5). It carries a zero planned amount, so such spending shows honestly as unplanned instead of padding
 * the budget.
 *
 * **No permission check on purpose.** A Member may speak an unmatched expense, and Members do not hold `edit_plan`.
 * It is called only from `capture-voice`, which has already checked `record_expense`. It must never be exposed on a
 * route of its own.
 */
export class EnsureMiscellaneousItemUseCase {
  constructor(
    private readonly uow: PlanUnitOfWork,
    private readonly plan: PlanGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: { readonly familyId: string; readonly actorId: string }): Promise<{ itemId: string }> {
    const { familyId, actorId } = command;
    const existing = (await this.plan.listItems(familyId, { includeArchived: true })).find((i) => i.seedKey === MISCELLANEOUS_SEED_KEY);
    if (existing && !existing.archived) return { itemId: existing.id };

    // Archived by hand at some point: voice still needs it live, and the family must not be left without one.
    if (existing) {
      return this.uow.run(async ({ plan }) => {
        const revived = await plan.saveItem({ ...existing, archived: false });
        return { itemId: revived.id };
      });
    }

    const groups = await this.plan.listGroups(familyId);
    const reused = groups.find((g) => g.kind === 'monthly' && g.name === MISCELLANEOUS_NAME && !g.archived);
    const group: Group = reused ?? {
      id: this.ids.next(),
      familyId,
      kind: 'monthly',
      name: MISCELLANEOUS_NAME,
      sort: groups.reduce((max, g) => Math.max(max, g.sort + 1), 0),
      archived: false,
    };

    const siblings = (await this.plan.listItems(familyId, { includeArchived: true })).filter((i) => i.groupId === group.id);
    const item: Item = {
      id: this.ids.next(),
      familyId,
      groupId: group.id,
      kind: 'monthly',
      name: MISCELLANEOUS_NAME,
      sort: siblings.reduce((max, i) => Math.max(max, i.sort + 1), 0),
      archived: false,
      seedKey: MISCELLANEOUS_SEED_KEY,
    };

    return this.uow.run(async ({ plan, activity }) => {
      if (!reused) await plan.saveGroup(group);
      await plan.saveItem(item);
      const line = await plan.saveTemplateLine(familyId, { itemId: item.id, amountMinor: 0, dueMonth: null, dueDay: null, hintMinMinor: null, hintMaxMinor: null });
      await activity.record({
        familyId,
        actorId,
        action: 'item.added',
        entityType: 'item',
        entityId: item.id,
        before: null,
        after: { item, line },
        at: this.clock.now(),
      });
      return { itemId: item.id };
    });
  }
}
