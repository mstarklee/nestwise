import Dexie, { type Table } from 'dexie';

/** A new expense as POST /api/v1/transactions takes it; `id` is made on the phone, so a resend is recognised. */
export type OutboxBody = { id: string } & Record<string, unknown>;

export type OutboxEntry = {
  id: string;
  body: OutboxBody;
  savedAt: string;
  state: 'waiting' | 'failed';
  /** Why the server refused it; it is not sent again until the person fixes or discards it. */
  error: { status: number; code: string } | null;
};

export type SendResult = { status: number; json: unknown };
export type Send = (body: OutboxBody) => Promise<SendResult>;
export type FlushResult = { sent: number; failed: number; responses: ReadonlyMap<string, unknown> };

export interface Outbox {
  add(body: OutboxBody): Promise<OutboxEntry>;
  /** Sends waiting entries, oldest first. A call while one is running joins it, so nothing is sent twice. */
  flush(send?: Send): Promise<FlushResult>;
  discard(id: string): Promise<void>;
  list(): Promise<OutboxEntry[]>;
  counts(): Promise<{ waiting: number; failed: number }>;
}

/** Fired on window whenever the outbox changes, so the indicator can re-read its counts. */
export const OUTBOX_CHANGED = 'nestwise:outbox';

const changed = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OUTBOX_CHANGED));
};

/** Refusals that sending again cannot fix: the person must fix or discard the entry. */
const REFUSED = new Set([400, 401, 403, 404, 409, 422]);

const postTransaction: Send = async (body) => {
  const response = await fetch('/api/v1/transactions', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
};

class OutboxDb extends Dexie {
  entries!: Table<OutboxEntry, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ entries: 'id, savedAt, state' });
  }
}

/** The phone's outbox for new expenses (TRD §8.2): every save lands here first, then goes to the server. */
export function createOutbox(name = 'nestwise-outbox'): Outbox {
  const db = new OutboxDb(name);
  let running: Promise<FlushResult> | null = null;

  async function sendAll(send: Send): Promise<FlushResult> {
    const responses = new Map<string, unknown>();
    let sent = 0;
    let failed = 0;
    const waiting = await db.entries.where('state').equals('waiting').sortBy('savedAt');
    for (const entry of waiting) {
      let result: SendResult;
      try {
        result = await send(entry.body);
      } catch {
        break; // no signal: stop here and keep everything waiting, in order
      }
      if (result.status >= 200 && result.status < 300) {
        await db.entries.delete(entry.id);
        responses.set(entry.id, result.json);
        sent += 1;
      } else if (REFUSED.has(result.status)) {
        const code = (result.json as { error?: { code?: string } } | null)?.error?.code ?? 'ServerError';
        await db.entries.update(entry.id, { state: 'failed', error: { status: result.status, code } });
        failed += 1;
      }
      // Anything else (a 5xx) stays waiting for the next try.
    }
    if (sent + failed > 0) changed();
    return { sent, failed, responses };
  }

  return {
    async add(body) {
      const entry: OutboxEntry = { id: body.id, body, savedAt: new Date().toISOString(), state: 'waiting', error: null };
      await db.entries.put(entry);
      changed();
      return entry;
    },
    flush(send = postTransaction) {
      running ??= sendAll(send).finally(() => {
        running = null;
      });
      return running;
    },
    async discard(id) {
      await db.entries.delete(id);
      changed();
    },
    list() {
      return db.entries.orderBy('savedAt').toArray();
    },
    async counts() {
      const all = await db.entries.toArray();
      return { waiting: all.filter((e) => e.state === 'waiting').length, failed: all.filter((e) => e.state === 'failed').length };
    },
  };
}

let shared: Outbox | null = null;

/** The browser's one outbox. */
export function outbox(): Outbox {
  shared ??= createOutbox();
  return shared;
}
