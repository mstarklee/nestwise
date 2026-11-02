import 'server-only';
import { createHash } from 'node:crypto';
import { type DbOrTx, invites } from '@nestwise/db';
import type { Invite, InviteGateway } from '@nestwise/domain/family';
import { and, eq, isNull } from 'drizzle-orm';

/** Only this hash is stored, so the invites table cannot be used to join a family. */
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

type InviteRow = typeof invites.$inferSelect;

const toInvite = (row: InviteRow): Invite => ({
  id: row.id,
  familyId: row.familyId,
  role: row.role,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
  usedBy: row.usedBy,
  usedAt: row.usedAt,
  cancelledAt: row.cancelledAt,
});

export class DrizzleInviteGateway implements InviteGateway {
  constructor(private readonly db: DbOrTx) {}

  async create(invite: Invite, token: string): Promise<Invite> {
    await this.db.insert(invites).values({ ...invite, tokenHash: hashToken(token) });
    return invite;
  }

  async findByToken(token: string): Promise<Invite | undefined> {
    const [row] = await this.db.select().from(invites).where(eq(invites.tokenHash, hashToken(token))).limit(1);
    return row ? toInvite(row) : undefined;
  }

  async markUsed(inviteId: string, userId: string, at: Date): Promise<boolean> {
    const updated = await this.db
      .update(invites)
      .set({ usedBy: userId, usedAt: at })
      .where(and(eq(invites.id, inviteId), isNull(invites.usedAt)))
      .returning({ id: invites.id });
    return updated.length === 1;
  }
}
