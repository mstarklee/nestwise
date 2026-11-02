import { describe, expect, it } from 'vitest';
import { FixedClock } from './fixed-clock';
import { InMemoryActivityGateway } from './in-memory-activity-gateway';
import { SequentialIds } from './sequential-ids';

describe('fakes', () => {
  it('FixedClock returns the pinned instant, as a fresh Date each time', () => {
    const clock = new FixedClock('2026-10-31T19:00:00Z');
    expect(clock.now().toISOString()).toBe('2026-10-31T19:00:00.000Z');
    clock.now().setFullYear(2000);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });

  it('SequentialIds yields id-1, id-2, … or a custom prefix', () => {
    const ids = new SequentialIds();
    expect([ids.next(), ids.next()]).toEqual(['id-1', 'id-2']);
    expect(new SequentialIds('tx').next()).toBe('tx-1');
  });

  it('InMemoryActivityGateway records events in order', async () => {
    const activity = new InMemoryActivityGateway();
    const event = { familyId: 'f1', actorId: 'u1', action: 'create', entityType: 'family', entityId: 'f1', before: null, after: {}, at: new Date(0) };
    await activity.record(event);
    expect(activity.count()).toBe(1);
    expect(activity.all()).toEqual([event]);
  });
});
