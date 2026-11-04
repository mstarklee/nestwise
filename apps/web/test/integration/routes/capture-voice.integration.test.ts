import { usage } from '@nestwise/db';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as capture } from '../../../app/api/v1/capture/voice/route';
import { GET as inbox } from '../../../app/api/v1/inbox/route';
import { DrizzleCaptureGateway } from '@/adapters/capture/drizzle-capture-gateway';
import { useTestDb } from '../setup';
import { adminWithPlan, request } from '../support/api';

const db = useTestDb();

type Row = {
  amount_minor: number | null;
  item_id: string | null;
  year_line_id: string | null;
  kind: 'expense' | 'yearly_bill';
  date: string;
  merchant: string | null;
  note: string;
  heard: string;
  confidence: { amount: number; item: number };
};

const TRANSCRIPT = 'KPN 250, chicken boneless 500';

/** The real adapters, with the two services' HTTP replies canned. No key, no network. */
function stubServices(options: { transcript?: string; rows?: Row[]; refuse?: boolean } = {}) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    calls.push(href);
    if (href.includes('/v1/audio/transcriptions')) {
      return Response.json({ text: options.transcript ?? TRANSCRIPT, usage: { type: 'duration', seconds: 11 } });
    }
    if (href.includes('/v1/responses')) {
      if (options.refuse) {
        return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] });
      }
      const body = JSON.parse(String(init?.body ?? '{}')) as { input: { content: string }[] };
      // Prove the family's own item list reached the prompt.
      calls.push(`prompt:${body.input[0]!.content.includes('Groceries') ? 'has-items' : 'no-items'}`);
      return Response.json({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ expenses: options.rows ?? [] }) }] }],
      });
    }
    throw new Error(`unexpected fetch to ${href}`);
  });
  return calls;
}

const row = (over: Partial<Row> = {}): Row => ({
  amount_minor: 25000,
  item_id: null,
  year_line_id: null,
  kind: 'expense',
  date: '2026-11-05',
  merchant: 'KPN',
  note: '',
  heard: 'KPN 250',
  confidence: { amount: 0.97, item: 0.94 },
  ...over,
});

function recording(token: string | undefined, bytes = new Uint8Array([1, 2, 3, 4]), seconds = 11) {
  const form = new FormData();
  form.set('audio', new Blob([bytes as BlobPart], { type: 'audio/mp4' }), 'r.m4a');
  form.set('seconds', String(seconds));
  return new Request('https://nestwise.test/api/v1/capture/voice', {
    method: 'POST',
    headers: token ? { cookie: `nw_session=${token}` } : {},
    body: form,
  });
}

