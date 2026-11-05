import { beforeEach, describe, expect, it } from 'vitest';
import {
  BillAlreadyPaidError,
  BillNotPayableError,
  CaptureBatchNotFoundError,
  type CaptureBatch,
  type CaptureEntry,
  ConfirmVoiceEntriesUseCase,
  type ConfirmedEntry,
  NotYourBatchError,
} from '../../src/capture';
import { InvalidExpenseCommandError, RecordExpenseUseCase } from '../../src/expenses';
import { EnsureMonthBudgetUseCase } from '../../src/month-budget';
import { type Actor, toIsoDate } from '../../src/shared';
import type { YearLine, YearPlan } from '../../src/year-plan';
import { familyRecord } from '../fakes/family-record';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryCaptureGateway } from '../fakes/in-memory-capture-gateways';
import { InMemoryEvidenceGateway } from '../fakes/in-memory-duplicates-gateways';
import { InMemoryExpensesUnitOfWork, InMemoryTransactionGateway } from '../fakes/in-memory-expenses-gateways';
import { InMemoryFamilyGateway, InMemoryMembershipGateway } from '../fakes/in-memory-family-gateways';
import { InMemoryMonthBudgetGateway } from '../fakes/in-memory-month-budget-gateways';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { InMemoryYearPaidGateway, InMemoryYearPlanGateway } from '../fakes/in-memory-year-plan-gateways';
import { SequentialIds } from '../fakes/sequential-ids';

const FAMILY = 'f1';
const SPEAKER = 'u1';
const SPOUSE = 'u2';
const speaker: Actor = { userId: SPEAKER, familyId: FAMILY, role: 'admin' };
const spouseAdmin: Actor = { userId: SPOUSE, familyId: FAMILY, role: 'admin' };
const spouseMember: Actor = { userId: SPOUSE, familyId: FAMILY, role: 'member' };
const NOW = '2026-11-05T08:00:00Z';
const TODAY = toIsoDate('2026-11-05');
const uuid = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;

const GROCERIES = 'item-groceries';
const BIKE_ITEM = 'item-bike';
const BIKE_LINE = 'line-bike';

