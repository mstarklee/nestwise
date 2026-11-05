import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as capture } from '../../../app/api/v1/capture/voice/route';
import { POST as confirm } from '../../../app/api/v1/capture/voice/[id]/confirm/route';
import { GET as getPot } from '../../../app/api/v1/pot/route';
import { POST as record } from '../../../app/api/v1/transactions/route';
import { GET as getYear } from '../../../app/api/v1/years/[y]/route';
import { useTestDb } from '../setup';
import { adminWithPlan, params, request } from '../support/api';

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

type Batch = { id: string; entries: { id: string; amountMinor: number | null; itemId: string | null; yearLineId: string | null; kind: string; txnDate: string; merchant: string | null }[] };
type YearBody = { lines: { id: string; itemId: string; state: string; status: string; remainingMinor: number }[] };

function stub(rows: Row[], transcript = 'bike insurance 1500 paid') {
  vi.stubGlobal('fetch', async (url: string | URL | Request) => {
    const href = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    if (href.includes('/v1/audio/transcriptions')) return Response.json({ text: transcript, usage: { type: 'duration', seconds: 9 } });
    if (href.includes('/v1/responses')) {
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ expenses: rows }) }] }] });
    }
    throw new Error(`unexpected fetch to ${href}`);
  });
}

const recording = (token: string) => {
  const form = new FormData();
  form.set('audio', new Blob([new Uint8Array([1, 2, 3, 4]) as BlobPart], { type: 'audio/mp4' }), 'r.m4a');
  form.set('seconds', '9');
  return new Request('https://nestwise.test/api/v1/capture/voice', { method: 'POST', headers: { cookie: `nw_session=${token}` }, body: form });
};

const yearOf = async (token: string) => (await (await getYear(request('GET', '/api/v1/years/2026', token), params({ y: '2026' }))).json()) as YearBody;
const potOf = async (token: string) => (await (await getPot(request('GET', '/api/v1/pot', token))).json()) as { balanceMinor: number };

/** A family whose 2026 plan exists, with the bike-insurance line's id. */
async function familyWithBikeLine() {
  const f = await adminWithPlan(db());
  const { lines } = await yearOf(f.token);
  const line = lines.find((l) => l.itemId === f.itemId('bike_ins'))!;
  return { ...f, lineId: line.id, lineItemId: f.itemId('bike_ins') };
}

const billRow = (yearLineId: string, amount = 150000): Row => ({
  amount_minor: amount,
  item_id: null,
  year_line_id: yearLineId,
  kind: 'yearly_bill',
  date: '2026-11-05',
  merchant: null,
  note: '',
  heard: 'bike insurance 1500 paid',
  confidence: { amount: 0.97, item: 0.95 },
});

async function speakAndConfirm(token: string, rows: Row[], transcript?: string) {
  stub(rows, transcript);
  const captured = await capture(recording(token));
  const { batch } = (await captured.json()) as { batch: Batch };
  const response = await confirm(
    request('POST', `/api/v1/capture/voice/${batch.id}/confirm`, token, {
      entries: batch.entries.map((entry) => ({
        id: entry.id,
        amountMinor: entry.amountMinor,
        itemId: entry.itemId,
        yearLineId: entry.yearLineId,
        kind: entry.kind,
        txnDate: entry.txnDate,
        merchant: entry.merchant,
        note: '',
        paidBy: null,
        dropped: false,
      })),
    }),
    params({ id: batch.id }),
  );
  return { batch, response };
}

