import { beforeEach, describe, expect, it } from 'vitest';
import { sampleFamily } from '../../../../fixtures/sample-family';
import { samplePlanImport } from '../../../../fixtures/sample-plan-import';
import {
  CopyOrBlankMonthUseCase,
  EnsureMonthBudgetUseCase,
  GetMonthSummaryUseCase,
  InvalidMonthCommandError,
  MonthHasExpensesError,
  MonthItemNotFoundError,
  SetMonthLineUseCase,
} from '../../src/month-budget';
import { AddItemUseCase, ImportPlanUseCase, UpdateItemUseCase } from '../../src/plan';
import { type Actor, NotAllowedError, sumMinor } from '../../src/shared';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryActualsGateway, InMemoryMonthBudgetGateway, InMemoryMonthBudgetUnitOfWork } from '../fakes/in-memory-month-budget-gateways';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { SequentialIds } from '../fakes/sequential-ids';

const admin: Actor = { userId: 'u1', familyId: 'f1', role: 'admin' };
const viewer: Actor = { ...admin, role: 'viewer' };
const NOV = { year: 2026, month: 11 };
const DEC = { year: 2026, month: 12 };
const JAN = { year: 2027, month: 1 };
const OCT = { year: 2026, month: 10 };

let planUow: InMemoryPlanUnitOfWork;
let budgets: InMemoryMonthBudgetGateway;
let actuals: InMemoryActualsGateway;
let uow: InMemoryMonthBudgetUnitOfWork;
let ids: SequentialIds;
let clock: FixedClock;
let ensure: EnsureMonthBudgetUseCase;
let setLine: SetMonthLineUseCase;
let copyOrBlank: CopyOrBlankMonthUseCase;
let summary: GetMonthSummaryUseCase;
let itemId: (seedKey: string) => string;

beforeEach(async () => {
  planUow = new InMemoryPlanUnitOfWork();
  ids = new SequentialIds();
  clock = new FixedClock('2026-11-01T04:00:00Z');
  await new ImportPlanUseCase(planUow, planUow.plan, ids, clock).execute({ actor: admin, plan: samplePlanImport });
  const items = await planUow.plan.listItems('f1', { includeArchived: true });
  itemId = (seedKey) => items.find((i) => i.seedKey === seedKey)!.id;

  budgets = new InMemoryMonthBudgetGateway();
  actuals = new InMemoryActualsGateway();
  uow = new InMemoryMonthBudgetUnitOfWork(budgets);
  ensure = new EnsureMonthBudgetUseCase(budgets, planUow.plan, ids);
  setLine = new SetMonthLineUseCase(uow, ensure, planUow.plan, ids, clock);
  copyOrBlank = new CopyOrBlankMonthUseCase(uow, ensure, budgets, actuals, ids, clock);
  summary = new GetMonthSummaryUseCase(ensure, actuals, planUow.plan);
});

const planned = async (period: typeof NOV, seedKey: string) =>
  (await budgets.findByPeriod('f1', period))!.lines.find((l) => l.itemId === itemId(seedKey))!.plannedMinor;

describe('EnsureMonthBudgetUseCase', () => {
  it('creates November from the monthly and savings templates once; a second ensure returns the same budget', async () => {
    const first = await ensure.execute({ familyId: 'f1', period: NOV });
    expect(first).toMatchObject({ familyId: 'f1', period: NOV, status: 'active', createdFrom: 'template' });
    expect(first.lines).toHaveLength(22); // 20 monthly + 2 savings, no yearly items
    expect(sumMinor(first.lines.filter((l) => l.kind === 'monthly').map((l) => l.plannedMinor))).toBe(8_150_000);
    expect(first.lines.find((l) => l.itemId === itemId('groceries'))).toMatchObject({ nameSnapshot: 'Groceries', groupNameSnapshot: 'Food & Dining' });
    const second = await ensure.execute({ familyId: 'f1', period: NOV });
    expect(second.id).toBe(first.id);
    expect(budgets.count()).toBe(1);
  });
});

describe('SetMonthLineUseCase', () => {
  it('editing December changes neither November nor January (AC-07)', async () => {
    await ensure.execute({ familyId: 'f1', period: NOV });
    await ensure.execute({ familyId: 'f1', period: JAN });
    await setLine.execute({ actor: admin, period: DEC, itemId: itemId('groceries'), plannedMinor: 900_000 });
    expect(await planned(DEC, 'groceries')).toBe(900_000);
    expect(await planned(NOV, 'groceries')).toBe(800_000);
    expect(await planned(JAN, 'groceries')).toBe(800_000);
    expect(uow.activity.all()).toMatchObject([{ action: 'month_line.set', familyId: 'f1' }]);
  });

  it('editing the template after November exists leaves November unchanged (AC-08)', async () => {
    await ensure.execute({ familyId: 'f1', period: NOV });
    await new UpdateItemUseCase(planUow, planUow.plan, clock).execute({ actor: admin, itemId: itemId('groceries'), template: { amountMinor: 900_000 } });
    expect(await planned(NOV, 'groceries')).toBe(800_000);
    await ensure.execute({ familyId: 'f1', period: DEC });
    expect(await planned(DEC, 'groceries')).toBe(900_000);
  });

  it('a viewer cannot set a month line; a negative amount, a yearly item or an unknown item are refused', async () => {
    await expect(setLine.execute({ actor: viewer, period: NOV, itemId: itemId('groceries'), plannedMinor: 1 })).rejects.toBeInstanceOf(NotAllowedError);
    await expect(setLine.execute({ actor: admin, period: NOV, itemId: itemId('groceries'), plannedMinor: -1 })).rejects.toBeInstanceOf(InvalidMonthCommandError);
    await expect(setLine.execute({ actor: admin, period: NOV, itemId: itemId('tour'), plannedMinor: 1 })).rejects.toBeInstanceOf(MonthItemNotFoundError);
    await expect(setLine.execute({ actor: admin, period: NOV, itemId: 'nope', plannedMinor: 1 })).rejects.toBeInstanceOf(MonthItemNotFoundError);
    expect(uow.activity.count()).toBe(0);
  });

  it('adds a line for an item created after the month was made', async () => {
    await ensure.execute({ familyId: 'f1', period: NOV });
    const food = (await planUow.plan.listGroups('f1')).find((g) => g.name === 'Food & Dining')!;
    const snacks = await new AddItemUseCase(planUow, planUow.plan, ids, clock).execute({ actor: admin, groupId: food.id, name: 'Snacks', amountMinor: 100_000 });
    await setLine.execute({ actor: admin, period: NOV, itemId: snacks.id, plannedMinor: 50_000 });
    const line = (await budgets.findByPeriod('f1', NOV))!.lines.find((l) => l.itemId === snacks.id);
    expect(line).toMatchObject({ plannedMinor: 50_000, nameSnapshot: 'Snacks', kind: 'monthly' });
  });
});

