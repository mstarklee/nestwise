import type { Clock, IdGenerator } from '../../shared';
import { EmailAlreadyRegisteredError } from '../errors';
import { assertPasswordAcceptable, normaliseEmail, safeReturnTo, type SignedIn, type SignUpCommand } from '../models';
import type { AccountEmailGateway, OneTimeTokenGateway, PasswordHasher, SessionGateway, TokenGenerator, UserGateway } from '../ports';
import { OneTimeLinks } from './one-time-links';
import { SessionStarter } from './session-starter';

/** A new email + password account. It starts unverified: a "Verify my email" link is emailed, and the person is signed in. */
export class SignUpUseCase {
  private readonly starter: SessionStarter;
  private readonly links: OneTimeLinks;

  constructor(
    private readonly users: UserGateway,
    sessions: SessionGateway,
    oneTimeTokens: OneTimeTokenGateway,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
    tokens: TokenGenerator,
    private readonly emails: AccountEmailGateway,
    private readonly clock: Clock,
  ) {
    this.starter = new SessionStarter(sessions, tokens, clock);
    this.links = new OneTimeLinks(oneTimeTokens, tokens, clock);
  }

  async execute(command: SignUpCommand): Promise<SignedIn> {
    const email = normaliseEmail(command.email);
    assertPasswordAcceptable(command.password);
    if (await this.users.findByEmail(email)) {
      throw new EmailAlreadyRegisteredError('An account with this email already exists');
    }
    const user = await this.users.save({
      id: this.ids.next(),
      email,
      passwordHash: await this.hasher.hash(command.password),
      emailVerifiedAt: null,
      googleSubject: null,
      createdAt: this.clock.now(),
    });
    const link = (await this.links.issue(user.id, 'verify_email', false))!;
    await this.emails.sendVerifyEmail(user.email, link, safeReturnTo(command.returnTo));
    return this.starter.start(user);
  }
}
