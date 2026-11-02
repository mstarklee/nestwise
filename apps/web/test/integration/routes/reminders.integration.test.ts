import { describe, expect, it } from 'vitest';
import { GET as cron } from '../../../app/api/cron/daily/route';
import { POST as subscribe } from '../../../app/api/v1/push/subscribe/route';
import { DrizzlePushSubscriptionGateway } from '@/adapters/reminders/drizzle-push-subscription-gateway';
import { useTestDb } from '../setup';
import { adminWithPlan, request } from '../support/api';

const db = useTestDb();

const cronRequest = (authorization?: string) =>
  new Request('https://nestwise.test/api/cron/daily', { headers: authorization ? { authorization } : {} });

describe('/api/cron/daily', () => {
  it('runs only with the right Bearer CRON_SECRET; refuses everything when the secret is not set', async () => {
    process.env.CRON_SECRET = '';
    expect((await cron(cronRequest('Bearer '))).status).toBe(401);
    process.env.CRON_SECRET = 'test-cron-secret';
    expect((await cron(cronRequest())).status).toBe(401);
    expect((await cron(cronRequest('Bearer wrong-secret'))).status).toBe(401);
    const ok = await cron(cronRequest('Bearer test-cron-secret'));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ families: 0, sent: 0 });
  });
});

describe('/api/v1/push/subscribe', () => {
  it('saves this phone for the signed-in person (201); 401 signed out; 422 for a non-https endpoint; 400 for a bad shape', async () => {
    const { token, userId } = await adminWithPlan(db());
    const body = { endpoint: 'https://web.push.apple.com/QGx3', keys: { p256dh: 'BPk', auth: 'aGk' } };
    expect((await subscribe(request('POST', '/api/v1/push/subscribe', undefined, body))).status).toBe(401);
    expect((await subscribe(request('POST', '/api/v1/push/subscribe', token, body))).status).toBe(201);
    expect(await new DrizzlePushSubscriptionGateway(db()).listForUser(userId)).toMatchObject([{ endpoint: body.endpoint }]);
    expect((await subscribe(request('POST', '/api/v1/push/subscribe', token, { ...body, endpoint: 'http://push.example.com/x' }))).status).toBe(422);
    expect((await subscribe(request('POST', '/api/v1/push/subscribe', token, { endpoint: 1 }))).status).toBe(400);
  });
});