const entry = (over: Partial<CaptureEntry> = {}): CaptureEntry => ({
  id: uuid(1),
  amountMinor: 25000,
  itemId: GROCERIES,
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

const confirmed = (over: Partial<ConfirmedEntry> = {}): ConfirmedEntry => ({
  id: uuid(1),
  amountMinor: 25000,
  itemId: GROCERIES,
  yearLineId: null,
  kind: 'expense',
  txnDate: TODAY,
  merchant: 'KPN',
  note: '',
  paidBy: null,
  dropped: false,
  ...over,
});

const bikeLine = (over: Partial<YearLine> = {}): YearLine => ({
  id: BIKE_LINE,
  familyId: FAMILY,
  year: 2026,
  itemId: BIKE_ITEM,
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

function build() {
  const expensesUow = new InMemoryExpensesUnitOfWork(new InMemoryTransactionGateway());
  const planUow = new InMemoryPlanUnitOfWork();
  const families = new InMemoryFamilyGateway();
  const memberships = new InMemoryMembershipGateway();
  const months = new InMemoryMonthBudgetGateway();
  const yearPlans = new InMemoryYearPlanGateway();
  const yearPaid = new InMemoryYearPaidGateway();
  const captures = new InMemoryCaptureGateway();
  const evidence = new InMemoryEvidenceGateway();
  const clock = new FixedClock(NOW);

  const recordExpense = new RecordExpenseUseCase(
    expensesUow,
    expensesUow.transactions,
    planUow.plan,
    memberships,
    families,
    new EnsureMonthBudgetUseCase(months, planUow.plan, new SequentialIds('mb')),
    clock,
    new SequentialIds('dup'),
  );

  const useCase = new ConfirmVoiceEntriesUseCase(
    { captures, plan: planUow.plan, yearPlans, yearPaid, evidence, families },
    recordExpense,
    clock,
    new SequentialIds('ev'),
  );

  return { useCase, captures, evidence, expensesUow, planUow, families, memberships, yearPlans, yearPaid, clock };
}

type Harness = ReturnType<typeof build>;

async function setUp(h: Harness) {
  await h.families.save(familyRecord({ id: FAMILY }));
  await h.memberships.save({ userId: SPEAKER, familyId: FAMILY, role: 'admin', joinedAt: new Date(NOW) });
  await h.memberships.save({ userId: SPOUSE, familyId: FAMILY, role: 'admin', joinedAt: new Date(NOW) });
  await h.planUow.plan.saveGroup({ id: 'g-food', familyId: FAMILY, kind: 'monthly', name: 'Food', sort: 0, archived: false });
  await h.planUow.plan.saveItem({ id: GROCERIES, familyId: FAMILY, groupId: 'g-food', kind: 'monthly', name: 'Groceries', sort: 0, archived: false, seedKey: 'groceries' });
  await h.planUow.plan.saveGroup({ id: 'g-ins', familyId: FAMILY, kind: 'yearly', name: 'Insurance', sort: 1, archived: false });
  await h.planUow.plan.saveItem({ id: BIKE_ITEM, familyId: FAMILY, groupId: 'g-ins', kind: 'yearly', name: 'Bike Insurance', sort: 0, archived: false, seedKey: 'bike_ins' });
  return h;
}

async function stage(h: Harness, entries: readonly CaptureEntry[], over: Partial<CaptureBatch> = {}) {
  const batch: CaptureBatch = {
    id: uuid(99),
    familyId: FAMILY,
    createdBy: SPEAKER,
    transcript: 'KPN 250',
    sttModel: 'gpt-transcribe',
    parseModel: 'gpt-6.1-terra',
    entries,
    createdAt: new Date(NOW),
    resolvedAt: null,
    ...over,
  };
  await h.captures.create(batch);
  return batch;
}

describe('ConfirmVoiceEntriesUseCase — who may confirm', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setUp(build());
  });

  it('refuses the other adult, even an Admin, because they did not hear the words', async () => {
    const batch = await stage(h, [entry()]);

    await expect(h.useCase.execute({ actor: spouseAdmin, batchId: batch.id, entries: [confirmed()] })).rejects.toThrow(NotYourBatchError);
    expect([...h.expensesUow.transactions.rows.values()]).toEqual([]);
  });

  it('lets the speaker confirm', async () => {
    const batch = await stage(h, [entry()]);

    const { created } = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed()] });

    expect(created).toHaveLength(1);
  });

  it('refuses a batch that is not there, or belongs to another family', async () => {
    await expect(h.useCase.execute({ actor: speaker, batchId: uuid(77), entries: [] })).rejects.toThrow(CaptureBatchNotFoundError);
  });
});

