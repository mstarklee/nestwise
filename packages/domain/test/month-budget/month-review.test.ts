import { beforeEach, describe, expect, it } from 'vitest';
import { sampleFamily } from '../../../../fixtures/sample-family';
import { samplePlanImport } from '../../../../fixtures/sample-plan-import';
import { ListInboxUseCase } from '../../src/duplicates';
import { RecordExpenseUseCase, type Transaction } from '../../src/expenses';
import {
  AutoCloseMonthUseCase,
  CloseMonthUseCase,
  EnsureMonthBudgetUseCase,
  GetMonthReviewUseCase,
  GetMonthSummaryUseCase,
  InvalidMonthCommandError,
  MonthAlreadyClosedError,
  overStreaks,
} from '../../src/month-budget';
import { ImportPlanUseCase } from '../../src/plan';
import { GetChecklistUseCase } from '../../src/pot';
import { type Actor, type IsoDate, NotAllowedError, type Period } from '../../src/shared';
import { EnsureYearPlanUseCase, GetYearPlanUseCase } from '../../src/year-plan';
import { familyRecord } from '../fakes/family-record';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryExpensesUnitOfWork, InMemoryTransactionGateway } from '../fakes/in-memory-expenses-gateways';
import { InMemoryFamilyGateway, InMemoryMembershipGateway } from '../fakes/in-memory-family-gateways';
import { InMemoryMonthBudgetGateway, InMemoryMonthBudgetUnitOfWork } from '../fakes/in-memory-month-budget-gateways';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { InMemoryPotGateway } from '../fakes/in-memory-pot-gateways';
import { InMemoryYearPlanGateway } from '../fakes/in-memory-year-plan-gateways';
import { InMemoryCaptureGateway } from '../fakes/in-memory-capture-gateways';
import { SequentialIds } from '../fakes/sequential-ids';

const admin: Actor = { userId: 'u1', familyId: 'f1', role: 'admin' };
const member: Actor = { userId: 'u2', familyId: 'f1', role: 'member' };
const AUG: Period = { year: 2026, month: 8 };
const SEP: Period = { year: 2026, month: 9 };
const OCT: Period = { year: 2026, month: 10 };
const date = (value: string) => value as IsoDate;

let ledger: InMemoryTransactionGateway;
let expensesUow: InMemoryExpensesUnitOfWork;
let budgets: InMemoryMonthBudgetGateway;
let monthUow: InMemoryMonthBudgetUnitOfWork;
let yearPlans: InMemoryYearPlanGateway;
let pot: InMemoryPotGateway;
let clock: FixedClock;
let ensureMonth: EnsureMonthBudgetUseCase;
let review: GetMonthReviewUseCase;
let close: CloseMonthUseCase;
let autoClose: AutoCloseMonthUseCase;
let record: RecordExpenseUseCase;
let itemId: (seedKey: string) => string;
let seq = 0;

function spent(itemKey: string, amountMinor: number, txnDate: string, overrides: Partial<Transaction> = {}): void {
  seq += 1;
  const id = `0190a000-0000-7000-8000-${String(seq).padStart(12, '0')}`;
  const t: Transaction = {
    id,
    familyId: 'f1',
    kind: 'expense',
    amountMinor,
    currencyCode: 'INR',
    txnDate: date(txnDate),
    period: { year: Number(txnDate.slice(0, 4)), month: Number(txnDate.slice(5, 7)) },
    merchant: null,
    note: null,
    enteredBy: 'u1',
    paidBy: 'u1',
    captureMethod: 'typed',
    status: 'confirmed',
    mergedInto: null,
    allocations: [{ itemId: itemId(itemKey), amountMinor, planYear: itemKey === 'car_ins' || itemKey === 'school_t2' ? 2026 : null }],
    entryTimeZone: 'Asia/Kolkata',
    deletedAt: null,
    createdAt: clock.now(),
    updatedAt: clock.now(),
    ...overrides,
  };
  ledger.rows.set(id, t);
}

