import { beforeEach, describe, expect, it } from 'vitest';
import { samplePlanImport } from '../../../../fixtures/sample-plan-import';
import { EnsureMonthBudgetUseCase } from '../../src/month-budget';
import { ImportPlanUseCase } from '../../src/plan';
import {
  ChecklistItemAlreadyDoneError,
  ChecklistItemNotFoundError,
  ConfirmPotDepositUseCase,
  ConfirmSavingsUseCase,
  GetChecklistUseCase,
  GetPotBalanceUseCase,
  InvalidPotCommandError,
  PotDepositAlreadyExistsError,
  RecordPotMovementUseCase,
  SavingsAlreadyConfirmedError,
  SkipChecklistItemUseCase,
} from '../../src/pot';
import { type Actor, NotAllowedError } from '../../src/shared';
import { CancelYearLineUseCase, EnsureYearPlanUseCase } from '../../src/year-plan';
import { familyRecord } from '../fakes/family-record';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryFamilyGateway } from '../fakes/in-memory-family-gateways';
import { InMemoryMonthBudgetGateway } from '../fakes/in-memory-month-budget-gateways';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { InMemoryPotGateway, InMemoryPotUnitOfWork } from '../fakes/in-memory-pot-gateways';
import { InMemoryYearPaidGateway, InMemoryYearPlanGateway, InMemoryYearPlanUnitOfWork } from '../fakes/in-memory-year-plan-gateways';
import { SequentialIds } from '../fakes/sequential-ids';

const admin: Actor = { userId: 'u1', familyId: 'f1', role: 'admin' };
const member: Actor = { ...admin, userId: 'u2', role: 'member' };
const viewer: Actor = { ...admin, userId: 'u3', role: 'viewer' };
const NOV = { year: 2026, month: 11 };
const JAN_2027 = { year: 2027, month: 1 };

let planUow: InMemoryPlanUnitOfWork;
let families: InMemoryFamilyGateway;
let yearPlans: InMemoryYearPlanGateway;
let pot: InMemoryPotGateway;
let uow: InMemoryPotUnitOfWork;
let clock: FixedClock;
let ids: SequentialIds;
let ensureYear: EnsureYearPlanUseCase;
let confirmDeposit: ConfirmPotDepositUseCase;
let confirmSavings: ConfirmSavingsUseCase;
let skip: SkipChecklistItemUseCase;
let movement: RecordPotMovementUseCase;
let checklist: GetChecklistUseCase;
let balance: GetPotBalanceUseCase;
let itemId: (seedKey: string) => string;

beforeEach(async () => {
  planUow = new InMemoryPlanUnitOfWork();
  ids = new SequentialIds();
  clock = new FixedClock('2026-11-01T04:00:00Z'); // 09:30 on 1 Nov in India
  await new ImportPlanUseCase(planUow, planUow.plan, ids, clock).execute({ actor: admin, plan: samplePlanImport });
  const items = await planUow.plan.listItems('f1', { includeArchived: true });
  itemId = (seedKey) => items.find((i) => i.seedKey === seedKey)!.id;
  families = new InMemoryFamilyGateway();
  await families.save(familyRecord());
  yearPlans = new InMemoryYearPlanGateway();
  ensureYear = new EnsureYearPlanUseCase(yearPlans, planUow.plan, ids);
  await ensureYear.execute({ familyId: 'f1', year: 2026 });

  pot = new InMemoryPotGateway();
  pot.entries.push({
    id: 'opening',
    familyId: 'f1',
    kind: 'opening',
    amountMinor: 5_000_000,
    entryDate: '2026-11-01' as never,
    period: NOV,
    note: null,
    createdBy: 'u1',
    createdAt: clock.now(),
  });
  uow = new InMemoryPotUnitOfWork(pot);
  const ensureMonth = new EnsureMonthBudgetUseCase(new InMemoryMonthBudgetGateway(), planUow.plan, ids);
  confirmDeposit = new ConfirmPotDepositUseCase(uow, pot, families, ids, clock);
  confirmSavings = new ConfirmSavingsUseCase(uow, pot, planUow.plan, ids, clock);
  skip = new SkipChecklistItemUseCase(uow, pot, planUow.plan, ids, clock);
  movement = new RecordPotMovementUseCase(uow, families, ids, clock);
  checklist = new GetChecklistUseCase(ensureMonth, yearPlans, planUow.plan, families, pot);
  balance = new GetPotBalanceUseCase(pot);
});

