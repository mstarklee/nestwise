import 'server-only';
import { type DbOrTx, notificationsSent } from '@nestwise/db';
import type { NotificationsSentGateway } from '@nestwise/domain/reminders';
import { and, eq } from 'drizzle-orm';

/** The (user_id, dedupe_key) primary key guarantees "sent once", even when two runs overlap. */
export class DrizzleNotificationsSentGateway implements NotificationsSentGateway {
  constructor(private readonly db: DbOrTx) {}

  async claim(userId: string, dedupeKey: string, at: Date): Promise<boolean> {
    const rows = await this.db
      .insert(notificationsSent)
      .values({ userId, dedupeKey, sentAt: at })
      .onConflictDoNothing()
      .returning({ userId: notificationsSent.userId });
    return rows.length === 1;
  }

  async release(userId: string, dedupeKey: string): Promise<void> {
    await this.db.delete(notificationsSent).where(and(eq(notificationsSent.userId, userId), eq(notificationsSent.dedupeKey, dedupeKey)));
  }
}