beforeEach(async () => {
  seq = 0;
  const planUow = new InMemoryPlanUnitOfWork();
  const ids = new SequentialIds();
  clock = new FixedClock('2026-11-01T04:00:00Z');
  await new ImportPlanUseCase(planUow, planUow.plan, ids, clock).execute({ actor: admin, plan: samplePlanImport });
  const items = await planUow.plan.listItems('f1', { includeArchived: true });
  itemId = (seedKey) => items.find((i) => i.seedKey === seedKey)!.id;

  const families = new InMemoryFamilyGateway();
  await families.save(familyRecord());
  const memberships = new InMemoryMembershipGateway();
  for (const userId of ['u1', 'u2']) await memberships.save({ userId, familyId: 'f1', role: 'admin', joinedAt: clock.now() });

  budgets = new InMemoryMonthBudgetGateway();
  monthUow = new InMemoryMonthBudgetUnitOfWork(budgets);
  ledger = new InMemoryTransactionGateway();
  expensesUow = new InMemoryExpensesUnitOfWork(ledger, budgets);
  ensureMonth = new EnsureMonthBudgetUseCase(budgets, planUow.plan, ids);
  const summary = new GetMonthSummaryUseCase(ensureMonth, ledger.actuals(), planUow.plan);
  yearPlans = new InMemoryYearPlanGateway();
  const ensureYear = new EnsureYearPlanUseCase(yearPlans, planUow.plan, ids);
  await ensureYear.execute({ familyId: 'f1', year: 2026 });
  const yearView = new GetYearPlanUseCase(ensureYear, yearPlans, ledger.yearPaid(yearPlans), families, clock);
  pot = new InMemoryPotGateway();
  const checklist = new GetChecklistUseCase(ensureMonth, yearPlans, planUow.plan, families, pot);
  const inbox = new ListInboxUseCase(expensesUow.duplicates, ledger, new InMemoryCaptureGateway());
  review = new GetMonthReviewUseCase(summary, budgets, ledger, planUow.plan, yearView, checklist, inbox, families);
  close = new CloseMonthUseCase(monthUow, families, clock);
  autoClose = new AutoCloseMonthUseCase(monthUow, clock);
  record = new RecordExpenseUseCase(expensesUow, ledger, planUow.plan, memberships, families, ensureMonth, clock, new SequentialIds('match'));

  await ensureMonth.execute({ familyId: 'f1', period: OCT });
  for (const t of sampleFamily.october2026Transactions) spent(t.itemKey, t.amountMinor, t.date);
  for (const p of sampleFamily.october2026YearlyPayments) spent(p.itemKey, p.amountMinor, p.date);
});

describe('GetMonthReviewUseCase', () => {
  it('October: ₹84,450 of ₹81,500, +₹2,950; Groceries +₹2,000 leads the overs, Fruits −₹500 is under (PRD §7 test 8 data)', async () => {
    const r = await review.execute({ actor: member, period: OCT });
    expect(r.totals).toMatchObject({ plannedMinor: 8_150_000, actualMinor: 8_445_000, varianceMinor: 295_000 });
    expect(r.over[0]).toMatchObject({ itemId: itemId('groceries'), varianceMinor: 200_000 });
    expect(r.over).toHaveLength(3);
    expect(r.under.map((l) => l.itemId)).toContain(itemId('fruits'));
    expect(r.under.every((l) => l.varianceMinor < 0)).toBe(true);
    expect(r.status).toBe('active');
  });

  it('lists car insurance and school fees as bills paid in October; an unpaid due bill appears as unpaid', async () => {
    const plan = (await yearPlans.findByYear('f1', 2026))!;
    const tour = plan.lines.find((l) => l.itemId === itemId('tour'))!;
    await yearPlans.saveLine({ ...tour, dueMonth: 10 });
    const r = await review.execute({ actor: admin, period: OCT });
    expect(r.billsPaid).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: itemId('car_ins'), paidMinor: 650_000 }),
        expect.objectContaining({ itemId: itemId('school_t2'), paidMinor: 3_000_000 }),
      ]),
    );
    expect(r.billsUnpaid).toEqual([expect.objectContaining({ lineId: tour.id, remainingMinor: tour.plannedMinor })]);
  });

  it('savings show done, different, skipped or unanswered from the checklist', async () => {
    const save = (key: string, amountMinor: number) =>
      pot.savings.push({ id: key, familyId: 'f1', itemId: itemId(key), period: OCT, amountMinor, createdBy: 'u1', createdAt: clock.now() });
    save('rd', 200_000);
    save('gold', 1_200_000);
    let r = await review.execute({ actor: admin, period: OCT });
    expect(r.savings).toEqual([
      expect.objectContaining({ itemId: itemId('rd'), answer: 'done', amountMinor: 200_000 }),
      expect.objectContaining({ itemId: itemId('gold'), answer: 'different', amountMinor: 1_200_000 }),
    ]);
    expect(r.potDeposit).toBe('unanswered');
    pot.savings = [];
    pot.skips.push({ id: 's', familyId: 'f1', period: OCT, itemId: itemId('rd'), createdBy: 'u1', createdAt: clock.now() });
    r = await review.execute({ actor: admin, period: OCT });
    expect(r.savings.map((s) => s.answer)).toEqual(['skipped', 'unanswered']);
  });

  it('Groceries over in Aug, Sep and Oct gives a streak of 3 with a suggestion; over only in Sep and Oct gives none', async () => {
    await ensureMonth.execute({ familyId: 'f1', period: SEP });
    spent('groceries', 850_000, '2026-09-05');
    expect((await review.execute({ actor: admin, period: OCT })).streaks).toEqual([]);
    await ensureMonth.execute({ familyId: 'f1', period: AUG });
    spent('groceries', 870_000, '2026-08-05');
    expect((await review.execute({ actor: admin, period: OCT })).streaks).toEqual([
      // Highest over the three months is October's ₹10,000, rounded up to the next ₹100.
      { itemId: itemId('groceries'), name: 'Groceries', months: 3, suggestedMinor: 1_000_000 },
    ]);
  });

  it('never creates budgets for earlier months just to look for a streak', async () => {
    await review.execute({ actor: admin, period: OCT });
    expect(await budgets.findByPeriod('f1', SEP)).toBeUndefined();
  });

  it('counts Inbox entries for the month', async () => {
    const groceries = itemId('groceries');
    const spend = { amountMinor: 12_300, txnDate: date('2026-10-20'), allocations: [{ itemId: groceries, amountMinor: 12_300 }] };
    await record.execute({ ...spend, actor: admin, id: '0190a000-0000-7000-8000-000000000901' });
    await record.execute({ ...spend, actor: member, id: '0190a000-0000-7000-8000-000000000902' });
    expect((await review.execute({ actor: admin, period: OCT })).inboxCount).toBe(1);
  });
});

