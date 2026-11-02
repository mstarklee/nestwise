import { describe, expect, it } from 'vitest';
import { InvalidPushSubscriptionError, SavePushSubscriptionUseCase } from '../../src/reminders';
import { InMemoryPushSubscriptionGateway } from '../fakes/in-memory-push-subscription-gateway';
import { SequentialIds } from '../fakes/sequential-ids';

const valid = { userId: 'u1', endpoint: 'https://web.push.apple.com/QGx3', p256dh: 'BPk', auth: 'aGk', userAgent: 'iPhone' };

describe('SavePushSubscriptionUseCase', () => {
  it('saves this device for the signed-in user; the same device again replaces it', async () => {
    const subscriptions = new InMemoryPushSubscriptionGateway();
    const save = new SavePushSubscriptionUseCase(subscriptions, new SequentialIds('sub'));
    await save.execute(valid);
    await save.execute({ ...valid, auth: 'bmV3' });
    expect(await subscriptions.listForUser('u1')).toMatchObject([{ id: 'sub-2', endpoint: valid.endpoint, auth: 'bmV3', userAgent: 'iPhone' }]);
  });

  it('refuses an endpoint that is not https, and empty keys — nothing saved', async () => {
    const subscriptions = new InMemoryPushSubscriptionGateway();
    const save = new SavePushSubscriptionUseCase(subscriptions, new SequentialIds());
    for (const bad of [{ endpoint: 'http://push.example.com/x' }, { endpoint: 'not a url' }, { p256dh: '' }, { auth: ' ' }]) {
      await expect(save.execute({ ...valid, ...bad })).rejects.toBeInstanceOf(InvalidPushSubscriptionError);
    }
    expect(subscriptions.rows).toHaveLength(0);
  });
});
