import type { Clock } from '../../shared';
import { NotSignedInError } from '../errors';
import { isEmailVerified, type ResendVerificationCommand, type ResendVerificationResult, safeReturnTo } from '../models';
import type { AccountEmailGateway, OneTimeTokenGateway, TokenGenerator, UserGateway } from '../ports';
import { OneTimeLinks } from './one-time-links';

/** "Send it again" on the Check your email screen: a fresh link, at most one a minute. */
export class ResendVerificationUseCase {
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

  async execute(command: ResendVerificationCommand): Promise<ResendVerificationResult> {
    const user = await this.users.findById(command.userId);
    if (!user) throw new NotSignedInError('Not signed in');
    if (isEmailVerified(user)) return 'already_verified';
    const link = await this.links.issue(user.id, 'verify_email', true);
    if (!link) return 'too_soon';
    await this.emails.sendVerifyEmail(user.email, link, safeReturnTo(command.returnTo));
    return 'sent';
  }
}