describe('ConfirmVoiceEntriesUseCase — everyday spending', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setUp(build());
  });

  it('writes the expense with the item, shop and date, marked as captured by voice', async () => {
    const batch = await stage(h, [entry()]);

    const { created } = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed()] });

    expect(created[0]).toMatchObject({
      amountMinor: 25000,
      merchant: 'KPN',
      txnDate: TODAY,
      captureMethod: 'voice',
      status: 'confirmed',
      enteredBy: SPEAKER,
      paidBy: SPEAKER,
    });
    expect(created[0]!.allocations).toEqual([{ itemId: GROCERIES, amountMinor: 25000, planYear: null }]);
  });

  it('keeps the transcript as proof against each expense it created', async () => {
    const batch = await stage(h, [entry()]);

    const { created } = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed()] });

    expect(h.evidence.rows).toHaveLength(1);
    expect(h.evidence.rows[0]).toMatchObject({ kind: 'voice', transactionId: created[0]!.id, transcript: 'KPN 250', createdBy: SPEAKER });
  });

  it('writes nothing for a row the person removed', async () => {
    const batch = await stage(h, [entry(), entry({ id: uuid(2), amountMinor: 50000 })]);

    const { created } = await h.useCase.execute({
      actor: speaker,
      batchId: batch.id,
      entries: [confirmed(), confirmed({ id: uuid(2), amountMinor: 50000, dropped: true })],
    });

    expect(created).toHaveLength(1);
    expect(created[0]!.amountMinor).toBe(25000);
  });

  it('refuses a row whose amount was never heard', async () => {
    const batch = await stage(h, [entry({ amountMinor: null })]);

    await expect(
      h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed({ amountMinor: 0 })] }),
    ).rejects.toThrow(InvalidExpenseCommandError);
    expect([...h.expensesUow.transactions.rows.values()]).toEqual([]);
  });

  it('records the payer the person chose on the row', async () => {
    const batch = await stage(h, [entry()]);

    const { created } = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed({ paidBy: SPOUSE })] });

    expect(created[0]!.paidBy).toBe(SPOUSE);
  });

  it('asks no "same purchase?" question between two rows of the same breath', async () => {
    const batch = await stage(h, [entry(), entry({ id: uuid(2) })]);

    const { created } = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed(), confirmed({ id: uuid(2) })] });

    expect(created).toHaveLength(2);
    expect(created.every((t) => t.status === 'confirmed')).toBe(true);
    expect([...h.expensesUow.duplicates.rows.values()]).toEqual([]);
  });

  it('still asks when a voice row repeats something typed earlier', async () => {
    await new RecordExpenseUseCase(
      h.expensesUow,
      h.expensesUow.transactions,
      h.planUow.plan,
      h.memberships,
      h.families,
      new EnsureMonthBudgetUseCase(new InMemoryMonthBudgetGateway(), h.planUow.plan, new SequentialIds('mb2')),
      h.clock,
      new SequentialIds('dup2'),
    ).execute({ actor: spouseAdmin, id: uuid(50), amountMinor: 25000, txnDate: TODAY, allocations: [{ itemId: GROCERIES, amountMinor: 25000 }], merchant: 'KPN' });

    const batch = await stage(h, [entry()]);
    const { created } = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed()] });

    expect(created[0]!.status).toBe('pending');
    expect([...h.expensesUow.duplicates.rows.values()]).toHaveLength(1);
  });
});

