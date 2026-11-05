import { beforeEach, describe, expect, it } from 'vitest';
import {
  CaptureCapReachedError,
  CaptureNotUnderstoodError,
  CaptureVoiceUseCase,
  type ParsedEntry,
} from '../../src/capture';
import { EnsureMiscellaneousItemUseCase, MISCELLANEOUS_NAME } from '../../src/plan';
import { type Actor, NotAllowedError, toIsoDate } from '../../src/shared';
import type { YearLine, YearPlan } from '../../src/year-plan';
import { familyRecord } from '../fakes/family-record';
import { FixedClock } from '../fakes/fixed-clock';
import { FakeExpenseParser, FakeSpeechToText, InMemoryCaptureGateway, InMemoryUsageGateway } from '../fakes/in-memory-capture-gateways';
import { InMemoryFamilyGateway } from '../fakes/in-memory-family-gateways';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { InMemoryYearPaidGateway, InMemoryYearPlanGateway } from '../fakes/in-memory-year-plan-gateways';
import { SequentialIds } from '../fakes/sequential-ids';

const FAMILY = 'f1';
const admin: Actor = { userId: 'u1', familyId: FAMILY, role: 'admin' };
const member: Actor = { userId: 'u2', familyId: FAMILY, role: 'member' };
const viewer: Actor = { userId: 'u3', familyId: FAMILY, role: 'viewer' };
const AUDIO = new Uint8Array([9, 9, 9]);
const MIME = 'audio/mp4';
const NOW = '2026-11-05T08:00:00Z';
const TODAY = toIsoDate('2026-11-05');
const CAP = 400;

const entry = (over: Partial<ParsedEntry> = {}): ParsedEntry => ({
  amountMinor: 25000,
  itemId: null,
  yearLineId: null,
  kind: 'expense',
  txnDate: TODAY,
  merchant: 'KPN',
  note: '',
  heard: 'KPN 250',
  confidence: { amount: 0.97, item: 0.94 },
  ...over,
});

const yearLine = (over: Partial<YearLine>): YearLine => ({
  id: 'line-bike',
  familyId: FAMILY,
  year: 2026,
  itemId: 'item-bike',
  name: 'Bike Insurance',
  plannedMinor: 150000,
  dueYear: 2026,
  dueMonth: 11,
  dueDay: null,
  state: 'open',
  ...over,
});

const yearPlan = (lines: readonly YearLine[], year = 2026): YearPlan => ({
  id: `yp-${year}`,
  familyId: FAMILY,
  year,
  firstYearCheckAt: null,
  nextYearReviewedAt: null,
  lines,
});

function build(options: { stt?: FakeSpeechToText; parser?: FakeExpenseParser; cap?: number } = {}) {
  const planUow = new InMemoryPlanUnitOfWork();
  const families = new InMemoryFamilyGateway();
  const yearPlans = new InMemoryYearPlanGateway();
  const yearPaid = new InMemoryYearPaidGateway();
  const captures = new InMemoryCaptureGateway();
  const usage = new InMemoryUsageGateway();
  const stt = options.stt ?? new FakeSpeechToText();
  const parser = options.parser ?? new FakeExpenseParser([entry()]);
  const ids = new SequentialIds('batch');
  const clock = new FixedClock(NOW);

  const useCase = new CaptureVoiceUseCase(
    { captures, usage, plan: planUow.plan, yearPlans, yearPaid, families },
    stt,
    parser,
    new EnsureMiscellaneousItemUseCase(planUow, planUow.plan, new SequentialIds('misc'), clock),
    clock,
    ids,
    options.cap ?? CAP,
  );

  return { useCase, planUow, families, yearPlans, yearPaid, captures, usage, stt, parser, clock };
}

async function withFamily(h: ReturnType<typeof build>) {
  await h.families.save(familyRecord({ id: FAMILY, currencyCode: 'INR', timeZone: 'Asia/Kolkata' }));
  return h;
}

