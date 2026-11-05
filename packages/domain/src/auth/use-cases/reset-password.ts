import type { Clock } from '../../shared';
import { InvalidAuthLinkError } from '../errors';
import { assertPasswordAcceptable, type ResetPasswordCommand, type SignedIn } from '../models';
import type { OneTimeTokenGateway, PasswordHasher, SessionGateway, TokenGenerator, UserGateway } from '../ports';
import { SessionStarter } from './session-starter';

/**
 * Sets a new password from a reset link (once, within the hour). The link proves the email, so it also verifies it.
 * Every session of the account is signed out, then this browser is signed in.
 */
export class ResetPasswordUseCase {
  private readonly starter: SessionStarter;

  constructor(
    private readonly users: UserGateway,
    private readonly sessions: SessionGateway,
    private readonly links: OneTimeTokenGateway,
    private readonly hasher: PasswordHasher,
    tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {
    this.starter = new SessionStarter(sessions, tokens, clock);
  }

  async execute(command: ResetPasswordCommand): Promise<SignedIn> {
    assertPasswordAcceptable(command.password); // before the link is used up, so a short password can be retried
    const now = this.clock.now();
    const userId = command.token ? await this.links.consume(command.token, 'reset_password', now) : undefined;
    const user = userId ? await this.users.findById(userId) : undefined;
    if (!user) throw new InvalidAuthLinkError('This link is not valid any more');

    const updated = await this.users.update({
      ...user,
      passwordHash: await this.hasher.hash(command.password),
      emailVerifiedAt: user.emailVerifiedAt ?? now,
    });
    await this.links.revokeAll(user.id, 'reset_password');
    await this.sessions.deleteAllForUser(user.id);
    return this.starter.start(updated);
  }
}
