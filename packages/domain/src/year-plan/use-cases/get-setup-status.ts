import { assertCan } from '../../shared';
import type { GetYearPlanCommand } from '../models';
import type { YearPlanGateway } from '../ports';

/**
 * Is setup finished for the year (the first-year check answered)? A pure read: it never creates the year plan, so a
 * page loaded in the background during setup cannot freeze an empty plan before the family's plan is imported.
 */
export class GetSetupStatusUseCase {
  constructor(private readonly yearPlans: YearPlanGateway) {}

  async execute(command: GetYearPlanCommand): Promise<{ firstYearCheckDone: boolean }> {
    assertCan(command.actor, 'read');
    const plan = await this.yearPlans.findByYear(command.actor.familyId, command.year);
    return { firstYearCheckDone: Boolean(plan?.firstYearCheckAt) };
  }
}
