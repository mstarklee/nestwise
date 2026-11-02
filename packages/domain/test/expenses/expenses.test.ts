import { beforeEach, describe, expect, it } from 'vitest';
import { samplePlanImport } from '../../../../fixtures/sample-plan-import';
import {
  DeleteExpenseUseCase,
  EditExpenseUseCase,
  ExpenseItemNotFoundError,
  ExpenseNotRestorableError,
  InvalidExpenseCommandError,
  ItemNotUsableError,
  ListExpensesUseCase,
  type RecordExpenseCommand,
  RecordExpenseUseCase,
  RestoreExpenseUseCase,
  TransactionNotFoundError,
} from '../../src/expenses';
import { EnsureMonthBudgetUseCase, GetMonthSummaryUseCase } from '../../src/month-budget';
import { ArchiveItemUseCase, ImportPlanUseCase } from '../../src/plan';
import { GetPotBalanceUseCase } from '../../src/pot';
import { type Actor, type IsoDate, NotAllowedError, parseMinor } from '../../src/shared';
import { EnsureYearPlanUseCase, GetYearPlanUseCase } from '../../src/year-plan';
import { familyRecord } from '../fakes/family-record';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryExpensesUnitOfWork, InMemoryTransactionGateway } from '../fakes/in-memory-expenses-gateways';
import { InMemoryFamilyGateway, InMemoryMembershipGateway } from '../fakes/in-memory-family-gateways';
import { InMemoryMonthBudgetGateway } from '../fakes/in-memory-month-budget-gateways';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { InMemoryPotGateway } from '../fakes/in-memory-pot-gateways';
import { InMemoryYearPlanGateway } from '../fakes/in-memory-year-plan-gateways';
import { SequentialIds } from '../fakes/sequential-ids';

const admin: Actor = { userId: 'u1', familyId: 'f1', role: 'admin' };
const spouse: Actor = { userId: 'u2', familyId: 'f1', role: 'admin' };
const viewer: Actor = { userId: 'u3', familyId: 'f1', role: 'viewer' };
const OCT = { year: 2026, month: 10 };
const NOV = { year: 2026, month: 11 };
const uuid = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const date = (value: string) => value as IsoDate;

let planUow: InMemoryPlanUnitOfWork;
let ledger: InMemoryTransactionGateway;
let uow: InMemoryExpensesUnitOfWork;
let budgets: InMemoryMonthBudgetGateway;
let yearPlans: InMemoryYearPlanGateway;
let clock: FixedClock;
let record: RecordExpenseUseCase;
let edit: EditExpenseUseCase;
let remove: DeleteExpenseUseCase;
let restore: RestoreExpenseUseCase;
let list: ListExpensesUseCase;
let summary: GetMonthSummaryUseCase;
let yearView: GetYearPlanUseCase;
let potBalance: GetPotBalanceUseCase;
let itemId: (seedKey: string) => string;

beforeEach(async () => {
  planUow = new InMemoryPlanUnitOfWork();
  const ids = new SequentialIds();
  clock = new FixedClock('2026-11-08T06:00:00Z');
  await new ImportPlanUseCase(planUow, planUow.plan, ids, clock).execute({ actor: admin, plan: samplePlanImport });
  const items = await planUow.plan.listItems('f1', { includeArchived: true });
  itemId = (seedKey) => items.find((i) => i.seedKey === seedKey)!.id;

  const families = new InMemoryFamilyGateway();
  await families.save(familyRecord());
  const memberships = new InMemoryMembershipGateway();
  for (const [userId, familyId] of [['u1', 'f1'], ['u2', 'f1'], ['u3', 'f1'], ['u9', 'f2']] as const) {
    await memberships.save({ userId, familyId, role: 'admin', joinedAt: clock.now() });
  }

  ledger = new InMemoryTransactionGateway();
  uow = new InMemoryExpensesUnitOfWork(ledger);
  budgets = new InMemoryMonthBudgetGateway();
  const ensureMonth = new EnsureMonthBudgetUseCase(budgets, planUow.plan, ids);
  record = new RecordExpenseUseCase(uow, ledger, planUow.plan, memberships, families, ensureMonth, clock);
  edit = new EditExpenseUseCase(uow, ledger, planUow.plan, memberships, ensureMonth, clock);
  remove = new DeleteExpenseUseCase(uow, ledger, clock);
  restore = new RestoreExpenseUseCase(uow, ledger, clock);
  list = new ListExpensesUseCase(ledger);
  summary = new GetMonthSummaryUseCase(ensureMonth, ledger.actuals(), planUow.plan);

  yearPlans = new InMemoryYearPlanGateway();
  const ensureYear = new EnsureYearPlanUseCase(yearPlans, planUow.plan, ids);
  await ensureYear.execute({ familyId: 'f1', year: 2026 });
  yearView = new GetYearPlanUseCase(ensureYear, yearPlans, ledger.yearPaid(yearPlans), families, clock);
  const pot = new InMemoryPotGateway();
  const yearly = new Set(items.filter((i) => i.kind === 'yearly').map((i) => i.id));
  pot.yearlySpendMinor = async (familyId) => ledger.yearlySpend(familyId, (id) => yearly.has(id));
  potBalance = new GetPotBalanceUseCase(pot);
});

