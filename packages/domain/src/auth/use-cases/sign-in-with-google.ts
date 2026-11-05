import type { Clock, IdGenerator } from '../../shared';
import { GoogleAccountConflictError, GoogleSignInFailedError } from '../errors';
import { normaliseEmail, type SignedIn, type SignInWithGoogleCommand, type User } from '../models';
import type { GoogleIdentityGateway, OneTimeTokenGateway, SessionGateway, TokenGenerator, UserGateway } from '../ports';
import { SessionStarter } from './session-starter';

/**
 * "Continue with Google". The same Google account always finds the same NestWise account. A Google email that
 * matches an existing account joins it; otherwise a new, already verified account is made with no password.
 */
export class SignInWithGoogleUseCase {
  private readonly starter: SessionStarter;

  constructor(
    private readonly users: UserGateway,
    private readonly sessions: SessionGateway,
    private readonly links: OneTimeTokenGateway,
    private readonly google: GoogleIdentityGateway,
    private readonly ids: IdGenerator,
    tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {
    this.starter = new SessionStarter(sessions, tokens, clock);
  }

  async execute(command: SignInWithGoogleCommand): Promise<SignedIn> {
    const identity = await this.google.identityFor(command.code, command.codeVerifier);
    if (!identity.emailVerified) throw new GoogleSignInFailedError('Google has not verified this email');
    const email = normaliseEmail(identity.email);

    const joined = await this.users.findByGoogleSubject(identity.subject);
    if (joined) return this.starter.start(joined);

    const existing = await this.users.findByEmail(email);
    if (existing) return this.starter.start(await this.join(existing, identity.subject));

    const now = this.clock.now();
    const created = await this.users.save({
      id: this.ids.next(),
      email,
      passwordHash: null,
      emailVerifiedAt: now,
      googleSubject: identity.subject,
      createdAt: now,
    });
    return this.starter.start(created);
  }

  /**
   * Joins Google to the account with the same email. An account never verified may have been made by someone else
   * with this email, so its password, sessions and pending links go: only the Google owner keeps a way in.
   */
  private async join(user: User, subject: string): Promise<User> {
    if (user.googleSubject && user.googleSubject !== subject) {
      throw new GoogleAccountConflictError('This email is already joined to another Google account');
    }
    if (user.emailVerifiedAt) return this.users.update({ ...user, googleSubject: subject });

    await this.sessions.deleteAllForUser(user.id);
    await this.links.revokeAll(user.id, 'verify_email');
    await this.links.revokeAll(user.id, 'reset_password');
    return this.users.update({ ...user, googleSubject: subject, passwordHash: null, emailVerifiedAt: this.clock.now() });
  }
}