const deposits = () => pot.entries.filter((e) => e.kind === 'deposit');

describe('ConfirmPotDepositUseCase', () => {
  it('confirms ₹36,916.66 for Nov 2026 and writes deposit + activity together', async () => {
    const entry = await confirmDeposit.execute({ actor: member, period: NOV, amountMinor: 3_691_666 });
    expect(entry).toMatchObject({ familyId: 'f1', kind: 'deposit', amountMinor: 3_691_666, period: NOV, entryDate: '2026-11-01', createdBy: 'u2' });
    expect(deposits()).toHaveLength(1);
    expect(uow.activity.all()).toMatchObject([{ action: 'pot.deposit', entityId: entry.id, actorId: 'u2', after: { amountMinor: 3_691_666 } }]);
  });

  it('refuses a second November deposit with PotDepositAlreadyExistsError; nothing new saved', async () => {
    await confirmDeposit.execute({ actor: admin, period: NOV, amountMinor: 3_691_666 });
    await expect(confirmDeposit.execute({ actor: member, period: NOV, amountMinor: 100 })).rejects.toBeInstanceOf(PotDepositAlreadyExistsError);
    expect(deposits()).toHaveLength(1);
    expect(uow.activity.count()).toBe(1);
  });

  it('rolls back the deposit when writing the activity entry fails', async () => {
    uow.failActivity = true;
    await expect(confirmDeposit.execute({ actor: admin, period: NOV, amountMinor: 3_691_666 })).rejects.toThrow('activity write failed');
    expect(deposits()).toHaveLength(0);
    expect(uow.activity.count()).toBe(0);
  });

  it('refuses zero, negative and fractional amounts, and a month outside 1–12', async () => {
    for (const amountMinor of [0, -5, 1.5]) {
      await expect(confirmDeposit.execute({ actor: admin, period: NOV, amountMinor })).rejects.toBeInstanceOf(InvalidPotCommandError);
    }
    await expect(confirmDeposit.execute({ actor: admin, period: { year: 2026, month: 13 }, amountMinor: 100 })).rejects.toBeInstanceOf(
      InvalidPotCommandError,
    );
    expect(deposits()).toHaveLength(0);
  });
});

describe('GetChecklistUseCase', () => {
  it('suggests the set-aside from the year plan: Nov 2026 = 3,691,666; with override 3,700,000', async () => {
    const nov = await checklist.execute({ actor: viewer, period: NOV });
    expect(nov.pot).toEqual({ suggestedMinor: 3_691_666, status: 'pending', confirmedMinor: null, estimate: false });
    expect(nov.savings).toEqual([
      { itemId: itemId('rd'), name: 'Recurring Deposit (RD)', plannedMinor: 200_000, hint: null, status: 'pending', confirmedMinor: null },
      {
        itemId: itemId('gold'),
        name: 'Gold Savings Scheme',
        plannedMinor: 1_500_000,
        hint: { minMinor: 1_000_000, maxMinor: 2_000_000 },
        status: 'pending',
        confirmedMinor: null,
      },
    ]);
    await families.save(familyRecord({ setAsideOverrideMinor: 3_700_000 }));
    expect((await checklist.execute({ actor: viewer, period: NOV })).pot.suggestedMinor).toBe(3_700_000);
  });

  it('a cancelled line lowers the suggestion; a year with no plan uses the template and says it is an estimate', async () => {
    const plan = (await yearPlans.findByYear('f1', 2026))!;
    const tour = plan.lines.find((l) => l.itemId === itemId('tour'))!;
    await new CancelYearLineUseCase(new InMemoryYearPlanUnitOfWork(yearPlans), yearPlans, new InMemoryYearPaidGateway(), clock).execute({
      actor: admin,
      yearLineId: tour.id,
    });
    expect((await checklist.execute({ actor: admin, period: NOV })).pot.suggestedMinor).toBe(3_275_000); // 39,300,000 ÷ 12
    expect((await checklist.execute({ actor: admin, period: JAN_2027 })).pot).toMatchObject({ suggestedMinor: 3_691_667, estimate: true });
  });

  it('shows done with the confirmed amount, skipped, and pending', async () => {
    await confirmDeposit.execute({ actor: admin, period: NOV, amountMinor: 3_700_000 });
    await confirmSavings.execute({ actor: admin, period: NOV, itemId: itemId('rd'), amountMinor: 250_000 });
    await skip.execute({ actor: admin, period: NOV, itemId: itemId('gold') });
    const nov = await checklist.execute({ actor: admin, period: NOV });
    expect(nov.pot).toMatchObject({ status: 'done', confirmedMinor: 3_700_000 });
    expect(nov.savings.map((s) => [s.status, s.confirmedMinor])).toEqual([
      ['done', 250_000],
      ['skipped', null],
    ]);
    expect((await checklist.execute({ actor: admin, period: { year: 2026, month: 12 } })).pot.status).toBe('pending');
  });
});

