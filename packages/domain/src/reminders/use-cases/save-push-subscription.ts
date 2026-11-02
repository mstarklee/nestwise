import type { IdGenerator } from '../../shared';
import { InvalidPushSubscriptionError } from '../errors';
import type { PushSubscriptionGateway } from '../ports';

export interface SavePushSubscriptionCommand {
  /** The signed-in person; reminders go to people, on each of their devices. */
  readonly userId: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly userAgent: string | null;
}

const HTTPS_URL = /^https:\/\/[^\s/?#]+(\/\S*)?$/;

/** "Turn on reminders": keeps this device's push subscription so the daily job can reach it. */
export class SavePushSubscriptionUseCase {
  constructor(
    private readonly subscriptions: PushSubscriptionGateway,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: SavePushSubscriptionCommand): Promise<void> {
    if (!HTTPS_URL.test(command.endpoint) || command.endpoint.length > 2000) {
      throw new InvalidPushSubscriptionError('The push endpoint must be an https address');
    }
    if (!command.p256dh.trim() || !command.auth.trim()) throw new InvalidPushSubscriptionError('The push keys are missing');
    await this.subscriptions.save({
      id: this.ids.next(),
      userId: command.userId,
      endpoint: command.endpoint,
      p256dh: command.p256dh.trim(),
      auth: command.auth.trim(),
      userAgent: command.userAgent?.slice(0, 300) ?? null,
    });
  }
}
