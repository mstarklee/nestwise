import type { Clock } from '../../shared';
import { AlreadyInFamilyError, InviteNotFoundError, InviteNotUsableError } from '../errors';
import { type AcceptInviteCommand, inviteUsable, type Membership } from '../models';
import type { FamilyUnitOfWork, InviteGateway, MembershipGateway } from '../ports';

export class AcceptInviteUseCase {
  constructor(
    private readonly uow: FamilyUnitOfWork,
    private readonly invites: InviteGateway,
    private readonly memberships: MembershipGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: AcceptInviteCommand): Promise<Membership> {
    const now = this.clock.now();
    const invite = await this.invites.findByToken(command.token);
    if (!invite) throw new InviteNotFoundError('This invite link is not valid');
    if (!inviteUsable(invite, now)) throw new InviteNotUsableError('This invite has expired, been used or been cancelled');
    if (await this.memberships.findActive(command.userId)) throw new AlreadyInFamilyError('You already belong to a family');

    return this.uow.run(async ({ invites, memberships, activity }) => {
      // The use-once guard that holds when two people open the link at the same moment.
      if (!(await invites.markUsed(invite.id, command.userId, now))) {
        throw new InviteNotUsableError('This invite has already been used');
      }
      const membership: Membership = { familyId: invite.familyId, userId: command.userId, role: invite.role, joinedAt: now };
      await memberships.save(membership);
      await activity.record({
        familyId: invite.familyId,
        actorId: command.userId,
        action: 'member.joined',
        entityType: 'membership',
        entityId: command.userId,
        before: null,
        after: { role: invite.role, inviteId: invite.id },
        at: now,
      });
      return membership;
    });
  }
}