describe('POST /api/v1/capture/voice/[id]/confirm — paying a yearly bill', () => {
  beforeEach(() => {
    process.env.STT_PROVIDER = 'openai';
    process.env.STT_API_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AI_MODEL = 'gpt-6.1-terra';
    process.env.CAP_VOICE_PER_MONTH = '400';
    delete process.env.UNCAPPED_FAMILY_IDS;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('leaves the pot and the bill in exactly the state the typed path leaves them', async () => {
    const byVoice = await familyWithBikeLine();
    const byHand = await familyWithBikeLine();

    const { response } = await speakAndConfirm(byVoice.token, [billRow(byVoice.lineId)]);
    expect(response.status).toBe(201);

    vi.unstubAllGlobals();
    await record(
      request('POST', '/api/v1/transactions', byHand.token, {
        id: randomUUID(),
        amountMinor: 150000,
        txnDate: '2026-11-05',
        allocations: [{ itemId: byHand.lineItemId, amountMinor: 150000, planYear: 2026 }],
      }),
    );

    const [voicePot, handPot] = [await potOf(byVoice.token), await potOf(byHand.token)];
    expect(voicePot.balanceMinor).toBe(handPot.balanceMinor);

    const lineBy = async (f: Awaited<ReturnType<typeof familyWithBikeLine>>) => (await yearOf(f.token)).lines.find((l) => l.id === f.lineId)!;
    const [voiceLine, handLine] = [await lineBy(byVoice), await lineBy(byHand)];
    expect(voiceLine.status).toBe(handLine.status);
    expect(voiceLine.remainingMinor).toBe(handLine.remainingMinor);
    expect(voiceLine).toMatchObject({ status: 'paid', remainingMinor: 0, state: 'open' });
  });

  it('leaves the ₹100 still owed when ₹1,400 is paid against a ₹1,500 bill', async () => {
    const f = await familyWithBikeLine();

    const { response } = await speakAndConfirm(f.token, [billRow(f.lineId, 140000)], 'bike insurance 1400 paid');
    expect(response.status).toBe(201);

    const line = (await yearOf(f.token)).lines.find((l) => l.id === f.lineId)!;
    // The ₹100 is what matters: it is still owed, still in the forecast, and the line is not closed.
    expect(line).toMatchObject({ remainingMinor: 10000, state: 'open' });
    expect(line.status).not.toBe('paid');
  });

  it('refuses to pay the same bill twice, and takes nothing more out of the pot', async () => {
    const f = await familyWithBikeLine();
    await speakAndConfirm(f.token, [billRow(f.lineId)]);
    const after = await potOf(f.token);

    // The line is now fully paid, so it is no longer offered to the parse at all (design §6). A client that names
    // it anyway is refused — the status is 4xx either way; what matters is that no further money moves.
    const { response } = await speakAndConfirm(f.token, [billRow(f.lineId)]);

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect((await potOf(f.token)).balanceMinor).toBe(after.balanceMinor);
  });

  it('stops offering a bill once it is fully paid', async () => {
    const f = await familyWithBikeLine();
    await speakAndConfirm(f.token, [billRow(f.lineId)]);

    // Capture again: the staged row comes back with no bill attached, because the paid line is not in the context.
    stub([billRow(f.lineId)]);
    const captured = await capture(recording(f.token));
    const { batch } = (await captured.json()) as { batch: Batch };

    expect(batch.entries[0]!.yearLineId).toBeNull();
  });

  it('creates the expenses once when the same batch is confirmed twice', async () => {
    const f = await familyWithBikeLine();
    const { batch, response } = await speakAndConfirm(f.token, [billRow(f.lineId)]);
    expect(response.status).toBe(201);
    const after = await potOf(f.token);

    const again = await confirm(
      request('POST', `/api/v1/capture/voice/${batch.id}/confirm`, f.token, {
        entries: batch.entries.map((e) => ({
          id: e.id,
          amountMinor: e.amountMinor,
          itemId: e.itemId,
          yearLineId: e.yearLineId,
          kind: e.kind,
          txnDate: e.txnDate,
          merchant: e.merchant,
          note: '',
          paidBy: null,
          dropped: false,
        })),
      }),
      params({ id: batch.id }),
    );

    expect(again.status).toBe(201);
    expect(((await again.json()) as { created: unknown[] }).created).toEqual([]);
    expect((await potOf(f.token)).balanceMinor).toBe(after.balanceMinor);
  });

  it('refuses the other adult, even an Admin', async () => {
    const f = await familyWithBikeLine();
    const spouse = await f.join('admin');
    stub([billRow(f.lineId)]);
    const { batch } = (await (await capture(recording(f.token))).json()) as { batch: Batch };

    const response = await confirm(
      request('POST', `/api/v1/capture/voice/${batch.id}/confirm`, spouse, {
        entries: batch.entries.map((e) => ({
          id: e.id,
          amountMinor: e.amountMinor,
          itemId: e.itemId,
          yearLineId: e.yearLineId,
          kind: e.kind,
          txnDate: e.txnDate,
          merchant: e.merchant,
          note: '',
          paidBy: null,
          dropped: false,
        })),
      }),
      params({ id: batch.id }),
    );

    expect(response.status).toBe(403);
  });
});
