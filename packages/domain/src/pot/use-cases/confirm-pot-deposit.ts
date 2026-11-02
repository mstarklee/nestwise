import type { FamilyGateway } from '../../family';
import { assertCan, type Clock, type IdGenerator } from '../../shared';
import { PotDepositAlreadyExistsError } from '../errors';
import type { ConfirmPotDepositCommand, PotEntry } from '../models';
import type { PotGateway, PotUnitOfWork } from '../ports';
import { assertPeriod, assertPositiveAmount, familyToday } from './pot-rules';

/** "Done" (or "Done — different amount") for the month's pot deposit. Only confirmed money counts (PRD §5.2). */
export class ConfirmPotDepositUseCase {
  constructor(
    private readonly uow: PotUnitOfWork,
    private readonly pot: PotGateway,
    private readonly families: FamilyGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: ConfirmPotDepositCommand): Promise<PotEntry> {
    assertCan(command.actor, 'confirm_checklist');
    assertPositiveAmount(command.amountMinor);
    assertPeriod(command.period);
    const familyId = command.actor.familyId;
    if (await this.pot.findDeposit(familyId, command.period)) {
      throw new PotDepositAlreadyExistsError('This month’s deposit is already confirmed');
    }

    const entry: PotEntry = {
      id: this.ids.next(),
      familyId,
      kind: 'deposit',
      amountMinor: command.amountMinor,
      entryDate: await familyToday(this.families, familyId, this.clock),
      period: command.period,
      note: null,
      createdBy: command.actor.userId,
      createdAt: this.clock.now(),
    };
    return this.uow.run(async ({ pot, activity }) => {
      const saved = await pot.saveEntry(entry);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'pot.deposit',
        entityType: 'pot_entry',
        entityId: saved.id,
        before: null,
        after: { amountMinor: saved.amountMinor, period: saved.period },
        at: entry.createdAt,
      });
      return saved;
    });
  }
}
