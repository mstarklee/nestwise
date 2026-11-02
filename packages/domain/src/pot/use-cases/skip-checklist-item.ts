import type { PlanGateway } from '../../plan';
import { assertCan, type Clock, type IdGenerator } from '../../shared';
import { ChecklistItemAlreadyDoneError } from '../errors';
import type { ChecklistSkip, SkipChecklistItemCommand } from '../models';
import type { PotGateway, PotUnitOfWork } from '../ports';
import { assertPeriod, assertSavingsItem } from './pot-rules';

/** "Not this month": the checklist stops asking, and the forecast stops expecting that money. */
export class SkipChecklistItemUseCase {
  constructor(
    private readonly uow: PotUnitOfWork,
    private readonly pot: PotGateway,
    private readonly plan: PlanGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: SkipChecklistItemCommand): Promise<ChecklistSkip> {
    assertCan(command.actor, 'confirm_checklist');
    assertPeriod(command.period);
    const familyId = command.actor.familyId;
    if (command.itemId === null) {
      if (await this.pot.findDeposit(familyId, command.period)) throw new ChecklistItemAlreadyDoneError('This month’s deposit is already confirmed');
    } else {
      await assertSavingsItem(this.plan, familyId, command.itemId);
      if (await this.pot.findSavings(familyId, command.itemId, command.period)) {
        throw new ChecklistItemAlreadyDoneError('This savings item is already confirmed for the month');
      }
    }
    const existing = (await this.pot.listSkips(familyId, command.period)).find((s) => s.itemId === command.itemId);
    if (existing) return existing;

    const skip: ChecklistSkip = {
      id: this.ids.next(),
      familyId,
      period: command.period,
      itemId: command.itemId,
      createdBy: command.actor.userId,
      createdAt: this.clock.now(),
    };
    return this.uow.run(async ({ pot, activity }) => {
      const saved = await pot.saveSkip(skip);
      if (saved.id !== skip.id) return saved; // another phone answered first
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'checklist.skip',
        entityType: 'checklist_skip',
        entityId: saved.id,
        before: null,
        after: { itemId: saved.itemId, period: saved.period },
        at: skip.createdAt,
      });
      return saved;
    });
  }
}
