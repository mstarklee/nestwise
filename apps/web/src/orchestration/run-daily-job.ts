import 'server-only';
import type { Db } from '@nestwise/db';
import type { Family } from '@nestwise/domain/family';
import {
  type DailyYearLine,
  type EmailGateway,
  type NotificationGateway,
  PlanDailyNotificationsUseCase,
  type PlannedNotification,
  type PushPayload,
} from '@nestwise/domain/reminders';
import { type Actor, addMonths, type Clock, type Period, periodOf, sumMinor, todayIn } from '@nestwise/domain/shared';
import { remainingMinor } from '@nestwise/domain/year-plan';
import { createTranslator } from 'next-intl';
import messages from '../../messages/en.json';
import { DrizzleUserGateway } from '../adapters/auth/drizzle-user-gateway';
import { DrizzleFamilyGateway } from '../adapters/family/drizzle-family-gateway';
import { DrizzleMembershipGateway } from '../adapters/family/drizzle-membership-gateway';
import { DrizzleMonthBudgetGateway } from '../adapters/month-budget/drizzle-month-budget-gateway';
import { DrizzleNotificationsSentGateway } from '../adapters/reminders/drizzle-notifications-sent-gateway';
import { DrizzlePushSubscriptionGateway } from '../adapters/reminders/drizzle-push-subscription-gateway';
import { DrizzleRedStateGateway } from '../adapters/reminders/drizzle-red-state-gateway';
import { SmtpEmailGateway } from '../adapters/reminders/smtp-email-gateway';
import { WebPushNotificationGateway } from '../adapters/reminders/web-push-notification-gateway';
import { DrizzleYearPaidGateway } from '../adapters/year-plan/drizzle-year-paid-gateway';
import { DrizzleYearPlanGateway } from '../adapters/year-plan/drizzle-year-plan-gateway';
import { formatMoneyRounded, formatPeriod } from '../client/format';
import { getDb } from '../composition/db';
import { makeGetForecastUseCase } from '../composition/forecast';
import { makeAutoCloseMonthUseCase, makeEnsureMonthBudgetUseCase } from '../composition/month-budget';
import { makeGetChecklistUseCase } from '../composition/pot';
import { makeEnsureYearPlanUseCase, makeGetSetupStatusUseCase, makeGetYearEndReviewUseCase } from '../composition/year-plan';

export interface DailyJobDeps {
  readonly db: Db;
  readonly push: NotificationGateway;
  readonly email: EmailGateway;
}

export interface DailyJobReport {
  readonly families: number;
  /** Families whose setup is not finished: nothing is created or sent for them yet. */
  readonly skipped: number;
  readonly failed: number;
  readonly sent: number;
  readonly undelivered: number;
}

const defaultDeps = (): DailyJobDeps => ({ db: getDb(), push: new WebPushNotificationGateway(), email: new SmtpEmailGateway() });

/**
 * The daily job (TRD §8.4), for each family in its own time zone: ensure the month on the 1st, next year's plan on
 * 1 December, decide the day's reminders, skip any already sent to that person, send by push, fall back to email
 * for bills and shortfalls when push reached nobody, and record each send. One family's failure never stops the rest.
 */
export async function runDailyJob(now: Date, deps: DailyJobDeps = defaultDeps()): Promise<DailyJobReport> {
  const { db } = deps;
  const families = await new DrizzleFamilyGateway(db).listAll();
  const report = { families: families.length, skipped: 0, failed: 0, sent: 0, undelivered: 0 };
  for (const family of families) {
    try {
      const outcome = await runForFamily(family, now, deps);
      if (outcome === 'skipped') report.skipped += 1;
      else {
        report.sent += outcome.sent;
        report.undelivered += outcome.undelivered;
      }
    } catch (error) {
      report.failed += 1;
      console.error(`Daily job failed for a family (${family.id})`, error);
    }
  }
  return report;
}

