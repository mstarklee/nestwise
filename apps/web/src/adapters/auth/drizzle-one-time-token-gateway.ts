import 'server-only';
import { createHash } from 'node:crypto';
import { authTokens, type DbOrTx } from '@nestwise/db';
import type { NewOneTimeToken, OneTimeTokenGateway, OneTimeTokenPurpose } from '@nestwise/domain/auth';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';

/** Only this hash is stored, so a leaked table cannot be used to verify an email or reset a password. */
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class DrizzleOneTimeTokenGateway implements OneTimeTokenGateway {
  constructor(private readonly db: DbOrTx) {}

  async create(token: NewOneTimeToken): Promise<void> {
    await this.db.insert(authTokens).values({
      tokenHash: hashToken(token.token),
      userId: token.userId,
      purpose: token.purpose,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
    });
  }

  /** One UPDATE … RETURNING, so two uses of the same link at the same moment cannot both succeed. */
  async consume(token: string, purpose: OneTimeTokenPurpose, now: Date): Promise<string | undefined> {
    const [row] = await this.db
      .update(authTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(authTokens.tokenHash, hashToken(token)),
          eq(authTokens.purpose, purpose),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, now),
        ),
      )
      .returning({ userId: authTokens.userId });
    return row?.userId;
  }

  async revokeAll(userId: string, purpose: OneTimeTokenPurpose): Promise<void> {
    await this.db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt)));
  }

  async latestCreatedAt(userId: string, purpose: OneTimeTokenPurpose): Promise<Date | undefined> {
    const [row] = await this.db
      .select({ createdAt: authTokens.createdAt })
      .from(authTokens)
      .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose)))
      .orderBy(desc(authTokens.createdAt))
      .limit(1);
    return row?.createdAt;
  }
}
