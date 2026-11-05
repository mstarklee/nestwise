import { beforeEach, describe, expect, it } from 'vitest';
import { type CaptureBatch, CaptureBatchNotFoundError, GetCaptureBatchUseCase } from '../../src/capture';
import { type Actor, toIsoDate } from '../../src/shared';
import { InMemoryCaptureGateway } from '../fakes/in-memory-capture-gateways';

const FAMILY = 'f1';
const SPEAKER = 'u1';
const speaker: Actor = { userId: SPEAKER, familyId: FAMILY, role: 'admin' };
const spouse: Actor = { userId: 'u2', familyId: FAMILY, role: 'admin' };
const stranger: Actor = { userId: 'u9', familyId: 'f2', role: 'admin' };
const uuid = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;

const batch = (over: Partial<CaptureBatch> = {}): CaptureBatch => ({
  id: uuid(1),
  familyId: FAMILY,
  createdBy: SPEAKER,
  transcript: 'KPN 250',
  sttModel: 'saaras:v4',
  parseModel: 'gpt-6.1-terra',
  entries: [
    {
      id: uuid(2),
      amountMinor: 25000,
      itemId: 'item-groceries',
      yearLineId: null,
      kind: 'expense',
      txnDate: toIsoDate('2026-11-05'),
      merchant: 'KPN',
      note: '',
      heard: 'KPN 250',
      confidence: { amount: 0.97, item: 0.94 },
      dropped: false,
    },
  ],
  createdAt: new Date('2026-11-05T08:00:00Z'),
  resolvedAt: null,
  ...over,
});

describe('GetCaptureBatchUseCase', () => {
  let captures: InMemoryCaptureGateway;
  let useCase: GetCaptureBatchUseCase;

  beforeEach(async () => {
    captures = new InMemoryCaptureGateway();
    useCase = new GetCaptureBatchUseCase(captures);
    await captures.create(batch());
  });

  it('gives the speaker their batch, marked as theirs to confirm', async () => {
    const result = await useCase.execute({ actor: speaker, batchId: uuid(1) });

    expect(result).toMatchObject({ mine: true, transcript: 'KPN 250' });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ amountMinor: 25000, needsAttention: false });
  });

  it('lets the other adult look, but not as theirs to confirm', async () => {
    expect((await useCase.execute({ actor: spouse, batchId: uuid(1) })).mine).toBe(false);
  });

  it('marks a row the parse was unsure of', async () => {
    const unsure = batch({ id: uuid(3), entries: [{ ...batch().entries[0]!, id: uuid(4), amountMinor: null }] });
    await captures.create(unsure);

    expect((await useCase.execute({ actor: speaker, batchId: uuid(3) })).entries[0]!.needsAttention).toBe(true);
  });

  it('refuses a batch that is not there', async () => {
    await expect(useCase.execute({ actor: speaker, batchId: uuid(99) })).rejects.toThrow(CaptureBatchNotFoundError);
  });

  it('refuses another family’s batch', async () => {
    await expect(useCase.execute({ actor: stranger, batchId: uuid(1) })).rejects.toThrow(CaptureBatchNotFoundError);
  });

  it('refuses one that has already been dealt with, so it cannot be confirmed twice from a stale link', async () => {
    await captures.resolve(FAMILY, uuid(1), new Date());

    await expect(useCase.execute({ actor: speaker, batchId: uuid(1) })).rejects.toThrow(CaptureBatchNotFoundError);
  });
});
