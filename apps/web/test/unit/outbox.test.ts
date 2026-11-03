import 'fake-indexeddb/auto';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createOutbox, type Outbox, type SendResult } from '../../src/client/outbox';

const body = (n: number) => ({ id: `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`, amountMinor: n * 100, txnDate: '2026-11-08', allocations: [] });

/** A fake server: answers per id, records every send. */
function server(answers: Record<string, SendResult | 'network'> = {}) {
  const sent: string[] = [];
  const send = async (b: { id: string }): Promise<SendResult> => {
    sent.push(b.id);
    const answer = answers[b.id] ?? { status: 201, json: { transaction: { id: b.id }, duplicate: null } };
    if (answer === 'network') throw new TypeError('Failed to fetch');
    return answer;
  };
  return { sent, send };
}

let outbox: Outbox;
beforeEach(() => {
  outbox = createOutbox(`test-${randomUUID()}`);
});

describe('the outbox', () => {
  it('a saved entry is in the outbox before any network call', async () => {
    const { sent } = server();
    await outbox.add(body(1));
    expect(sent).toEqual([]);
    expect(await outbox.list()).toMatchObject([{ id: body(1).id, state: 'waiting', error: null }]);
  });

  it('flush sends waiting entries oldest first and removes each on 201 or 200', async () => {
    const fake = server({ [body(2).id]: { status: 200, json: { transaction: { id: body(2).id }, duplicate: null } } });
    await outbox.add(body(1));
    await outbox.add(body(2));
    const result = await outbox.flush(fake.send);
    expect(fake.sent).toEqual([body(1).id, body(2).id]);
    expect(result).toMatchObject({ sent: 2, failed: 0 });
    expect(result.responses.get(body(1).id)).toEqual({ transaction: { id: body(1).id }, duplicate: null });
    expect(await outbox.list()).toEqual([]);
  });

  it('two flushes at once send each entry exactly once (Review Focus 2)', async () => {
    const fake = server();
    await outbox.add(body(1));
    await outbox.add(body(2));
    await Promise.all([outbox.flush(fake.send), outbox.flush(fake.send)]);
    expect(fake.sent).toEqual([body(1).id, body(2).id]);
  });

  it('a network error keeps the entry waiting; a 5xx keeps it waiting', async () => {
    await outbox.add(body(1));
    await outbox.add(body(2));
    const result = await outbox.flush(server({ [body(1).id]: 'network', [body(2).id]: { status: 503, json: {} } }).send);
    expect(result).toMatchObject({ sent: 0, failed: 0 });
    expect((await outbox.list()).map((e) => e.state)).toEqual(['waiting', 'waiting']);
  });

  it('401 and 422 mark the entry failed with its code and stop retrying it (Review Focus 1)', async () => {
    await outbox.add(body(1));
    await outbox.add(body(2));
    const fake = server({
      [body(1).id]: { status: 401, json: { error: { code: 'NotSignedIn' } } },
      [body(2).id]: { status: 422, json: { error: { code: 'ItemNotUsable' } } },
    });
    expect(await outbox.flush(fake.send)).toMatchObject({ sent: 0, failed: 2 });
    expect(await outbox.list()).toMatchObject([
      { id: body(1).id, state: 'failed', error: { status: 401, code: 'NotSignedIn' } },
      { id: body(2).id, state: 'failed', error: { status: 422, code: 'ItemNotUsable' } },
    ]);
    await outbox.flush(fake.send);
    expect(fake.sent).toHaveLength(2);
  });

  it('discard removes a failed entry; nothing else is touched', async () => {
    await outbox.add(body(1));
    await outbox.add(body(2));
    await outbox.flush(server({ [body(1).id]: { status: 422, json: { error: { code: 'X' } } }, [body(2).id]: 'network' }).send);
    await outbox.discard(body(1).id);
    expect(await outbox.list()).toMatchObject([{ id: body(2).id, state: 'waiting' }]);
  });

  it('counts waiting and failed entries for the indicator', async () => {
    await outbox.add(body(1));
    await outbox.add(body(2));
    await outbox.flush(server({ [body(1).id]: { status: 422, json: { error: { code: 'X' } } }, [body(2).id]: 'network' }).send);
    expect(await outbox.counts()).toEqual({ waiting: 1, failed: 1 });
  });
});
