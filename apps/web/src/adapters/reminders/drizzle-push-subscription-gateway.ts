import 'server-only';
import { type DbOrTx, pushSubscriptions } from '@nestwise/db';
import type { PushSubscription, PushSubscriptionGateway } from '@nestwise/domain/reminders';
import { asc, eq } from 'drizzle-orm';

export class DrizzlePushSubscriptionGateway implements PushSubscriptionGateway {
  constructor(private readonly db: DbOrTx) {}

  async listForUser(userId: string): Promise<readonly PushSubscription[]> {
    const rows = await this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).orderBy(asc(pushSubscriptions.createdAt));
    return rows.map((r) => ({ id: r.id, userId: r.userId, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth, userAgent: r.userAgent }));
  }

  /** The endpoint is unique: a device that subscribes again (or for another person) replaces its old row. */
  async save(s: PushSubscription): Promise<void> {
    await this.db
      .insert(pushSubscriptions)
      .values({ id: s.id, userId: s.userId, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, userAgent: s.userAgent })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: s.userId, p256dh: s.p256dh, auth: s.auth, userAgent: s.userAgent, failedCount: 0 },
      });
  }

  async remove(subscriptionId: string): Promise<void> {
    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscriptionId));
  }

  async markOk(subscriptionId: string, at: Date): Promise<void> {
    await this.db.update(pushSubscriptions).set({ lastOkAt: at, failedCount: 0 }).where(eq(pushSubscriptions.id, subscriptionId));
  }
}
