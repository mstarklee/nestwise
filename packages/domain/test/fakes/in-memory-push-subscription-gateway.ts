import type { PushSubscription, PushSubscriptionGateway } from '../../src/reminders';

export class InMemoryPushSubscriptionGateway implements PushSubscriptionGateway {
  rows: (PushSubscription & { lastOkAt: Date | null })[] = [];

  async listForUser(userId: string) {
    return this.rows.filter((s) => s.userId === userId);
  }
  async save(subscription: PushSubscription) {
    // Like the unique endpoint: a re-subscribe of the same device replaces the old row.
    this.rows = [...this.rows.filter((s) => s.endpoint !== subscription.endpoint), { ...subscription, lastOkAt: null }];
  }
  async remove(subscriptionId: string) {
    this.rows = this.rows.filter((s) => s.id !== subscriptionId);
  }
  async markOk(subscriptionId: string, at: Date) {
    this.rows = this.rows.map((s) => (s.id === subscriptionId ? { ...s, lastOkAt: at } : s));
  }
}
