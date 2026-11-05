import type { Clock } from '../../shared';
import { normaliseEmail, type RequestPasswordResetCommand } from '../models';
import type { AccountEmailGateway, OneTimeTokenGateway, TokenGenerator, UserGateway } from '../ports';
import { OneTimeLinks } from './one-time-links';

/**
 * "Forgot password": emails a reset link when the email has an account. It answers the same either way, so nobody can
 * use it to find out who has an account. At most one email a minute.
 */
export class RequestPasswordResetUseCase {
  private readonly links: OneTimeLinks;

  constructor(
    private readonly users: UserGateway,
    oneTimeTokens: OneTimeTokenGateway,
    tokens: TokenGenerator,
    private readonly emails: AccountEmailGateway,
    clock: Clock,
  ) {
    this.links = new OneTimeLinks(oneTimeTokens, tokens, clock);
  }

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const email = normaliseEmail(command.email);
    const user = await this.users.findByEmail(email);
    if (!user) return;
    const link = await this.links.issue(user.id, 'reset_password', true);
    if (link) await this.emails.sendPasswordReset(user.email, link);
  }
}
