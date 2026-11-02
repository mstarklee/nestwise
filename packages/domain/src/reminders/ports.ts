import type { RedState } from './models';

/** One browser's push subscription (TRD §8.3). */
export interface PushSubscription {
  readonly id: string;
  readonly userId: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly userAgent: string | null;
}

export interface PushPayload {
  readonly title: string;
  readonly body: string;
  readonly url: string;
}

export interface PushSubscriptionGateway {
  listForUser(userId: string): Promise<readonly PushSubscription[]>;
  /** Saves the device's subscription for the user (a re-subscribe of the same endpoint replaces it). */
  save(subscription: PushSubscription): Promise<void>;
  /** The push service said the subscription is gone (404/410). */
  remove(subscriptionId: string): Promise<void>;
  markOk(subscriptionId: string, at: Date): Promise<void>;
}

export interface NotificationGateway {
  /** 'gone' when the push service no longer knows the subscription (404/410); throws on other failures. */
  send(subscription: PushSubscription, payload: PushPayload): Promise<'ok' | 'gone'>;
}

export interface EmailGateway {
  /** False when email is not set up (no SMTP settings), so nothing was sent. */
  send(to: string, subject: string, text: string): Promise<boolean>;
}

export interface NotificationsSentGateway {
  /** Records (user, key) as sent; false if it already was. Claimed before sending, so two runs never both send. */
  claim(userId: string, dedupeKey: string, at: Date): Promise<boolean>;
  /** Gives the claim back when nothing could be delivered, so a later run tries again. */
  release(userId: string, dedupeKey: string): Promise<void>;
}

export interface RedStateGateway {
  find(familyId: string): Promise<RedState | null>;
  save(familyId: string, state: RedState | null): Promise<void>;
}