describe('overStreaks', () => {
  it('needs the last N months over plan for the same item, rounding the suggestion up to a step', () => {
    const month = (actualMinor: number) => ({ lines: [{ itemId: 'g', name: 'Groceries', plannedMinor: 800_000, actualMinor }] });
    expect(overStreaks([month(810_000), month(850_001), month(900_000)], 3, 10_000)).toEqual([
      { itemId: 'g', name: 'Groceries', months: 3, suggestedMinor: 900_000 },
    ]);
    expect(overStreaks([month(800_000), month(850_000), month(900_000)], 3, 10_000)).toEqual([]);
    expect(overStreaks([month(850_000), month(900_000)], 3, 10_000)).toEqual([]);
  });
});

describe('CloseMonthUseCase', () => {
  it('an Admin closes October once; a second close is refused; a member cannot; the current month cannot', async () => {
    await expect(close.execute({ actor: member, period: OCT })).rejects.toBeInstanceOf(NotAllowedError);
    await close.execute({ actor: admin, period: OCT });
    expect((await budgets.findByPeriod('f1', OCT))!.status).toBe('closed');
    expect(monthUow.activity.all().at(-1)).toMatchObject({ action: 'month.close', actorId: 'u1' });
    await expect(close.execute({ actor: admin, period: OCT })).rejects.toBeInstanceOf(MonthAlreadyClosedError);
    await expect(close.execute({ actor: admin, period: { year: 2026, month: 11 } })).rejects.toBeInstanceOf(InvalidMonthCommandError);
  });

  it('an expense dated 30 Oct recorded on 11 Nov after October closed is saved, counted, and marked late (Review Focus 3)', async () => {
    await close.execute({ actor: admin, period: OCT });
    clock.set('2026-11-11T04:00:00Z');
    const groceries = itemId('groceries');
    const { transaction } = await record.execute({
      actor: admin,
      id: '0190a000-0000-7000-8000-000000000999',
      amountMinor: 5_000,
      txnDate: date('2026-10-30'),
      allocations: [{ itemId: groceries, amountMinor: 5_000 }],
    });
    expect(transaction.status).toBe('confirmed');
    expect((await review.execute({ actor: admin, period: OCT })).totals.actualMinor).toBe(8_450_000);
    expect(expensesUow.activity.all().at(-1)).toMatchObject({ action: 'expense.record', lateEdit: true });
  });
});

describe('AutoCloseMonthUseCase', () => {
  it('on or after the 10th closes last month if still open, once', async () => {
    expect(await autoClose.execute({ familyId: 'f1', today: date('2026-11-09') })).toBe(false);
    expect(await autoClose.execute({ familyId: 'f1', today: date('2026-11-10') })).toBe(true);
    expect((await budgets.findByPeriod('f1', OCT))!.status).toBe('closed');
    expect(await autoClose.execute({ familyId: 'f1', today: date('2026-11-11') })).toBe(false);
  });

  it('does nothing when last month has no budget', async () => {
    expect(await autoClose.execute({ familyId: 'f1', today: date('2026-10-12') })).toBe(false);
    expect(await budgets.findByPeriod('f1', SEP)).toBeUndefined();
  });
});
