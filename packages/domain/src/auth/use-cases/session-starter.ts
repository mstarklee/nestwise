import type { Clock } from '../../shared';
import { sessionExpiry, type SignedIn, type User } from '../models';
import type { SessionGateway, TokenGenerator } from '../ports';

/** Internal: shared by sign-up and sign-in. Not exported from the feature. */
export class SessionStarter {
  constructor(
    private readonly sessions: SessionGateway,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {}

  async start(user: User): Promise<SignedIn> {
    const token = this.tokens.next();
    const expiresAt = sessionExpiry(this.clock.now());
    await this.sessions.create({ token, userId: user.id, expiresAt });
    return { user: { id: user.id, email: user.email }, token, expiresAt };
  }
}
