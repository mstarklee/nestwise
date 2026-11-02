import 'server-only';
import { type DbOrTx, members } from '@nestwise/db';
import type { Membership, MembershipGateway } from '@nestwise/domain/family';
import type { Role } from '@nestwise/domain/shared';
import { and, eq, isNull } from 'drizzle-orm';

export class DrizzleMembershipGateway implements MembershipGateway {
  constructor(private readonly db: DbOrTx) {}

  async findActive(userId: string): Promise<{ familyId: string; role: Role } | undefined> {
    const [row] = await this.db
      .select({ familyId: members.familyId, role: members.role })
      .from(members)
      .where(and(eq(members.userId, userId), isNull(members.removedAt)))
      .orderBy(members.joinedAt)
      .limit(1);
    return row;
  }

  async save(membership: Membership): Promise<Membership> {
    await this.db.insert(members).values({
      familyId: membership.familyId,
      userId: membership.userId,
      role: membership.role,
      joinedAt: membership.joinedAt,
    });
    return membership;
  }
}