describe('ConfirmSavingsUseCase and SkipChecklistItemUseCase', () => {
  it('refuses a second confirmation, a non-savings item, and skipping something already done', async () => {
    await confirmSavings.execute({ actor: admin, period: NOV, itemId: itemId('rd'), amountMinor: 200_000 });
    await expect(confirmSavings.execute({ actor: admin, period: NOV, itemId: itemId('rd'), amountMinor: 1 })).rejects.toBeInstanceOf(
      SavingsAlreadyConfirmedError,
    );
    await expect(confirmSavings.execute({ actor: admin, period: NOV, itemId: itemId('groceries'), amountMinor: 1 })).rejects.toBeInstanceOf(
      ChecklistItemNotFoundError,
    );
    await expect(skip.execute({ actor: admin, period: NOV, itemId: itemId('rd') })).rejects.toBeInstanceOf(ChecklistItemAlreadyDoneError);
    await confirmDeposit.execute({ actor: admin, period: NOV, amountMinor: 1 });
    await expect(skip.execute({ actor: admin, period: NOV, itemId: null })).rejects.toBeInstanceOf(ChecklistItemAlreadyDoneError);
    expect(pot.savings).toHaveLength(1);
    expect(pot.skips).toHaveLength(0);
  });

  it('skipping the pot deposit twice keeps one answer', async () => {
    const first = await skip.execute({ actor: member, period: NOV, itemId: null });
    const second = await skip.execute({ actor: member, period: NOV, itemId: null });
    expect(second.id).toBe(first.id);
    expect(pot.skips).toHaveLength(1);
    expect((await checklist.execute({ actor: admin, period: NOV })).pot.status).toBe('skipped');
  });
});

describe('RecordPotMovementUseCase and GetPotBalanceUseCase', () => {
  it('balance = opening 50,000 + deposits − taken_out + extra_in − yearly spend', async () => {
    await confirmDeposit.execute({ actor: admin, period: NOV, amountMinor: 3_691_666 });
    await movement.execute({ actor: admin, kind: 'extra_in', amountMinor: 1_000_000, note: null });
    const out = await movement.execute({ actor: admin, kind: 'taken_out', amountMinor: 200_000, note: '  Car repair  ' });
    expect(out).toMatchObject({ kind: 'taken_out', note: 'Car repair', period: NOV, entryDate: '2026-11-01' });
    pot.yearlySpend.set('f1', 150_000);
    expect(await balance.execute({ actor: viewer })).toEqual({ balanceMinor: 5_000_000 + 3_691_666 + 1_000_000 - 200_000 - 150_000 });
    expect(uow.activity.all().map((a) => a.action)).toEqual(['pot.deposit', 'pot.extra_in', 'pot.taken_out']);
  });

  it('the balance can go below zero', async () => {
    pot.yearlySpend.set('f1', 6_000_000);
    expect((await balance.execute({ actor: admin })).balanceMinor).toBe(-1_000_000);
  });

  it('viewer cannot confirm; taken_out without a note is refused', async () => {
    await expect(confirmDeposit.execute({ actor: viewer, period: NOV, amountMinor: 100 })).rejects.toBeInstanceOf(NotAllowedError);
    await expect(movement.execute({ actor: viewer, kind: 'extra_in', amountMinor: 100, note: null })).rejects.toBeInstanceOf(NotAllowedError);
    await expect(skip.execute({ actor: viewer, period: NOV, itemId: null })).rejects.toBeInstanceOf(NotAllowedError);
    for (const note of [null, '', '   ']) {
      await expect(movement.execute({ actor: admin, kind: 'taken_out', amountMinor: 100, note })).rejects.toBeInstanceOf(InvalidPotCommandError);
    }
    await expect(movement.execute({ actor: admin, kind: 'extra_in', amountMinor: 0, note: null })).rejects.toBeInstanceOf(InvalidPotCommandError);
    expect(pot.entries).toHaveLength(1);
    expect(uow.activity.count()).toBe(0);
  });
});
