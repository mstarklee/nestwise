import { type Actor, assertCan } from '../../shared';
import type { YearPlanGateway } from '../ports';

/**
 * Is setup finished (the first-year check answered, in the year the family started)? Later years have no check. A pure read: it never creates the year plan, so a
 * page loaded in the background during setup cannot freeze an empty plan before the family's plan is imported.
 */
export class GetSetupStatusUseCase {
  constructor(private readonly yearPlans: YearPlanGateway) {}

  async execute(command: { readonly actor: Actor }): Promise<{ firstYearCheckDone: boolean }> {
    assertCan(command.actor, 'read');
    return { firstYearCheckDone: await this.yearPlans.hasFirstYearCheck(command.actor.familyId) };
  }
}
