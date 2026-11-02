import type { PlanGateway } from '../../plan';
import { assertCan, type Clock, type IdGenerator } from '../../shared';
import { SavingsAlreadyConfirmedError } from '../errors';
import type { ConfirmSavingsCommand, SavingsEntry } from '../models';
import type { PotGateway, PotUnitOfWork } from '../ports';
import { assertPeriod, assertPositiveAmount, assertSavingsItem } from './pot-rules';

/** "Done" for one savings item in the month's checklist. Savings never count as spending. */
export class ConfirmSavingsUseCase {
  constructor(
    private readonly uow: PotUnitOfWork,
    private readonly pot: PotGateway,
    private readonly plan: PlanGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: ConfirmSavingsCommand): Promise<SavingsEntry> {
    assertCan(command.actor, 'confirm_checklist');
    assertPositiveAmount(command.amountMinor);
    assertPeriod(command.period);
    const familyId = command.actor.familyId;
    await assertSavingsItem(this.plan, familyId, command.itemId);
    if (await this.pot.findSavings(familyId, command.itemId, command.period)) {
      throw new SavingsAlreadyConfirmedError('This savings item is already confirmed for the month');
    }

    const entry: SavingsEntry = {
      id: this.ids.next(),
      familyId,
      itemId: command.itemId,
      period: command.period,
      amountMinor: command.amountMinor,
      createdBy: command.actor.userId,
      createdAt: this.clock.now(),
    };
    return this.uow.run(async ({ pot, activity }) => {
      const saved = await pot.saveSavings(entry);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'savings.confirm',
        entityType: 'savings_entry',
        entityId: saved.id,
        before: null,
        after: { itemId: saved.itemId, amountMinor: saved.amountMinor, period: saved.period },
        at: entry.createdAt,
      });
      return saved;
    });
  }
}