async function runForFamily(family: Family, now: Date, deps: DailyJobDeps): Promise<'skipped' | { sent: number; undelivered: number }> {
  const { db } = deps;
  // The job reads as the system: a read-only actor scoped to this family.
  const actor: Actor = { userId: family.createdBy, familyId: family.id, role: 'viewer' };
  // Before setup is finished the templates may still be empty; creating months from them would freeze them empty.
  if (!(await makeGetSetupStatusUseCase(db).execute({ actor })).firstYearCheckDone) return 'skipped';

  const today = todayIn(family.timeZone, now);
  const current = periodOf(today);
  const day = Number(today.slice(8, 10));
  if (day === 1) await makeEnsureMonthBudgetUseCase(db).execute({ familyId: family.id, period: current });
  if (day === 1 && current.month === 12) await makeEnsureYearPlanUseCase(db).execute({ familyId: family.id, year: current.year + 1 });
  const clock: Clock = { now: () => now };
  await makeAutoCloseMonthUseCase(db, clock).execute({ familyId: family.id, today });

  const redStates = new DrizzleRedStateGateway(db);
  const [forecast, checklist, members, yearLines, lastRedState, lastMonth, lastYear, nextYear] = await Promise.all([
    makeGetForecastUseCase(db, clock).execute({ actor }),
    makeGetChecklistUseCase(db).execute({ actor, period: current }),
    new DrizzleMembershipGateway(db).listActive(family.id),
    yearLinesOf(db, family.id, current),
    redStates.find(family.id),
    new DrizzleMonthBudgetGateway(db).statusOf(family.id, addMonths(current, -1)),
    makeGetYearEndReviewUseCase(db).execute({ actor, year: current.year - 1 }),
    new DrizzleYearPlanGateway(db).findByYear(family.id, current.year + 1),
  ]);
  const plan = new PlanDailyNotificationsUseCase().execute({
    familyId: family.id,
    members,
    today,
    forecast,
    yearLines,
    checklistPending: checklist.pot.status === 'pending' || checklist.savings.some((s) => s.status === 'pending'),
    lastMonthOpen: lastMonth === 'active',
    lastYearOpen: lastYear.lines.length > 0 ? { count: lastYear.lines.length, totalMinor: sumMinor(lastYear.lines.map((l) => l.remainingMinor)) } : null,
    nextYearReady: nextYear !== undefined && nextYear.nextYearReviewedAt === null,
    lastRedState,
  });

  let sent = 0;
  let undelivered = 0;
  for (const notification of plan.notifications) {
    const result = await deliver(notification, family, now, deps);
    if (result === 'sent') sent += 1;
    if (result === 'undelivered') undelivered += 1;
  }
  await redStates.save(family.id, plan.nextRedState);
  return { sent, undelivered };
}

/** This year's and next year's lines, with what is still owed. */
async function yearLinesOf(db: Db, familyId: string, current: Period): Promise<DailyYearLine[]> {
  const plans = new DrizzleYearPlanGateway(db);
  const paid = new DrizzleYearPaidGateway(db);
  const lines: DailyYearLine[] = [];
  for (const year of [current.year, addMonths(current, 12).year]) {
    const plan = await plans.findByYear(familyId, year);
    if (!plan) continue;
    const paidByLine = await paid.paidByLine(familyId, year);
    for (const l of plan.lines) {
      lines.push({ ...l, remainingMinor: remainingMinor(l, paidByLine.get(l.id) ?? 0) });
    }
  }
  return lines;
}

async function deliver(n: PlannedNotification, family: Family, now: Date, deps: DailyJobDeps): Promise<'already' | 'sent' | 'undelivered'> {
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
function render(n: PlannedNotification, family: Family): PushPayload {
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
  if (typeof v.period === 'object') values.month = formatPeriod(v.period, family.numberLocale);
  values.reviewMonth = typeof v.reviewMonth === 'object' ? formatPeriod(v.reviewMonth, family.numberLocale) : 'none';
  if (typeof v.dueDate === 'string') {
    const [y, m, d] = v.dueDate.split('-').map(Number) as [number, number, number];
    values.weekday = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
  }
  return { title: t(`${n.kind}.title`, values), body: t(`${n.kind}.body`, values), url: n.url };
}