describe('POST /api/v1/capture/voice', () => {
  beforeEach(() => {
    process.env.STT_PROVIDER = 'openai';
    process.env.STT_API_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_MODEL = 'gpt-6.1-terra';
    delete process.env.UNCAPPED_FAMILY_IDS;
    process.env.CAP_VOICE_PER_MONTH = '400';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stages the entries it heard and returns them for the review screen', async () => {
    const { token, itemId, familyId } = await adminWithPlan(db());
    const calls = stubServices({ rows: [row({ item_id: itemId('groceries') }), row({ amount_minor: 50000, item_id: itemId('non_veg'), heard: 'chicken boneless 500' })] });

    const response = await capture(recording(token));

    expect(response.status).toBe(201);
    const { batch } = (await response.json()) as { batch: { id: string; transcript: string; entries: { amountMinor: number | null; needsAttention: boolean }[] } };
    expect(batch.transcript).toBe(TRANSCRIPT);
    expect(batch.entries.map((e) => e.amountMinor)).toEqual([25000, 50000]);
    expect(batch.entries.every((e) => !e.needsAttention)).toBe(true);
    expect(calls).toContain('prompt:has-items');

    const stored = await new DrizzleCaptureGateway(db()).find(familyId, batch.id);
    expect(stored).toMatchObject({ transcript: TRANSCRIPT, sttModel: 'gpt-transcribe', parseModel: 'gpt-6.1-terra', resolvedAt: null });
  });

  it('counts the recording against the family month', async () => {
    const { token, itemId, familyId } = await adminWithPlan(db());
    stubServices({ rows: [row({ item_id: itemId('groceries') })] });

    await capture(recording(token));

    const [row1] = await db()
      .select({ voiceCount: usage.voiceCount, voiceSeconds: usage.voiceSeconds })
      .from(usage)
      .where(and(eq(usage.familyId, familyId), eq(usage.year, 2026), eq(usage.month, 11)));
    expect(row1).toMatchObject({ voiceCount: 1, voiceSeconds: 11 });
  });

  it('flags a row it was unsure of, and one with no amount at all', async () => {
    const { token } = await adminWithPlan(db());
    stubServices({ rows: [row({ amount_minor: null, heard: 'something mumbled' }), row({ item_id: 'not-a-real-item' })] });

    const response = await capture(recording(token));

    const { batch } = (await response.json()) as { batch: { entries: { amountMinor: number | null; itemId: string | null; needsAttention: boolean }[] } };
    expect(batch.entries).toHaveLength(2);
    expect(batch.entries.every((e) => e.needsAttention)).toBe(true);
    expect(batch.entries[1]!.itemId).toBeNull();
  });

  it('says it could not read a recording with no expenses in it, and stages nothing', async () => {
    const { token, familyId } = await adminWithPlan(db());
    stubServices({ rows: [] });

    const response = await capture(recording(token));

    expect(response.status).toBe(422);
    expect(await new DrizzleCaptureGateway(db()).listWaiting(familyId)).toEqual([]);
  });

  it('says it could not read it when the parse refuses, and stages nothing', async () => {
    const { token, familyId } = await adminWithPlan(db());
    stubServices({ refuse: true });

    expect((await capture(recording(token))).status).toBe(422);
    expect(await new DrizzleCaptureGateway(db()).listWaiting(familyId)).toEqual([]);
  });

  it('refuses a recording longer than the service allows, without calling out', async () => {
    const { token } = await adminWithPlan(db());
    const calls = stubServices({ rows: [row()] });

    const response = await capture(recording(token, new Uint8Array([1, 2, 3]), 75));

    expect(response.status).toBe(422);
    expect(calls).toEqual([]);
  });

  it('allows 30 seconds only, once Sarvam is the chosen service', async () => {
    process.env.STT_PROVIDER = 'sarvam';
    const { token } = await adminWithPlan(db());
    const calls = stubServices({ rows: [row()] });

    expect((await capture(recording(token, new Uint8Array([1, 2, 3]), 45))).status).toBe(422);
    expect(calls).toEqual([]);
  });

  it('refuses an empty recording and a file that is not audio', async () => {
    const { token } = await adminWithPlan(db());
    stubServices({ rows: [row()] });

    expect((await capture(recording(token, new Uint8Array([])))).status).toBe(422);

    const form = new FormData();
    form.set('audio', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
    const notAudio = new Request('https://nestwise.test/api/v1/capture/voice', { method: 'POST', headers: { cookie: `nw_session=${token}` }, body: form });
    expect((await capture(notAudio)).status).toBe(422);
  });

  it('refuses a Viewer and anyone not signed in', async () => {
    const { token, join } = await adminWithPlan(db());
    const viewer = await join('viewer');
    stubServices({ rows: [row()] });

    expect((await capture(recording(viewer))).status).toBe(403);
    expect((await capture(recording(undefined))).status).toBe(401);
    expect(token).toBeTruthy();
  });

  it('stops at the monthly cap and says typing still works', async () => {
    process.env.CAP_VOICE_PER_MONTH = '1';
    const { token, itemId } = await adminWithPlan(db());
    stubServices({ rows: [row({ item_id: itemId('groceries') })] });

    expect((await capture(recording(token))).status).toBe(201);
    const second = await capture(recording(token));

    expect(second.status).toBe(409);
    expect(((await second.json()) as { error: { message: string } }).error.message).toMatch(/type/i);
  });

  it('shows the waiting note in the Inbox: the speaker can act on it, the other adult cannot', async () => {
    const { token, itemId, join } = await adminWithPlan(db());
    const spouse = await join('admin');
    stubServices({ rows: [row({ item_id: itemId('groceries') })] });
    const { batch } = (await (await capture(recording(token))).json()) as { batch: { id: string } };

    const inboxFor = async (who: string) =>
      (await (await inbox(request('GET', '/api/v1/inbox', who))).json()) as {
        entries: unknown[];
        voiceNotes: { batchId: string; mine: boolean; transcript: string; entryCount: number }[];
      };

    const mine = await inboxFor(token);
    expect(mine.entries).toEqual([]);
    expect(mine.voiceNotes).toHaveLength(1);
    expect(mine.voiceNotes[0]).toMatchObject({ batchId: batch.id, mine: true, transcript: TRANSCRIPT, entryCount: 1 });

    const theirs = await inboxFor(spouse);
    expect(theirs.voiceNotes[0]).toMatchObject({ batchId: batch.id, mine: false });
  });

  it('never caps a family listed as uncapped', async () => {
    const { token, familyId, itemId } = await adminWithPlan(db());
    process.env.CAP_VOICE_PER_MONTH = '1';
    process.env.UNCAPPED_FAMILY_IDS = familyId;
    stubServices({ rows: [row({ item_id: itemId('groceries') })] });

    expect((await capture(recording(token))).status).toBe(201);
    expect((await capture(recording(token))).status).toBe(201);
  });
});
