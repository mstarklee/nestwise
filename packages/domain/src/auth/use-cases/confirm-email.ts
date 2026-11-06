import type { Clock } from '../../shared';
import { InvalidAuthLinkError } from '../errors';
import type { ConfirmEmailCommand } from '../models';
import type { OneTimeTokenGateway, UserGateway } from '../ports';

/** The person opened the "Verify my email" link. Works once, within 24 hours, and only for the newest link. */
export class ConfirmEmailUseCase {
  constructor(
    private readonly users: UserGateway,
    private readonly links: OneTimeTokenGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: ConfirmEmailCommand): Promise<{ readonly email: string }> {
    const now = this.clock.now();
    const userId = command.token ? await this.links.consume(command.token, 'verify_email', now) : undefined;
    const user = userId ? await this.users.findById(userId) : undefined;
    if (!user) throw new InvalidAuthLinkError('This link is not valid any more');
    if (!user.emailVerifiedAt) await this.users.update({ ...user, emailVerifiedAt: now });
    return { email: user.email };
  }
}
