import { assertCan } from '../../shared';
import { type GetPotBalanceCommand, potBalance } from '../models';
import type { PotGateway } from '../ports';

/** The confirmed pot balance now (TRD §5.4). */
export class GetPotBalanceUseCase {
  constructor(private readonly pot: PotGateway) {}

  async execute(command: GetPotBalanceCommand): Promise<{ balanceMinor: number }> {
    assertCan(command.actor, 'read');
    const familyId = command.actor.familyId;
    const [totals, yearlySpend] = await Promise.all([this.pot.entryTotals(familyId), this.pot.yearlySpendMinor(familyId)]);
    return { balanceMinor: potBalance(totals, yearlySpend) };
  }
}