describe('CaptureVoiceUseCase', () => {
  let h: ReturnType<typeof build>;

  beforeEach(async () => {
    h = await withFamily(build());
  });

  it('refuses a Viewer, who may not record expenses', async () => {
    await expect(h.useCase.execute({ actor: viewer, audio: AUDIO, mimeType: MIME })).rejects.toThrow(NotAllowedError);
    expect(h.captures.all()).toEqual([]);
  });

  it('lets a Member record', async () => {
    const batch = await h.useCase.execute({ actor: member, audio: AUDIO, mimeType: MIME });
    expect(batch.createdBy).toBe(member.userId);
  });

  it('transcribes, parses and stores one batch', async () => {
    const batch = await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    expect(h.stt.calls).toEqual([{ mimeType: MIME, languages: ['ta', 'en'], bytes: 3 }]);
    expect(h.parser.transcripts).toEqual(['KPN 250']);
    expect(h.captures.all()).toHaveLength(1);
    expect(batch).toMatchObject({
      familyId: FAMILY,
      createdBy: admin.userId,
      transcript: 'KPN 250',
      sttModel: 'fake-stt',
      parseModel: 'fake-parser',
      resolvedAt: null,
    });
    expect(batch.entries).toHaveLength(1);
  });

  it('keeps the transcript on the batch and no audio anywhere in it', async () => {
    const batch = await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    expect(batch.transcript).toBe('KPN 250');
    expect(JSON.stringify(batch)).not.toContain('9,9,9');
  });

  it('gives every entry an id of its own and marks none dropped', async () => {
    const parser = new FakeExpenseParser([entry(), entry({ amountMinor: 50000 })]);
    h = await withFamily(build({ parser }));

    const batch = await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    expect(new Set(batch.entries.map((e) => e.id)).size).toBe(2);
    expect(batch.entries.every((e) => !e.dropped)).toBe(true);
  });

  it('throws CaptureNotUnderstoodError and stores nothing when no expenses were heard', async () => {
    h = await withFamily(build({ parser: new FakeExpenseParser([]) }));

    await expect(h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME })).rejects.toThrow(CaptureNotUnderstoodError);
    expect(h.captures.all()).toEqual([]);
  });

  it('stores nothing when the speech service fails', async () => {
    h = await withFamily(build({ stt: new FakeSpeechToText(new CaptureNotUnderstoodError('nope')) }));

    await expect(h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME })).rejects.toThrow(CaptureNotUnderstoodError);
    expect(h.captures.all()).toEqual([]);
  });

  it('stores nothing when the parse fails', async () => {
    h = await withFamily(build({ parser: new FakeExpenseParser(new CaptureNotUnderstoodError('nope')) }));

    await expect(h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME })).rejects.toThrow(CaptureNotUnderstoodError);
    expect(h.captures.all()).toEqual([]);
  });

  it('refuses once the family has used its monthly allowance, before spending anything', async () => {
    h = await withFamily(build({ cap: 2 }));
    h.usage.set(FAMILY, { year: 2026, month: 11 }, 2);

    await expect(h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME })).rejects.toThrow(CaptureCapReachedError);
    expect(h.stt.calls).toEqual([]);
    expect(h.captures.all()).toEqual([]);
  });

  it('counts a recording against the family month only once it worked', async () => {
    await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    expect(await h.usage.countThisMonth(FAMILY, { year: 2026, month: 11 })).toEqual({ voiceCount: 1, voiceSeconds: 12 });
  });

  it('does not count a recording the parse could not read', async () => {
    h = await withFamily(build({ parser: new FakeExpenseParser([]) }));

    await expect(h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME })).rejects.toThrow(CaptureNotUnderstoodError);
    expect(await h.usage.countThisMonth(FAMILY, { year: 2026, month: 11 })).toEqual({ voiceCount: 0, voiceSeconds: 0 });
  });
});

