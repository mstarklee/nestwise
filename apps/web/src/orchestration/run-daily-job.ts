import 'server-only';
import type { Db } from '@nestwise/db';
import type { Family } from '@nestwise/domain/family';
import { type DailyYearLine, PlanDailyNotificationsUseCase } from '@nestwise/domain/reminders';
import { type Actor, addMonths, type Clock, type Period, periodOf, sumMinor, todayIn } from '@nestwise/domain/shared';
import { remainingMinor } from '@nestwise/domain/year-plan';
import { DrizzleFamilyGateway } from '../adapters/family/drizzle-family-gateway';
import { DrizzleMembershipGateway } from '../adapters/family/drizzle-membership-gateway';
import { DrizzleMonthBudgetGateway } from '../adapters/month-budget/drizzle-month-budget-gateway';
import { DrizzleRedStateGateway } from '../adapters/reminders/drizzle-red-state-gateway';
import { DrizzleYearPaidGateway } from '../adapters/year-plan/drizzle-year-paid-gateway';
import { DrizzleYearPlanGateway } from '../adapters/year-plan/drizzle-year-plan-gateway';
import { makeGetForecastUseCase } from '../composition/forecast';
import { makeAutoCloseMonthUseCase, makeEnsureMonthBudgetUseCase } from '../composition/month-budget';
import { makeGetChecklistUseCase } from '../composition/pot';
import { makeEnsureYearPlanUseCase, makeGetSetupStatusUseCase, makeGetYearEndReviewUseCase } from '../composition/year-plan';
import { type DeliveryDeps, defaultDeliveryDeps, deliver } from './deliver-notification';

export type DailyJobDeps = DeliveryDeps;

export interface DailyJobReport {
  readonly families: number;
  /** Families whose setup is not finished: nothing is created or sent for them yet. */
  readonly skipped: number;
  readonly failed: number;
  readonly sent: number;
  readonly undelivered: number;
}

const defaultDeps = defaultDeliveryDeps;

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

/** Last year's, this year's and next year's lines, with what is still owed. Last year's lines that were carried ("Still to pay") are due this year, so they get reminders too. */
async function yearLinesOf(db: Db, familyId: string, current: Period): Promise<DailyYearLine[]> {
  const plans = new DrizzleYearPlanGateway(db);
  const paid = new DrizzleYearPaidGateway(db);
  const lines: DailyYearLine[] = [];
  for (const year of [current.year - 1, current.year, addMonths(current, 12).year]) {
    const plan = await plans.findByYear(familyId, year);
    if (!plan) continue;
    const paidByLine = await paid.paidByLine(familyId, year);
    for (const l of plan.lines) {
      lines.push({ ...l, remainingMinor: remainingMinor(l, paidByLine.get(l.id) ?? 0) });
    }
  }
  return lines;
}