const groceries945 = (overrides: Partial<RecordExpenseCommand> = {}): RecordExpenseCommand => ({
  actor: admin,
  id: uuid(1),
  amountMinor: 94_500,
  txnDate: date('2026-10-07'),
  merchant: 'Local grocery shop',
  allocations: [
    { itemId: itemId('groceries'), amountMinor: 80_000 },
    { itemId: itemId('soaps'), amountMinor: 14_500 },
  ],
  ...overrides,
});

const actual = async (period: typeof OCT, seedKey: string) =>
  (await summary.execute({ actor: admin, period })).lines.find((l) => l.itemId === itemId(seedKey))!.actualMinor;
const yearLine = async (seedKey: string) => (await yearView.execute({ actor: admin, year: 2026 })).lines.find((l) => l.itemId === itemId(seedKey))!;

describe('RecordExpenseUseCase', () => {
  it('records ₹945 split 800 groceries + 145 soaps; period 2026-10; enteredBy = actor', async () => {
    const { transaction: saved } = await record.execute(groceries945({ paidBy: 'u2' }));
    expect(saved).toMatchObject({
      id: uuid(1),
      familyId: 'f1',
      kind: 'expense',
      amountMinor: 94_500,
      currencyCode: 'INR',
      txnDate: '2026-10-07',
      period: OCT,
      merchant: 'Local grocery shop',
      note: null,
      enteredBy: 'u1',
      paidBy: 'u2',
      captureMethod: 'typed',
      status: 'confirmed',
      entryTimeZone: 'Asia/Kolkata',
      deletedAt: null,
    });
    expect(saved.allocations).toEqual([
      { itemId: itemId('groceries'), amountMinor: 80_000, planYear: null },
      { itemId: itemId('soaps'), amountMinor: 14_500, planYear: null },
    ]);
    expect(await actual(OCT, 'groceries')).toBe(80_000);
    expect(uow.activity.all()).toMatchObject([{ action: 'expense.record', entityId: uuid(1), before: null, after: { amountMinor: 94_500 } }]);
  });

  it('returns the existing expense for a repeated client id; still one stored', async () => {
    const first = await record.execute(groceries945());
    const again = await record.execute(groceries945({ amountMinor: 1, allocations: [{ itemId: itemId('groceries'), amountMinor: 1 }] }));
    expect(first.created).toBe(true);
    expect(again).toEqual({ transaction: first.transaction, created: false });
    expect(ledger.count()).toBe(1);
    expect(uow.activity.count()).toBe(1);
  });

  it('refuses allocations that do not add up, an archived item, another family’s item, a viewer — nothing saved', async () => {
    await new ArchiveItemUseCase(planUow, planUow.plan, clock).execute({ actor: admin, itemId: itemId('ott') });
    const refusals: [RecordExpenseCommand, new (...args: never[]) => Error][] = [
      [groceries945({ amountMinor: 95_000 }), InvalidExpenseCommandError],
      [groceries945({ allocations: [] }), InvalidExpenseCommandError],
      [groceries945({ amountMinor: 0, allocations: [{ itemId: itemId('groceries'), amountMinor: 0 }] }), InvalidExpenseCommandError],
      [groceries945({ allocations: [{ itemId: itemId('groceries'), amountMinor: 50_000 }, { itemId: itemId('groceries'), amountMinor: 44_500 }] }), InvalidExpenseCommandError],
      [groceries945({ id: 'not-a-uuid' }), InvalidExpenseCommandError],
      [groceries945({ txnDate: date('2026-02-30') }), InvalidExpenseCommandError],
      [groceries945({ paidBy: 'u9' }), InvalidExpenseCommandError],
      [groceries945({ allocations: [{ itemId: itemId('ott'), amountMinor: 94_500 }] }), ItemNotUsableError],
      [groceries945({ allocations: [{ itemId: itemId('gold'), amountMinor: 94_500 }] }), ItemNotUsableError],
      [groceries945({ allocations: [{ itemId: 'item-of-f2', amountMinor: 94_500 }] }), ExpenseItemNotFoundError],
      [groceries945({ actor: viewer }), NotAllowedError],
    ];
    for (const [command, error] of refusals) await expect(record.execute(command)).rejects.toBeInstanceOf(error);
    expect(ledger.count()).toBe(0);
    expect(uow.activity.count()).toBe(0);
  });

  it('saves nothing when the activity write fails', async () => {
    uow.failActivity = true;
    await expect(record.execute(groceries945())).rejects.toThrow('activity write failed');
    expect(ledger.count()).toBe(0);
  });

  it('with no date, an expense entered at 00:30 IST on 1 Nov belongs to November (Review Focus 1)', async () => {
    clock.set('2026-10-31T19:00:00Z');
    const { transaction } = await record.execute(groceries945({ txnDate: undefined }));
    expect(transaction).toMatchObject({ txnDate: '2026-11-01', period: NOV });
  });

  it('stores ₹204.50 as 20450 exactly', async () => {
    const amountMinor = parseMinor(' 204.50 ', 2);
    const { transaction: saved } = await record.execute(groceries945({ amountMinor, allocations: [{ itemId: itemId('fruits'), amountMinor }] }));
    expect(saved.amountMinor).toBe(20_450);
    expect(await actual(OCT, 'fruits')).toBe(20_450);
  });

  it('a back-dated expense into a month with no budget creates that month from the template (Review Focus 5)', async () => {
    const aug2025 = { year: 2025, month: 8 };
    expect(await budgets.findByPeriod('f1', aug2025)).toBeUndefined();
    await record.execute(groceries945({ txnDate: date('2025-08-14') }));
    expect((await budgets.findByPeriod('f1', aug2025))!.createdFrom).toBe('template');
    expect(await actual(aug2025, 'groceries')).toBe(80_000);
  });

  it('paying Deepavali clothing (yearly) reduces the pot and the line’s remaining; deleting it restores both (Review Focus 4)', async () => {
    const pay = (id: number, amountMinor: number) =>
      record.execute({ actor: admin, id: uuid(id), amountMinor, txnDate: date('2026-11-07'), allocations: [{ itemId: itemId('diwali_dress'), amountMinor }] });
    const { transaction: first } = await pay(10, 400_000);
    expect(first.allocations[0]!.planYear).toBe(2026);
    expect(await yearLine('diwali_dress')).toMatchObject({ paidMinor: 400_000, remainingMinor: 100_000, status: 'part_paid' });
    expect((await potBalance.execute({ actor: admin })).balanceMinor).toBe(-400_000);
    expect(await actual(NOV, 'groceries')).toBe(0); // yearly money is not monthly spending

    await pay(11, 100_000);
    expect(await yearLine('diwali_dress')).toMatchObject({ remainingMinor: 0, status: 'paid' });
    await remove.execute({ actor: admin, id: uuid(11) });
    expect(await yearLine('diwali_dress')).toMatchObject({ paidMinor: 400_000, remainingMinor: 100_000, status: 'part_paid' });
    expect((await potBalance.execute({ actor: admin })).balanceMinor).toBe(-400_000);

    await record.execute({ actor: admin, id: uuid(12), kind: 'refund', amountMinor: 50_000, txnDate: date('2026-11-09'), allocations: [{ itemId: itemId('diwali_dress'), amountMinor: 50_000 }] });
    expect(await yearLine('diwali_dress')).toMatchObject({ paidMinor: 350_000, remainingMinor: 150_000 });
    expect((await potBalance.execute({ actor: admin })).balanceMinor).toBe(-350_000);
  });

  it('a refund of 300 against groceries lowers that month’s actual by 300', async () => {
    await record.execute(groceries945());
    await record.execute({ actor: spouse, id: uuid(2), kind: 'refund', amountMinor: 30_000, txnDate: date('2026-10-09'), allocations: [{ itemId: itemId('groceries'), amountMinor: 30_000 }] });
    expect(await actual(OCT, 'groceries')).toBe(50_000);
  });
});

