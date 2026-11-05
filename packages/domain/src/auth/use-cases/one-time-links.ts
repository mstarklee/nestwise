import type { Clock } from '../../shared';
import { EMAIL_RESEND_SECONDS, oneTimeTokenExpiry, type OneTimeTokenPurpose } from '../models';
import type { OneTimeTokenGateway, TokenGenerator } from '../ports';

/** Internal: makes the single-use token behind an emailed link. Not exported from the feature. */
export class OneTimeLinks {
  constructor(
    private readonly links: OneTimeTokenGateway,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {}

  /**
   * A new token for the user; older unused ones of the same purpose stop working. With `spaced`, gives undefined when
   * one was made less than EMAIL_RESEND_SECONDS ago, so a person (or a script) cannot flood an inbox.
   */
  async issue(userId: string, purpose: OneTimeTokenPurpose, spaced: boolean): Promise<string | undefined> {
    const now = this.clock.now();
    if (spaced) {
      const latest = await this.links.latestCreatedAt(userId, purpose);
      if (latest && now.getTime() - latest.getTime() < EMAIL_RESEND_SECONDS * 1000) return undefined;
    }
    await this.links.revokeAll(userId, purpose);
    const token = this.tokens.next();
    await this.links.create({ token, userId, purpose, createdAt: now, expiresAt: oneTimeTokenExpiry(purpose, now) });
    return token;
  }
}
