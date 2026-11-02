import 'server-only';
import type { NotificationGateway, PushPayload, PushSubscription } from '@nestwise/domain/reminders';
import webpush, { WebPushError } from 'web-push';

type Env = Readonly<Record<string, string | undefined>>;

/** Web push with VAPID (TRD §8.3). Without the three VAPID settings nothing can be sent, so it says so. */
export class WebPushNotificationGateway implements NotificationGateway {
  private readonly vapid: { subject: string; publicKey: string; privateKey: string } | null;

  constructor(env: Env = process.env) {
    const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = env;
    this.vapid =
      VAPID_SUBJECT && NEXT_PUBLIC_VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY
        ? { subject: VAPID_SUBJECT, publicKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY }
        : null;
  }

  async send(subscription: PushSubscription, payload: PushPayload): Promise<'ok' | 'gone'> {
    if (!this.vapid) throw new Error('Push is not set up (VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)');
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
        { vapidDetails: this.vapid, TTL: 24 * 60 * 60, timeout: 10_000 },
      );
      return 'ok';
    } catch (error) {
      if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return 'gone';
      throw error;
    }
  }
}