describe('ConfirmVoiceEntriesUseCase — paying a yearly bill', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setUp(build());
    await h.yearPlans.create(yearPlan([bikeLine()]));
  });

  const billRow = (over: Partial<ConfirmedEntry> = {}) =>
    confirmed({ id: uuid(3), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill', merchant: null, ...over });

  it('records it as an allocation against the yearly item, carrying the plan year', async () => {
    const batch = await stage(h, [entry({ id: uuid(3), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill' })]);

    const { created } = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [billRow()] });

    expect(created[0]!.allocations).toEqual([{ itemId: BIKE_ITEM, amountMinor: 150000, planYear: 2026 }]);
    expect(created[0]!.captureMethod).toBe('voice');
  });

  it('leaves the line itself untouched — it is the allocation that makes it paid, never a state write', async () => {
    const batch = await stage(h, [entry({ id: uuid(3), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill' })]);

    await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [billRow()] });

    expect((await h.yearPlans.findLine(FAMILY, BIKE_LINE))!.state).toBe('open');
  });

  it('leaves the remainder owed when the amount paid is short of the plan', async () => {
    const batch = await stage(h, [entry({ id: uuid(3), amountMinor: 140000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill' })]);

    const { created } = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [billRow({ amountMinor: 140000 })] });

    expect(created[0]!.allocations[0]!.amountMinor).toBe(140000);
    // Nothing closed the line, so remainingMinor still reports the ₹100 that is owed.
    expect((await h.yearPlans.findLine(FAMILY, BIKE_LINE))!.state).toBe('open');
  });

  it('lets a Member pay a bill — no part of this needs edit_plan', async () => {
    const batch = await stage(h, [entry({ id: uuid(3), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill' })], {
      createdBy: SPOUSE,
    });

    const { created } = await h.useCase.execute({ actor: spouseMember, batchId: batch.id, entries: [billRow()] });

    expect(created).toHaveLength(1);
  });

  it('refuses a bill that is already fully paid, so it cannot be counted twice', async () => {
    h.yearPaid.set(FAMILY, 2026, BIKE_LINE, 150000);
    const batch = await stage(h, [entry({ id: uuid(3), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill' })]);

    await expect(h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [billRow()] })).rejects.toThrow(BillAlreadyPaidError);
    expect([...h.expensesUow.transactions.rows.values()]).toEqual([]);
  });

  it('refuses a bill the family already marked done', async () => {
    await h.yearPlans.saveLine(bikeLine({ state: 'done' }));
    const batch = await stage(h, [entry({ id: uuid(3), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill' })]);

    await expect(h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [billRow()] })).rejects.toThrow(BillNotPayableError);
  });

  it("refuses a line from another year's plan", async () => {
    await h.yearPlans.create(yearPlan([bikeLine({ id: 'line-old', year: 2025, dueYear: 2025 })], 2025));
    const batch = await stage(h, [entry({ id: uuid(3), amountMinor: 150000, itemId: null, yearLineId: 'line-old', kind: 'yearly_bill' })]);

    await expect(
      h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [billRow({ yearLineId: 'line-old' })] }),
    ).rejects.toThrow(BillNotPayableError);
  });

  it('refuses a bill row with no line at all', async () => {
    const batch = await stage(h, [entry({ id: uuid(3), itemId: null, yearLineId: null, kind: 'yearly_bill' })]);

    await expect(
      h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [billRow({ yearLineId: null })] }),
    ).rejects.toThrow(BillNotPayableError);
  });

  it('accepts a part payment that brings the total exactly to the plan', async () => {
    h.yearPaid.set(FAMILY, 2026, BIKE_LINE, 100000);
    const batch = await stage(h, [entry({ id: uuid(3), amountMinor: 50000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill' })]);

    const { created } = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [billRow({ amountMinor: 50000 })] });

    expect(created[0]!.allocations[0]!.amountMinor).toBe(50000);
  });
});

describe('ConfirmVoiceEntriesUseCase — one bad row must not cost the whole note', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setUp(build());
  });

  it('writes nothing and leaves the note waiting when a row names an item that is gone', async () => {
    // Realistic: the note sits in the Inbox, an Admin archives the item, then the speaker confirms.
    const batch = await stage(h, [entry(), entry({ id: uuid(2), amountMinor: 50000 })]);
    await h.planUow.plan.saveItem({ ...(await h.planUow.plan.findItem(FAMILY, GROCERIES))!, archived: true });

    await expect(
      h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed(), confirmed({ id: uuid(2), amountMinor: 50000 })] }),
    ).rejects.toThrow();

    expect([...h.expensesUow.transactions.rows.values()]).toEqual([]);
    expect(await h.captures.listWaiting(FAMILY)).toHaveLength(1);
  });

  it('writes nothing and leaves the note waiting when the SECOND row is the bad one', async () => {
    const batch = await stage(h, [entry(), entry({ id: uuid(2), amountMinor: 50000 })]);

    await expect(
      h.useCase.execute({
        actor: speaker,
        batchId: batch.id,
        entries: [confirmed(), confirmed({ id: uuid(2), amountMinor: 50000, itemId: 'item-that-never-existed' })],
      }),
    ).rejects.toThrow();

    expect([...h.expensesUow.transactions.rows.values()]).toEqual([]);
    expect((await h.captures.find(FAMILY, batch.id))!.resolvedAt).toBeNull();
  });

  it('refuses a kept expense row with no item at all, before writing anything', async () => {
    const batch = await stage(h, [entry()]);

    await expect(h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed({ itemId: null })] })).rejects.toThrow();

    expect([...h.expensesUow.transactions.rows.values()]).toEqual([]);
    expect(await h.captures.listWaiting(FAMILY)).toHaveLength(1);
  });

  it('refuses an entry that was never part of this note', async () => {
    const batch = await stage(h, [entry()]);

    await expect(
      h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed(), confirmed({ id: uuid(60), amountMinor: 99900 })] }),
    ).rejects.toThrow();

    expect([...h.expensesUow.transactions.rows.values()]).toEqual([]);
  });
});

