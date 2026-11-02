import { assertCan, type Clock, type IdGenerator, type Role } from '../../shared';
import { InvalidFamilyCommandError } from '../errors';
import { type CreatedInvite, type CreateInviteCommand, INVITE_DAYS, type Invite } from '../models';
import type { InviteGateway } from '../ports';

const ROLES: readonly Role[] = ['admin', 'member', 'viewer'];

export class CreateInviteUseCase {
  constructor(
    private readonly invites: InviteGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateInviteCommand): Promise<CreatedInvite> {
    assertCan(command.actor, 'manage_family');
    if (!ROLES.includes(command.role)) throw new InvalidFamilyCommandError(`Unknown role: ${String(command.role)}`);

    const token = this.ids.next();
    const now = this.clock.now();
    const invite: Invite = {
      id: this.ids.next(),
      familyId: command.actor.familyId,
      role: command.role,
      createdBy: command.actor.userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      usedBy: null,
      usedAt: null,
      cancelledAt: null,
    };
    await this.invites.create(invite, token);
    return { invite, token };
  }
}
