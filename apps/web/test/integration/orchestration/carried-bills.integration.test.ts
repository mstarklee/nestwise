import { randomUUID } from 'node:crypto';
import type { EmailGateway, NotificationGateway, PushPayload, PushSubscription } from '@nestwise/domain/reminders';
import { describe, expect, it } from 'vitest';
import { DrizzlePushSubscriptionGateway } from '@/adapters/reminders/drizzle-push-subscription-gateway';
import { makeGetMonthReviewUseCase } from '@/composition/month-review';
import { makeAnswerYearEndLineUseCase, makeApplyFirstYearCheckUseCase, makeEnsureYearPlanUseCase, makeGetYearEndReviewUseCase } from '@/composition/year-plan';
import { runDailyJob } from '@/orchestration/run-daily-job';
import { useTestDb } from '../setup';
import { familyWithPlan } from '../support/family-with-plan';

const db = useTestDb();
// 02:30 on 1 March 2027 in India: the cron's first run of the month.
const MAR_1_2027_MORNING = new Date('2027-02-28T21:00:00Z');

class RecordingPush implements NotificationGateway {
  sent: PushPayload[] = [];
  async send(_subscription: PushSubscription, payload: PushPayload) {
    this.sent.push(payload);
    return 'ok' as const;
  }
}
const noEmail: EmailGateway = { send: async () => true };

/** The 2026 Family Tour, answered "Still to pay" in March 2027 at year-end. */
async function tourCarriedToMarch() {
  const f = await familyWithPlan(db());
  const plan = await makeEnsureYearPlanUseCase(db()).execute({ familyId: f.familyId, year: 2026 });
  const stillToCome = plan.lines.filter((l) => l.itemId === f.itemId('tour')).map((l) => l.id);
  await makeApplyFirstYearCheckUseCase(db()).execute({ actor: f.actor, year: 2026, stillToComeLineIds: stillToCome, setupPeriod: { year: 2026, month: 11 } });
  const review = await makeGetYearEndReviewUseCase().execute({ actor: f.actor, year: 2026 });
  const tour = review.lines.find((l) => l.name === 'Family Tour / Vacation')!;
  await makeAnswerYearEndLineUseCase(db()).execute({ actor: f.actor, year: 2026, lineId: tour.id, answer: { kind: 'carry', dueMonth: 3 } });
  return { ...f, tour };
}

describe('a bill carried into the new year ("Still to pay")', () => {
  it('gets its 1 March reminder like any other bill due in March', async () => {
    const f = await tourCarriedToMarch();
    await new DrizzlePushSubscriptionGateway(db()).save({ id: randomUUID(), userId: f.userId, endpoint: 'https://push.example.com/phone', p256dh: 'BPk', auth: 'aGk', userAgent: 'iPhone' });
    const push = new RecordingPush();
    await runDailyJob(MAR_1_2027_MORNING, { db: db(), push, email: noEmail });
    expect(push.sent.map((p) => p.body).join('\n')).toContain('Family Tour / Vacation');
  });

  it('is in the March 2027 review’s unpaid bills', async () => {
    const f = await tourCarriedToMarch();
    const review = await makeGetMonthReviewUseCase(db()).execute({ actor: f.actor, period: { year: 2027, month: 3 } });
    expect(review.billsUnpaid).toEqual([{ lineId: f.tour.id, name: 'Family Tour / Vacation', remainingMinor: 5_000_000 }]);
  });
});