describe('GetMonthSummaryUseCase', () => {
  beforeEach(() => {
    const sums = new Map<string, number>();
    for (const t of sampleFamily.october2026Transactions) sums.set(itemId(t.itemKey), (sums.get(itemId(t.itemKey)) ?? 0) + t.amountMinor);
    // October's yearly payments are allocations to yearly items: they must not appear in monthly spending.
    for (const p of sampleFamily.october2026YearlyPayments) sums.set(itemId(p.itemKey), p.amountMinor);
    actuals.set('f1', OCT, sums);
  });

  it('month summary for the October 2026 fixture totals 84,450 vs 81,500 (+2,950)', async () => {
    const s = await summary.execute({ actor: viewer, period: OCT });
    expect(s.totals).toMatchObject({ plannedMinor: 8_150_000, actualMinor: 8_445_000, varianceMinor: 295_000 });
    expect(s.lines).toHaveLength(20);
    expect(s.lines.find((l) => l.itemId === itemId('groceries'))).toMatchObject({ name: 'Groceries', groupName: 'Food & Dining', varianceMinor: 200_000 });
    expect(s.lines.find((l) => l.itemId === itemId('fruits'))!.varianceMinor).toBe(-50_000);
    expect(s.groups.find((g) => g.groupName === 'Food & Dining')).toMatchObject({ actualMinor: 2_630_000, varianceMinor: 230_000 });
    expect(s.savings.plannedMinor).toBe(1_700_000);
    expect(s.lines.some((l) => l.itemId === itemId('car_ins'))).toBe(false);
  });

  it('shows spending on a monthly item that is not in the month as unplanned (planned 0)', async () => {
    await ensure.execute({ familyId: 'f1', period: NOV });
    const food = (await planUow.plan.listGroups('f1')).find((g) => g.name === 'Food & Dining')!;
    const snacks = await new AddItemUseCase(planUow, planUow.plan, ids, clock).execute({ actor: admin, groupId: food.id, name: 'Snacks', amountMinor: 0 });
    actuals.set('f1', NOV, new Map([[snacks.id, 5_000]]));
    const line = (await summary.execute({ actor: admin, period: NOV })).lines.find((l) => l.itemId === snacks.id);
    expect(line).toMatchObject({ plannedMinor: 0, actualMinor: 5_000, pct: null, name: 'Snacks' });
  });
});

describe('CopyOrBlankMonthUseCase', () => {
  it('copy/blank is refused once the month has an expense, and nothing changes', async () => {
    await ensure.execute({ familyId: 'f1', period: NOV });
    actuals.set('f1', NOV, new Map([[itemId('groceries'), 94_500]]));
    await expect(copyOrBlank.execute({ actor: admin, period: NOV, mode: 'blank' })).rejects.toBeInstanceOf(MonthHasExpensesError);
    expect(await planned(NOV, 'groceries')).toBe(800_000);
  });

  it('blank sets every line to 0; copy_previous takes last month’s amounts', async () => {
    await setLine.execute({ actor: admin, period: OCT, itemId: itemId('groceries'), plannedMinor: 1_000_000 });
    await copyOrBlank.execute({ actor: admin, period: NOV, mode: 'blank' });
    expect((await budgets.findByPeriod('f1', NOV))!.lines.every((l) => l.plannedMinor === 0)).toBe(true);
    expect((await budgets.findByPeriod('f1', NOV))!.createdFrom).toBe('blank');
    await copyOrBlank.execute({ actor: admin, period: NOV, mode: 'copy_previous' });
    expect(await planned(NOV, 'groceries')).toBe(1_000_000);
    expect((await budgets.findByPeriod('f1', NOV))!.createdFrom).toBe('copy');
  });

  it('copy_previous needs a previous month; a viewer cannot copy', async () => {
    await expect(copyOrBlank.execute({ actor: admin, period: NOV, mode: 'copy_previous' })).rejects.toBeInstanceOf(InvalidMonthCommandError);
    await expect(copyOrBlank.execute({ actor: viewer, period: NOV, mode: 'blank' })).rejects.toBeInstanceOf(NotAllowedError);
  });
});
