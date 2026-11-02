import type { Actor } from '../../shared';
import { NotAMemberError } from '../errors';
import type { ResolveActorCommand } from '../models';
import type { MembershipGateway } from '../ports';

/** Session user → Actor { userId, familyId, role }: the one gate in front of all family data. */
export class ResolveActorUseCase {
  constructor(private readonly memberships: MembershipGateway) {}

  async execute(command: ResolveActorCommand): Promise<Actor> {
    const membership = await this.memberships.findActive(command.userId);
    if (!membership) throw new NotAMemberError('You are not a member of a family yet');
    return { userId: command.userId, familyId: membership.familyId, role: membership.role };
  }
}
