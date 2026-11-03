import { randomUUID } from 'node:crypto';
import type { EmailGateway, NotificationGateway, PushPayload, PushSubscription } from '@nestwise/domain/reminders';
import type { IsoDate } from '@nestwise/domain/shared';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { PATCH as updateFamily } from '../../../app/api/v1/families/current/route';
import { DrizzlePushSubscriptionGateway } from '@/adapters/reminders/drizzle-push-subscription-gateway';
import { makeRecordExpenseUseCase } from '@/composition/expenses';
import { sendSpendingAlerts } from '@/orchestration/send-spending-alerts';
import { useTestDb } from '../setup';
import { adminWithPlan, request } from '../support/api';

const db = useTestDb();
const NOV = { year: 2026, month: 11 };

class RecordingPush implements NotificationGateway {
  sent: PushPayload[] = [];
  async send(_subscription: PushSubscription, payload: PushPayload) {
    this.sent.push(payload);
    return 'ok' as const;
  }
}
const noEmail: EmailGateway = { send: async () => false };

describe('sendSpendingAlerts', () => {
  it('Food & Dining past 80% sends one alert; a later save in the same month sends nothing new; past 100% sends the 100% one', async () => {
    const { userId, familyId, itemId } = await adminWithPlan(db());
    await new DrizzlePushSubscriptionGateway(db()).save({ id: randomUUID(), userId, endpoint: `https://push.example/${randomUUID()}`, p256dh: 'BPk', auth: 'aGk', userAgent: 'iPhone' });
    const push = new RecordingPush();
    const deps = { db: db(), push, email: noEmail };
    // Saved through the use case: the route would also send alerts in the background and race this test.
    const actor = { userId, familyId, role: 'admin' as const };
    const spend = (amountMinor: number) =>
      makeRecordExpenseUseCase(db()).execute({ actor, id: randomUUID(), amountMinor, txnDate: '2026-11-05' as IsoDate, allocations: [{ itemId: itemId('groceries'), amountMinor }] });

    // Food & Dining plans ₹24,000 a month in the sample plan; ₹19,500 is 81%.
    await spend(1_950_000);
    await sendSpendingAlerts(familyId, NOV, deps);
    expect(push.sent.map((p) => p.title)).toEqual(['Food & Dining: 80% of the month’s plan']);
    await spend(10_000);
    await sendSpendingAlerts(familyId, NOV, deps);
    expect(push.sent).toHaveLength(1);
    await spend(500_000);
    await sendSpendingAlerts(familyId, NOV, deps);
    expect(push.sent.map((p) => p.title)).toEqual(['Food & Dining: 80% of the month’s plan', 'Food & Dining: 100% of the month’s plan']);
    expect(push.sent[1]!.url).toBe('/month/2026-11');
  });
});

describe('PATCH /api/v1/families/current', () => {
  it('renames the family and sorts the alert levels; a member gets 403; the currency never changes', async () => {
    const { token, familyId, join } = await adminWithPlan(db());
    const patch = (t: string, body: unknown) => updateFamily(request('PATCH', '/api/v1/families/current', t, body));
    const response = await patch(token, { name: 'Kumar Family', alertThresholds: [100, 75] });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { family: { name: string; alertThresholds: number[] } }).family).toMatchObject({ name: 'Kumar Family', alertThresholds: [75, 100] });
    expect((await patch(await join('member'), { name: 'Ours' })).status).toBe(403);
    expect((await patch(token, { alertThresholds: [0] })).status).toBe(422);
    expect((await patch(token, { currencyCode: 'USD' })).status).toBe(200);
    const { rows } = await db().execute<{ currency_code: string; name: string }>(sql`select currency_code, name from app.families where id = ${familyId}`);
    expect(rows[0]).toEqual({ currency_code: 'INR', name: 'Kumar Family' });
  });
});