describe('EditExpenseUseCase', () => {
  it('moving the date from 31 Oct to 1 Nov moves the actual between months with no double count', async () => {
    await record.execute(groceries945({ txnDate: date('2026-10-31') }));
    const moved = await edit.execute({ actor: spouse, id: uuid(1), changes: { txnDate: date('2026-11-01') } });
    expect(moved.period).toEqual(NOV);
    expect(await actual(OCT, 'groceries')).toBe(0);
    expect(await actual(NOV, 'groceries')).toBe(80_000);
    expect(ledger.count()).toBe(1);
    expect(uow.activity.all().at(-1)).toMatchObject({ action: 'expense.edit', actorId: 'u2', before: { txnDate: '2026-10-31' }, after: { txnDate: '2026-11-01' } });
  });

  it('a single-item expense follows a new amount; a split needs new allocations', async () => {
    await record.execute(groceries945({ allocations: [{ itemId: itemId('groceries'), amountMinor: 94_500 }] }));
    expect((await edit.execute({ actor: admin, id: uuid(1), changes: { amountMinor: 90_000 } })).allocations).toEqual([
      { itemId: itemId('groceries'), amountMinor: 90_000, planYear: null },
    ]);
    await record.execute(groceries945({ id: uuid(2) }));
    await expect(edit.execute({ actor: admin, id: uuid(2), changes: { amountMinor: 90_000 } })).rejects.toBeInstanceOf(InvalidExpenseCommandError);
    const resplit = await edit.execute({
      actor: admin,
      id: uuid(2),
      changes: { amountMinor: 90_000, allocations: [{ itemId: itemId('groceries'), amountMinor: 90_000 }], merchant: null, note: 'fixed' },
    });
    expect(resplit).toMatchObject({ amountMinor: 90_000, merchant: null, note: 'fixed' });
  });

  it('cannot edit an unknown or deleted expense, and a viewer cannot edit', async () => {
    await record.execute(groceries945());
    await expect(edit.execute({ actor: viewer, id: uuid(1), changes: { note: 'x' } })).rejects.toBeInstanceOf(NotAllowedError);
    await expect(edit.execute({ actor: admin, id: uuid(5), changes: { note: 'x' } })).rejects.toBeInstanceOf(TransactionNotFoundError);
    await remove.execute({ actor: admin, id: uuid(1) });
    await expect(edit.execute({ actor: admin, id: uuid(1), changes: { note: 'x' } })).rejects.toBeInstanceOf(TransactionNotFoundError);
  });
});

