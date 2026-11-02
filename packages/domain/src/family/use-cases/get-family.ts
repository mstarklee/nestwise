import { assertCan } from '../../shared';
import { NotAMemberError } from '../errors';
import type { FamilyView, GetFamilyCommand } from '../models';
import type { FamilyGateway } from '../ports';

/** The family's settings (currency, number style, time zone) and the asker's role, for every screen. */
export class GetFamilyUseCase {
  constructor(private readonly families: FamilyGateway) {}

  async execute(command: GetFamilyCommand): Promise<FamilyView> {
    assertCan(command.actor, 'read');
    const family = await this.families.findById(command.actor.familyId);
    if (!family) throw new NotAMemberError('Your family was not found');
    return { family, role: command.actor.role };
  }
}
