import { randomUUID } from 'node:crypto';
import type { CaptureBatch, CaptureEntry } from '@nestwise/domain/capture';
import { toIsoDate } from '@nestwise/domain/shared';
import { describe, expect, it } from 'vitest';
import { DrizzleCaptureGateway } from '@/adapters/capture/drizzle-capture-gateway';
import { useTestDb } from '../../setup';
import { familyWithPlan } from '../../support/family-with-plan';

const db = useTestDb();
const TODAY = toIsoDate('2026-11-05');

const entry = (over: Partial<CaptureEntry> = {}): CaptureEntry => ({
  id: randomUUID(),
  amountMinor: 25000,
  itemId: null,
  yearLineId: null,
  kind: 'expense',
  txnDate: TODAY,
  merchant: 'KPN',
  note: '',
  heard: 'KPN 250',
  confidence: { amount: 0.97, item: 0.94 },
  dropped: false,
  ...over,
});

const batch = (over: Partial<CaptureBatch>): CaptureBatch => ({
  id: randomUUID(),
  familyId: 'set-by-caller',
  createdBy: 'set-by-caller',
  transcript: 'KPN 250',
  sttModel: 'gpt-transcribe',
  parseModel: 'gpt-6.1-terra',
  entries: [entry()],
  createdAt: new Date('2026-11-05T08:00:00Z'),
  resolvedAt: null,
  ...over,
});

describe('DrizzleCaptureGateway', () => {
  it('round-trips a batch with its entries, including one with no amount and no item', async () => {
    const f = await familyWithPlan(db());
    const gateway = new DrizzleCaptureGateway(db());
    const unheard = entry({ amountMinor: null, itemId: null, heard: 'something mumbled', confidence: { amount: 0.1, item: 0.2 } });
    const matched = entry({ itemId: f.itemId('groceries') });
    const written = batch({ familyId: f.familyId, createdBy: f.userId, entries: [matched, unheard] });

    await gateway.create(written);

    const read = await gateway.find(f.familyId, written.id);
    expect(read).toMatchObject({ id: written.id, transcript: 'KPN 250', sttModel: 'gpt-transcribe', parseModel: 'gpt-6.1-terra', resolvedAt: null });
    expect(read!.entries).toHaveLength(2);
    expect(read!.entries.find((e) => e.id === unheard.id)).toMatchObject({ amountMinor: null, itemId: null, confidence: { amount: 0.1, item: 0.2 } });
    expect(read!.entries.find((e) => e.id === matched.id)).toMatchObject({ amountMinor: 25000, itemId: f.itemId('groceries'), merchant: 'KPN' });
  });

  it('keeps a bill entry with its year line and no item', async () => {
    const f = await familyWithPlan(db());
    const gateway = new DrizzleCaptureGateway(db());
    const bill = entry({ kind: 'yearly_bill', itemId: null, yearLineId: null, amountMinor: 150000, heard: 'bike insurance 1500 paid' });
    const written = batch({ familyId: f.familyId, createdBy: f.userId, entries: [bill] });

    await gateway.create(written);

    expect((await gateway.find(f.familyId, written.id))!.entries[0]).toMatchObject({ kind: 'yearly_bill', itemId: null, amountMinor: 150000 });
  });

  it('lists only unresolved batches, oldest first, whoever spoke them', async () => {
    const f = await familyWithPlan(db());
    const spouse = randomUUID();
    const gateway = new DrizzleCaptureGateway(db());
    const mine = batch({ familyId: f.familyId, createdBy: f.userId, createdAt: new Date('2026-11-05T07:00:00Z') });
    const theirs = batch({ familyId: f.familyId, createdBy: spouse, createdAt: new Date('2026-11-05T09:00:00Z') });
    const done = batch({ familyId: f.familyId, createdBy: f.userId, createdAt: new Date('2026-11-05T06:00:00Z') });
    for (const b of [mine, theirs, done]) await gateway.create(b);
    await gateway.resolve(f.familyId, done.id, new Date());

    const waiting = await gateway.listWaiting(f.familyId);

    expect(waiting.map((b) => b.id)).toEqual([mine.id, theirs.id]);
    expect(waiting.map((b) => b.createdBy)).toEqual([f.userId, spouse]);
  });

  it('resolves once and refuses a second time, which is the guard against a double confirm', async () => {
    const f = await familyWithPlan(db());
    const gateway = new DrizzleCaptureGateway(db());
    const written = batch({ familyId: f.familyId, createdBy: f.userId });
    await gateway.create(written);

    expect(await gateway.resolve(f.familyId, written.id, new Date())).toBe(true);
    expect(await gateway.resolve(f.familyId, written.id, new Date())).toBe(false);
    expect((await gateway.find(f.familyId, written.id))!.resolvedAt).not.toBeNull();
  });

  it('refuses to resolve a batch belonging to another family', async () => {
    const f = await familyWithPlan(db());
    const other = await familyWithPlan(db());
    const gateway = new DrizzleCaptureGateway(db());
    const written = batch({ familyId: f.familyId, createdBy: f.userId });
    await gateway.create(written);

    expect(await gateway.resolve(other.familyId, written.id, new Date())).toBe(false);
    expect((await gateway.find(f.familyId, written.id))!.resolvedAt).toBeNull();
  });

  it('never shows one family a batch of another', async () => {
    const f = await familyWithPlan(db());
    const other = await familyWithPlan(db());
    const gateway = new DrizzleCaptureGateway(db());
    const written = batch({ familyId: f.familyId, createdBy: f.userId });
    await gateway.create(written);

    expect(await gateway.find(other.familyId, written.id)).toBeUndefined();
    expect(await gateway.listWaiting(other.familyId)).toEqual([]);
  });
});
