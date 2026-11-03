import 'server-only';
import type { Db } from '@nestwise/db';
import type { Family } from '@nestwise/domain/family';
import type { EmailGateway, NotificationGateway, PlannedNotification, PushPayload } from '@nestwise/domain/reminders';
import { createTranslator } from 'next-intl';
import messages from '../../messages/en.json';
import { DrizzleUserGateway } from '../adapters/auth/drizzle-user-gateway';
import { DrizzleNotificationsSentGateway } from '../adapters/reminders/drizzle-notifications-sent-gateway';
import { DrizzlePushSubscriptionGateway } from '../adapters/reminders/drizzle-push-subscription-gateway';
import { SmtpEmailGateway } from '../adapters/reminders/smtp-email-gateway';
import { WebPushNotificationGateway } from '../adapters/reminders/web-push-notification-gateway';
import { formatMoneyRounded, formatPeriod } from '../client/format';
import { getDb } from '../composition/db';

export interface DeliveryDeps {
  readonly db: Db;
  readonly push: NotificationGateway;
  readonly email: EmailGateway;
}

export const defaultDeliveryDeps = (): DeliveryDeps => ({ db: getDb(), push: new WebPushNotificationGateway(), email: new SmtpEmailGateway() });

/**
 * Sends one planned notification once: claim its dedupe key, push to every device, email when push reached nobody
 * and the kind allows it, and release the claim when it reached no one (a later run may still reach them).
 */
export async function deliver(n: PlannedNotification, family: Family, now: Date, deps: DeliveryDeps): Promise<'already' | 'sent' | 'undelivered'> {
  const sentLog = new DrizzleNotificationsSentGateway(deps.db);
  if (!(await sentLog.claim(n.userId, n.dedupeKey, now))) return 'already';

  const payload = render(n, family);
  const subscriptions = new DrizzlePushSubscriptionGateway(deps.db);
  let delivered = false;
  for (const subscription of await subscriptions.listForUser(n.userId)) {
    try {
      if ((await deps.push.send(subscription, payload)) === 'gone') {
        await subscriptions.remove(subscription.id);
      } else {
        await subscriptions.markOk(subscription.id, now);
        delivered = true;
      }
    } catch (error) {
      console.error('Push failed', error);
    }
  }
  if (!delivered && n.emailFallback) {
    const user = await new DrizzleUserGateway(deps.db).findById(n.userId);
    const link = process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}${payload.url}` : payload.url;
    if (user) delivered = await deps.email.send(user.email, payload.title, `${payload.body}\n\n${link}`).catch(() => false);
  }
  if (!delivered) await sentLog.release(n.userId, n.dedupeKey); // a later run may still reach them
  return delivered ? 'sent' : 'undelivered';
}

const t = createTranslator({ locale: 'en', messages, namespace: 'notifications' });

/** Words from messages/en.json; amounts rounded to whole units like the Home tiles. */
export function render(n: PlannedNotification, family: Family): PushPayload {
  const money = (minor: unknown) => formatMoneyRounded(Number(minor), family.currencyCode, family.minorUnit, family.numberLocale);
  const v = n.message.values;
  const values: Record<string, string | number> = {};
  if (typeof v.name === 'string') values.name = v.name;
  if (v.amountMinor !== undefined) values.amount = money(v.amountMinor);
  if (v.potMinor !== undefined) values.pot = money(v.potMinor);
  if (v.shortfallMinor !== undefined) values.shortfall = money(v.shortfallMinor);
  if (v.totalMinor !== undefined) values.total = money(v.totalMinor);
  if (typeof v.count === 'number') values.count = v.count;
  if (typeof v.year === 'number') values.year = v.year;
  if (typeof v.threshold === 'number') values.threshold = v.threshold;
  if (v.plannedMinor !== undefined) values.planned = money(v.plannedMinor);
  if (typeof v.period === 'object') values.month = formatPeriod(v.period, family.numberLocale);
  values.reviewMonth = typeof v.reviewMonth === 'object' ? formatPeriod(v.reviewMonth, family.numberLocale) : 'none';
  if (typeof v.dueDate === 'string') {
    const [y, m, d] = v.dueDate.split('-').map(Number) as [number, number, number];
    values.weekday = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
  }
  return { title: t(`${n.kind}.title`, values), body: t(`${n.kind}.body`, values), url: n.url };
}
