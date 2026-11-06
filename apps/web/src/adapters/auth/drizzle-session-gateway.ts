import 'server-only';
import { createHash } from 'node:crypto';
import { type DbOrTx, sessions } from '@nestwise/db';
import type { NewSession, SessionGateway } from '@nestwise/domain/auth';
import { and, eq, gt } from 'drizzle-orm';

/** Only this hash is stored, so a leaked sessions table cannot be used to sign in. */
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class DrizzleSessionGateway implements SessionGateway {
  constructor(private readonly db: DbOrTx) {}

  async create(session: NewSession): Promise<void> {
    await this.db.insert(sessions).values({
      tokenHash: hashToken(session.token),
      userId: session.userId,
      expiresAt: session.expiresAt,
    });
  }

  async findUserId(token: string, now: Date): Promise<string | undefined> {
    const [row] = await this.db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)))
      .limit(1);
    return row?.userId;
  }

  async delete(token: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }
}
