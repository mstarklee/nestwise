import { randomUUID } from 'node:crypto';
import type { EmailGateway, NotificationGateway, PushPayload, PushSubscription } from '@nestwise/domain/reminders';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { DrizzlePushSubscriptionGateway } from '@/adapters/reminders/drizzle-push-subscription-gateway';
import { makeApplyFirstYearCheckUseCase, makeEnsureYearPlanUseCase } from '@/composition/year-plan';
import { runDailyJob } from '@/orchestration/run-daily-job';
import { useTestDb } from '../setup';
import { familyWithPlan } from '../support/family-with-plan';

const db = useTestDb();
// 02:30 on 1 November 2026 in India: the cron's first run of the month.
const NOV_1_MORNING = new Date('2026-10-31T21:00:00Z');

class RecordingPush implements NotificationGateway {
  sent: { endpoint: string; payload: PushPayload }[] = [];
  constructor(private readonly gone = new Set<string>()) {}
  async send(subscription: PushSubscription, payload: PushPayload) {
    if (this.gone.has(subscription.endpoint)) return 'gone' as const;
    this.sent.push({ endpoint: subscription.endpoint, payload });
    return 'ok' as const;
  }
}

class RecordingEmail implements EmailGateway {
  sent: { to: string; subject: string; text: string }[] = [];
  async send(to: string, subject: string, text: string) {
    this.sent.push({ to, subject, text });
    return true;
  }
}

/** A family whose setup is done at 1 Nov 2026: plan imported, first-year check with bike insurance and Deepavali ticked. */
async function setUpFamily(email?: string) {
  const f = await familyWithPlan(db(), email);
  const plan = await makeEnsureYearPlanUseCase(db()).execute({ familyId: f.familyId, year: 2026 });
  const ticked = plan.lines.filter((l) => l.itemId === f.itemId('bike_ins') || l.itemId === f.itemId('deepavali')).map((l) => l.id);
  await makeApplyFirstYearCheckUseCase(db()).execute({ actor: f.actor, year: 2026, stillToComeLineIds: ticked, setupPeriod: { year: 2026, month: 11 } });
  return f;
}

const subscribe = (userId: string, endpoint: string) =>
  new DrizzlePushSubscriptionGateway(db()).save({ id: randomUUID(), userId, endpoint, p256dh: 'BPk', auth: 'aGk', userAgent: 'iPhone' });

describe('runDailyJob', () => {
  it('on 1 November creates the month budget and sends each reminder once; a second run sends nothing new', async () => {
    const f = await setUpFamily();
    await subscribe(f.userId, 'https://push.example.com/phone');
    const push = new RecordingPush();
    const email = new RecordingEmail();

    const first = await runDailyJob(NOV_1_MORNING, { db: db(), push, email });
    const { rows } = await db().execute(sql`select 1 from app.month_budgets where family_id = ${f.familyId} and year = 2026 and month = 11`);
    expect(rows).toHaveLength(1);
    expect(push.sent.map((s) => s.payload.url).sort()).toEqual(['/home', '/year/2026']);
    const bill = push.sent.find((s) => s.payload.url === '/year/2026')!.payload;
    expect(bill.body).toContain('Bike Insurance');
    expect(bill.body).toContain('₹1,500');
    expect(email.sent).toEqual([]);
    expect(first).toMatchObject({ families: 1, sent: 2 });

    const second = await runDailyJob(NOV_1_MORNING, { db: db(), push, email });
    expect(push.sent).toHaveLength(2);
    expect(second).toMatchObject({ sent: 0 });
    const sent = await db().execute(sql`select dedupe_key from app.notifications_sent where user_id = ${f.userId} order by dedupe_key`);
    expect(sent.rows.map((r) => (r as { dedupe_key: string }).dedupe_key)).toEqual([expect.stringMatching(/^bill:.*:bill_due_month:2026-11$/), 'checklist:2026-11']);
  });

  it('a 410 from the push service deletes that subscription; bills then go by email, the checklist does not', async () => {
    const f = await setUpFamily(`${randomUUID()}@example.com`);
    await subscribe(f.userId, 'https://push.example.com/old-phone');
    const push = new RecordingPush(new Set(['https://push.example.com/old-phone']));
    const email = new RecordingEmail();

    await runDailyJob(NOV_1_MORNING, { db: db(), push, email });
    expect(await new DrizzlePushSubscriptionGateway(db()).listForUser(f.userId)).toEqual([]);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]!.text).toContain('Bike Insurance');
    // The checklist was not delivered anywhere, so it is not marked sent.
    const sent = await db().execute(sql`select dedupe_key from app.notifications_sent where user_id = ${f.userId}`);
    expect(sent.rows).toHaveLength(1);
  });

  it('skips a family whose setup is not finished, so nothing is created from an empty template', async () => {
    const f = await familyWithPlan(db());
    const report = await runDailyJob(NOV_1_MORNING, { db: db(), push: new RecordingPush(), email: new RecordingEmail() });
    expect(report).toMatchObject({ families: 1, skipped: 1, sent: 0 });
    const { rows } = await db().execute(sql`select 1 from app.month_budgets where family_id = ${f.familyId}`);
    expect(rows).toHaveLength(0);
  });

  it('on 1 December creates next year’s plan', async () => {
    const f = await setUpFamily();
    await runDailyJob(new Date('2026-11-30T21:00:00Z'), { db: db(), push: new RecordingPush(), email: new RecordingEmail() });
    const { rows } = await db().execute(sql`select 1 from app.year_plans where family_id = ${f.familyId} and year = 2027`);
    expect(rows).toHaveLength(1);
  });
});
