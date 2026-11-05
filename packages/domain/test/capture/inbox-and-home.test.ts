import { beforeEach, describe, expect, it } from 'vitest';
import type { CaptureBatch, CaptureEntry } from '../../src/capture';
import { ListInboxUseCase } from '../../src/duplicates';
import { type Actor, toIsoDate } from '../../src/shared';
import { InMemoryCaptureGateway } from '../fakes/in-memory-capture-gateways';
import { InMemoryTransactionGateway } from '../fakes/in-memory-expenses-gateways';
import { InMemoryDuplicateMatchGateway } from '../fakes/in-memory-duplicates-gateways';

const FAMILY = 'f1';
const SPEAKER = 'u1';
const SPOUSE = 'u2';
const speaker: Actor = { userId: SPEAKER, familyId: FAMILY, role: 'admin' };
const spouse: Actor = { userId: SPOUSE, familyId: FAMILY, role: 'admin' };
const viewer: Actor = { userId: 'u3', familyId: FAMILY, role: 'viewer' };
const TODAY = toIsoDate('2026-11-05');
const uuid = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;

const entry = (over: Partial<CaptureEntry> = {}): CaptureEntry => ({
  id: uuid(1),
  amountMinor: 25000,
  itemId: 'item-groceries',
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

const batch = (over: Partial<CaptureBatch> = {}): CaptureBatch => ({
  id: uuid(90),
  familyId: FAMILY,
  createdBy: SPEAKER,
  transcript: 'KPN 250',
  sttModel: 'gpt-transcribe',
  parseModel: 'gpt-6.1-terra',
  entries: [entry()],
  createdAt: new Date('2026-11-05T08:00:00Z'),
  resolvedAt: null,
  ...over,
});

describe('ListInboxUseCase — waiting voice notes', () => {
  let captures: InMemoryCaptureGateway;
  let useCase: ListInboxUseCase;

  beforeEach(() => {
    captures = new InMemoryCaptureGateway();
    useCase = new ListInboxUseCase(new InMemoryDuplicateMatchGateway(), new InMemoryTransactionGateway(), captures);
  });

  it('shows the speaker their own waiting note, as theirs to answer', async () => {
    await captures.create(batch());

    const { captures: waiting } = await useCase.execute({ actor: speaker });

    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({ batchId: uuid(90), createdBy: SPEAKER, mine: true, transcript: 'KPN 250' });
    expect(waiting[0]!.entries).toHaveLength(1);
  });

  it('shows the other adult that it is waiting, but not as theirs to answer', async () => {
    await captures.create(batch());

    const { captures: waiting } = await useCase.execute({ actor: spouse });

    expect(waiting[0]).toMatchObject({ createdBy: SPEAKER, mine: false });
  });

  it('drops a note once it has been dealt with', async () => {
    await captures.create(batch());
    await captures.resolve(FAMILY, uuid(90), new Date());

    expect((await useCase.execute({ actor: speaker })).captures).toEqual([]);
  });

  it('never shows one family another family’s waiting note', async () => {
    await captures.create(batch({ familyId: 'f2' }));

    expect((await useCase.execute({ actor: speaker })).captures).toEqual([]);
  });

  it('lists the oldest first, whoever spoke them', async () => {
    await captures.create(batch({ id: uuid(91), createdBy: SPOUSE, createdAt: new Date('2026-11-05T09:00:00Z') }));
    await captures.create(batch({ id: uuid(90), createdAt: new Date('2026-11-05T07:00:00Z') }));

    const { captures: waiting } = await useCase.execute({ actor: speaker });

    expect(waiting.map((w) => w.batchId)).toEqual([uuid(90), uuid(91)]);
  });

  it('lets a Viewer see that a note is waiting, but never as theirs to answer', async () => {
    await captures.create(batch());

    const { captures: waiting } = await useCase.execute({ actor: viewer });

    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.mine).toBe(false);
  });

  it('keeps the duplicate questions in their own list, untouched', async () => {
    await captures.create(batch());

    const result = await useCase.execute({ actor: speaker });

    expect(result.duplicates).toEqual([]);
    expect(Array.isArray(result.duplicates)).toBe(true);
  });
});