describe('ConfirmVoiceEntriesUseCase — one bill, named twice', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setUp(build());
    await h.yearPlans.create(yearPlan([bikeLine()]));
  });

  it('refuses two rows that pay the same bill, so it cannot go out of the pot twice', async () => {
    const bill = (n: number) =>
      entry({ id: uuid(n), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill', heard: 'bike insurance 1500 paid' });
    const row = (n: number) =>
      confirmed({ id: uuid(n), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill', merchant: null });
    const batch = await stage(h, [bill(3), bill(4)]);

    await expect(h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [row(3), row(4)] })).rejects.toThrow(BillNotPayableError);

    expect([...h.expensesUow.transactions.rows.values()]).toEqual([]);
    expect(await h.captures.listWaiting(FAMILY)).toHaveLength(1);
  });

  it('allows the same bill twice if one of the two rows was removed', async () => {
    const bill = (n: number) =>
      entry({ id: uuid(n), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill' });
    const batch = await stage(h, [bill(3), bill(4)]);

    const { created } = await h.useCase.execute({
      actor: speaker,
      batchId: batch.id,
      entries: [
        confirmed({ id: uuid(3), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill', merchant: null }),
        confirmed({ id: uuid(4), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill', merchant: null, dropped: true }),
      ],
    });

    expect(created).toHaveLength(1);
  });
});

describe('ConfirmVoiceEntriesUseCase — confirming twice', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setUp(build());
  });

  it('creates the expenses once, however many times it is confirmed', async () => {
    const batch = await stage(h, [entry()]);

    const first = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed()] });
    const second = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed()] });

    expect(first.created).toHaveLength(1);
    expect(second.created).toEqual([]);
    expect([...h.expensesUow.transactions.rows.values()]).toHaveLength(1);
  });

  it('says there is nothing left to do, not "already paid", when a bill batch is confirmed twice', async () => {
    await h.yearPlans.create(yearPlan([bikeLine()]));
    const bill = entry({ id: uuid(3), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill' });
    const batch = await stage(h, [bill]);
    const row = confirmed({ id: uuid(3), amountMinor: 150000, itemId: null, yearLineId: BIKE_LINE, kind: 'yearly_bill', merchant: null });
    await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [row] });
    // The payment has now landed, so the line really is paid; a repeat must still be a quiet no-op.
    h.yearPaid.set(FAMILY, 2026, BIKE_LINE, 150000);

    const second = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [row] });

    expect(second.created).toEqual([]);
    expect([...h.expensesUow.transactions.rows.values()]).toHaveLength(1);
  });

  it('marks the batch dealt with, so it stops waiting in the Inbox', async () => {
    const batch = await stage(h, [entry()]);

    await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed()] });

    expect(await h.captures.listWaiting(FAMILY)).toEqual([]);
    expect((await h.captures.find(FAMILY, batch.id))!.resolvedAt).not.toBeNull();
  });

  it('a batch where every row was removed still stops waiting, and writes nothing', async () => {
    const batch = await stage(h, [entry()]);

    const { created } = await h.useCase.execute({ actor: speaker, batchId: batch.id, entries: [confirmed({ dropped: true })] });

    expect(created).toEqual([]);
    expect([...h.expensesUow.transactions.rows.values()]).toEqual([]);
    expect(await h.captures.listWaiting(FAMILY)).toEqual([]);
  });
});