describe('CaptureVoiceUseCase — the parse context', () => {
  it('always offers the Miscellaneous item, creating it if the family has none', async () => {
    const h = await withFamily(build());

    await h.useCase.execute({ actor: member, audio: AUDIO, mimeType: MIME });

    expect(h.parser.lastContext.items.map((i) => i.name)).toContain(MISCELLANEOUS_NAME);
  });

  it("carries today's date in the family's time zone, and its currency", async () => {
    const h = await withFamily(build());

    await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    expect(h.parser.lastContext).toMatchObject({ today: TODAY, currencyCode: 'INR', minorUnits: 2 });
  });

  it("offers this year's open bill lines with what has been paid so far", async () => {
    const h = await withFamily(build());
    await h.yearPlans.create(yearPlan([yearLine({})]));
    h.yearPaid.set(FAMILY, 2026, 'line-bike', 50000);

    await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    expect(h.parser.lastContext.yearLines).toEqual([
      { id: 'line-bike', name: 'Bike Insurance', plannedMinor: 150000, paidMinor: 50000, dueMonth: 11 },
    ]);
  });

  it('leaves out a bill that is already done, so it cannot be paid twice by voice', async () => {
    const h = await withFamily(build());
    await h.yearPlans.create(yearPlan([yearLine({}), yearLine({ id: 'line-done', name: 'Car Insurance', state: 'done' })]));

    await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    expect(h.parser.lastContext.yearLines.map((l) => l.id)).toEqual(['line-bike']);
  });

  it('leaves out a bill that is already fully paid, so it is never offered to be paid again', async () => {
    const h = await withFamily(build());
    await h.yearPlans.create(yearPlan([yearLine({}), yearLine({ id: 'line-other', name: 'Car Insurance' })]));
    h.yearPaid.set(FAMILY, 2026, 'line-bike', 150000); // the whole ₹1,500 is paid

    await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    expect(h.parser.lastContext.yearLines.map((l) => l.id)).toEqual(['line-other']);
  });

  it('still offers a part-paid bill, because something is still owed', async () => {
    const h = await withFamily(build());
    await h.yearPlans.create(yearPlan([yearLine({})]));
    h.yearPaid.set(FAMILY, 2026, 'line-bike', 50000);

    await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    expect(h.parser.lastContext.yearLines.map((l) => l.id)).toEqual(['line-bike']);
  });

  it('leaves out a cancelled bill', async () => {
    const h = await withFamily(build());
    await h.yearPlans.create(yearPlan([yearLine({ state: 'cancelled' })]));

    await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    expect(h.parser.lastContext.yearLines).toEqual([]);
  });

  it('offers no bills at all when the family has no plan for this year yet', async () => {
    const h = await withFamily(build());

    await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    expect(h.parser.lastContext.yearLines).toEqual([]);
  });

  it('names each item with the group it sits in', async () => {
    const h = await withFamily(build());
    await h.planUow.plan.saveGroup({ id: 'g-food', familyId: FAMILY, kind: 'monthly', name: 'Food & Dining', sort: 0, archived: false });
    await h.planUow.plan.saveItem({ id: 'i-groc', familyId: FAMILY, groupId: 'g-food', kind: 'monthly', name: 'Groceries', sort: 0, archived: false, seedKey: 'groceries' });

    await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    expect(h.parser.lastContext.items).toContainEqual({ id: 'i-groc', name: 'Groceries', group: 'Food & Dining' });
  });

  it('leaves out an archived item and anything that is not monthly spending', async () => {
    const h = await withFamily(build());
    await h.planUow.plan.saveGroup({ id: 'g-food', familyId: FAMILY, kind: 'monthly', name: 'Food & Dining', sort: 0, archived: false });
    await h.planUow.plan.saveGroup({ id: 'g-sav', familyId: FAMILY, kind: 'savings', name: 'Savings', sort: 1, archived: false });
    await h.planUow.plan.saveItem({ id: 'i-old', familyId: FAMILY, groupId: 'g-food', kind: 'monthly', name: 'Old', sort: 1, archived: true, seedKey: null });
    await h.planUow.plan.saveItem({ id: 'i-gold', familyId: FAMILY, groupId: 'g-sav', kind: 'savings', name: 'Gold', sort: 0, archived: false, seedKey: 'gold' });

    await h.useCase.execute({ actor: admin, audio: AUDIO, mimeType: MIME });

    const ids = h.parser.lastContext.items.map((i) => i.id);
    expect(ids).not.toContain('i-old');
    expect(ids).not.toContain('i-gold');
  });
});
