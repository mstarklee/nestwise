import 'server-only';
import { activity, type DbOrTx, users } from '@nestwise/db';
import type { ActivityReader, ActivityRow } from '@nestwise/domain/activity';
import { and, desc, eq, lt } from 'drizzle-orm';

export class DrizzleActivityReader implements ActivityReader {
  constructor(private readonly db: DbOrTx) {}

  async list(familyId: string, page: { readonly before?: number; readonly limit: number }): Promise<readonly ActivityRow[]> {
    const rows = await this.db
      .select({ row: activity, email: users.email })
      .from(activity)
      .innerJoin(users, eq(users.id, activity.actorId))
      .where(and(eq(activity.familyId, familyId), page.before === undefined ? undefined : lt(activity.id, page.before)))
      .orderBy(desc(activity.id))
      .limit(page.limit);
    return rows.map(({ row, email }) => ({
      id: row.id,
      actorId: row.actorId,
      actorEmail: email,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before,
      after: row.after,
      at: row.at,
      lateEdit: row.lateEdit,
    }));
  }
}