describe('DeleteExpenseUseCase and RestoreExpenseUseCase', () => {
  it('deletes softly, restores within 30 days; restore after 30 days is refused', async () => {
    await record.execute(groceries945());
    await remove.execute({ actor: admin, id: uuid(1) });
    expect(await actual(OCT, 'groceries')).toBe(0);
    expect(ledger.count()).toBe(1);

    clock.set('2026-12-08T05:59:00Z'); // 29 days 23:59 later
    await restore.execute({ actor: admin, id: uuid(1) });
    expect(await actual(OCT, 'groceries')).toBe(80_000);

    await remove.execute({ actor: admin, id: uuid(1) });
    clock.set('2027-01-07T12:00:00Z');
    await expect(restore.execute({ actor: admin, id: uuid(1) })).rejects.toBeInstanceOf(ExpenseNotRestorableError);
    expect(await actual(OCT, 'groceries')).toBe(0);
    expect(uow.activity.all().map((a) => a.action)).toEqual(['expense.record', 'expense.delete', 'expense.restore', 'expense.delete']);
  });
});

describe('ListExpensesUseCase', () => {
  it('lists the month’s live expenses, newest first, by item or by who entered them', async () => {
    await record.execute(groceries945());
    await record.execute({ actor: spouse, id: uuid(2), amountMinor: 20_450, txnDate: date('2026-10-09'), allocations: [{ itemId: itemId('fruits'), amountMinor: 20_450 }] });
    await record.execute({ actor: spouse, id: uuid(3), amountMinor: 100, txnDate: date('2026-11-01'), allocations: [{ itemId: itemId('fruits'), amountMinor: 100 }] });
    await record.execute({ actor: admin, id: uuid(4), amountMinor: 100, txnDate: date('2026-10-10'), allocations: [{ itemId: itemId('fruits'), amountMinor: 100 }] });
    await remove.execute({ actor: admin, id: uuid(4) });

    expect((await list.execute({ actor: viewer, period: OCT })).map((t) => t.id)).toEqual([uuid(2), uuid(1)]);
    expect((await list.execute({ actor: viewer, period: OCT, itemId: itemId('soaps') })).map((t) => t.id)).toEqual([uuid(1)]);
    expect((await list.execute({ actor: viewer, period: OCT, enteredBy: 'u2' })).map((t) => t.id)).toEqual([uuid(2)]);
  });
});
