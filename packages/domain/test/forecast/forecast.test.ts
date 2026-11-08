import { beforeEach, describe, expect, it } from 'vitest';
import { samplePlanImport } from '../../../../fixtures/sample-plan-import';
import { GetForecastUseCase, GetHomeSummaryUseCase } from '../../src/forecast';
import { EnsureMonthBudgetUseCase, GetMonthSummaryUseCase } from '../../src/month-budget';
import { ImportPlanUseCase } from '../../src/plan';
import { ConfirmPotDepositUseCase, ConfirmSavingsUseCase, GetChecklistUseCase, RecordPotMovementUseCase, SkipChecklistItemUseCase } from '../../src/pot';
import { type Actor, toIsoDate } from '../../src/shared';
import { ApplyFirstYearCheckUseCase, ConfirmNextYearReviewUseCase, EnsureYearPlanUseCase, GetYearEndReviewUseCase } from '../../src/year-plan';
import { familyRecord } from '../fakes/family-record';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryCaptureGateway } from '../fakes/in-memory-capture-gateways';
import { InMemoryFamilyGateway } from '../fakes/in-memory-family-gateways';
import { InMemoryActualsGateway, InMemoryMonthBudgetGateway } from '../fakes/in-memory-month-budget-gateways';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { InMemoryPotGateway, InMemoryPotUnitOfWork } from '../fakes/in-memory-pot-gateways';
import { InMemoryYearPaidGateway, InMemoryYearPlanGateway, InMemoryYearPlanUnitOfWork } from '../fakes/in-memory-year-plan-gateways';
import { SequentialIds } from '../fakes/sequential-ids';

const admin: Actor = { userId: 'u1', familyId: 'f1', role: 'admin' };
const NOV = { year: 2026, month: 11 };
const NOV_2026_END_BALANCES = [
  3_541_666, 7_233_332, 9_424_999, 13_116_666, 16_808_333, 20_500_000, 18_191_667, 9_883_334, 8_275_001, 11_966_668, 15_658_334, 15_700_000,
];

let monthBudgets: InMemoryMonthBudgetGateway;
let ensureOctober: () => Promise<{ id: string }>;
let planUow: InMemoryPlanUnitOfWork;
let families: InMemoryFamilyGateway;
let yearPlans: InMemoryYearPlanGateway;
let paid: InMemoryYearPaidGateway;
let pot: InMemoryPotGateway;
let potUow: InMemoryPotUnitOfWork;
let actuals: InMemoryActualsGateway;
let clock: FixedClock;
let captures: InMemoryCaptureGateway;
let ids: SequentialIds;
let ensureYear: EnsureYearPlanUseCase;
let forecast: GetForecastUseCase;
let home: GetHomeSummaryUseCase;
let itemId: (seedKey: string) => string;

beforeEach(async () => {
  planUow = new InMemoryPlanUnitOfWork();
  ids = new SequentialIds();
  clock = new FixedClock('2026-11-01T04:00:00Z'); // 1 Nov in India
  captures = new InMemoryCaptureGateway();
  await new ImportPlanUseCase(planUow, planUow.plan, ids, clock).execute({ actor: admin, plan: samplePlanImport });
  const items = await planUow.plan.listItems('f1', { includeArchived: true });
  itemId = (seedKey) => items.find((i) => i.seedKey === seedKey)!.id;
  families = new InMemoryFamilyGateway();
  await families.save(familyRecord());

  yearPlans = new InMemoryYearPlanGateway();
  paid = new InMemoryYearPaidGateway();
  ensureYear = new EnsureYearPlanUseCase(yearPlans, planUow.plan, ids);
  const plan2026 = await ensureYear.execute({ familyId: 'f1', year: 2026 });
  const ticked = plan2026.lines.filter((l) => l.itemId === itemId('deepavali') || l.itemId === itemId('bike_ins')).map((l) => l.id);
  await new ApplyFirstYearCheckUseCase(new InMemoryYearPlanUnitOfWork(yearPlans), ensureYear, clock).execute({
    actor: admin,
    year: 2026,
    stillToComeLineIds: ticked, // the setup screen pre-ticks Nov bike insurance; the family ticks only Deepavali
    setupPeriod: NOV,
  });

  pot = new InMemoryPotGateway(); // B0 = 0
  potUow = new InMemoryPotUnitOfWork(pot);
  actuals = new InMemoryActualsGateway();
  monthBudgets = new InMemoryMonthBudgetGateway();
  const ensureMonth = new EnsureMonthBudgetUseCase(monthBudgets, planUow.plan, ids);
  forecast = new GetForecastUseCase(families, pot, yearPlans, paid, planUow.plan, clock);
  home = new GetHomeSummaryUseCase(
    forecast,
    new GetChecklistUseCase(ensureMonth, yearPlans, planUow.plan, families, pot),
    new GetMonthSummaryUseCase(ensureMonth, actuals, planUow.plan),
    monthBudgets,
    yearPlans,
    new GetYearEndReviewUseCase(yearPlans, paid),
    captures,
    planUow.plan,
    actuals,
  );
  ensureOctober = () => ensureMonth.execute({ familyId: 'f1', period: { year: 2026, month: 10 } });
});

describe('GetForecastUseCase', () => {
  it('reproduces the Nov 2026 worked example end balances', async () => {
    const f = await forecast.execute({ actor: admin });
    expect(f.months.map((m) => m.endMinor)).toEqual(NOV_2026_END_BALANCES);
    expect(f.months[0]).toMatchObject({ period: NOV, inMinor: 3_691_666, outMinor: 150_000 });
    expect(f).toMatchObject({ safeToSpendNowMinor: 0, redMonths: [], fixPerMonthMinor: null, topUpNowMinor: null });
    expect(f.monthlyPlanMinor).toBe(8_150_000);
    expect(f.savingsPlanMinor).toBe(1_700_000);
  });

  it('marks 2027 months as estimate before the 2027 plan exists, and not after EnsureYearPlan(2027)', async () => {
    const before = await forecast.execute({ actor: admin });
    expect(before.months.map((m) => m.estimate)).toEqual([false, false, ...Array(10).fill(true)]);
    await ensureYear.execute({ familyId: 'f1', year: 2027 });
    const after = await forecast.execute({ actor: admin });
    expect(after.months.every((m) => !m.estimate)).toBe(true);
    expect(after.months.map((m) => m.endMinor)).toEqual(NOV_2026_END_BALANCES);
  });

  it('after the deposit is confirmed, no more money comes this month and safe to spend is ₹35,416.66', async () => {
    await new ConfirmPotDepositUseCase(potUow, pot, families, ids, clock).execute({ actor: admin, period: NOV, amountMinor: 3_691_666 });
    const f = await forecast.execute({ actor: admin });
    expect(f.balanceMinor).toBe(3_691_666);
    expect(f.months[0]).toMatchObject({ inMinor: 0, endMinor: 3_541_666 });
    expect(f.safeToSpendNowMinor).toBe(3_541_666);
  });

  it('a bill paid in part only counts what is still owed; an unpaid bill from last month is counted once, now', async () => {
    const bike = (await yearPlans.findByYear('f1', 2026))!.lines.find((l) => l.itemId === itemId('bike_ins'))!;
    paid.set('f1', 2026, bike.id, 100_000);
    expect((await forecast.execute({ actor: admin })).months[0]!.outMinor).toBe(50_000);

    clock.set('2026-12-05T04:00:00Z');
    const dec = await forecast.execute({ actor: admin });
    expect(dec.months[0]).toMatchObject({ period: { year: 2026, month: 12 }, outMinor: 50_000 });
    // November 2027 carries only its own bike insurance, not the 2026 one again.
    expect(dec.months[11]).toMatchObject({ period: { year: 2027, month: 11 }, outMinor: 150_000 });
    expect(dec.bills[0]!.lines).toEqual([
      {
        yearLineId: bike.id,
        itemId: itemId('bike_ins'),
        planYear: 2026,
        name: 'Bike Insurance',
        plannedMinor: 150_000,
        paidMinor: 100_000,
        remainingMinor: 50_000,
        status: 'overdue',
      },
    ]);
  });

  it('a viewer can read it', async () => {
    expect((await forecast.execute({ actor: { ...admin, role: 'viewer' } })).months).toHaveLength(12);
  });
});

describe('GetHomeSummaryUseCase', () => {
  it('home shows the three months after this one (Dec none; Jan Pongal 15,000; Feb none)', async () => {
    const h = await home.execute({ actor: admin });
    expect(h.comingMonths.map((m) => m.period)).toEqual([{ year: 2026, month: 12 }, { year: 2027, month: 1 }, { year: 2027, month: 2 }]);
    expect(h.comingMonths[0]!.lines).toEqual([]);
    expect(h.comingMonths[1]!.lines).toMatchObject([{ name: 'Pongal', remainingMinor: 1_500_000, yearLineId: null }]);
    expect(h.comingMonths[2]!.lines).toEqual([]);
    expect(h.pot).toMatchObject({ balanceMinor: 0, safeToSpendNowMinor: 0, firstRed: null, fixPerMonthMinor: null });
  });

  it('home lists 13 undated 2027 items worth 1,57,000 once the 2027 plan exists', async () => {
    expect((await home.execute({ actor: admin })).undated).toMatchObject([{ year: 2026, count: 1, totalMinor: 500_000 }]);
    await ensureYear.execute({ familyId: 'f1', year: 2027 });
    const h = await home.execute({ actor: admin });
    expect(h.undated.find((u) => u.year === 2027)).toMatchObject({ count: 13, totalMinor: 15_700_000 });
    expect(h.cards).toContain('undated');
  });

  it('home shows the voice card only while a spoken note is waiting', async () => {
    expect((await home.execute({ actor: admin })).cards).not.toContain('capture');

    await captures.create({
      id: 'batch-1',
      familyId: 'f1',
      createdBy: 'u1',
      transcript: 'KPN 250',
      sttModel: 'gpt-transcribe',
      parseModel: 'gpt-6.1-terra',
      entries: [],
      createdAt: new Date('2026-11-01T05:00:00Z'),
      resolvedAt: null,
    });
    expect((await home.execute({ actor: admin })).cards).toContain('capture');

    await captures.resolve('f1', 'batch-1', new Date('2026-11-01T06:00:00Z'));
    expect((await home.execute({ actor: admin })).cards).not.toContain('capture');
  });

  it('home carries this month’s checklist, so the screen reads it once', async () => {
    const h = await home.execute({ actor: admin });
    expect(h.checklist).toMatchObject({ period: NOV, pot: { status: 'pending' } });
  });

  it('home shows the next_year card from 1 December until an Admin confirms next year', async () => {
    clock.set('2026-12-01T04:00:00Z');
    expect((await home.execute({ actor: admin })).cards).not.toContain('next_year'); // no 2027 plan yet
    await ensureYear.execute({ familyId: 'f1', year: 2027 });
    expect((await home.execute({ actor: admin })).cards).toContain('next_year');
    await new ConfirmNextYearReviewUseCase(new InMemoryYearPlanUnitOfWork(yearPlans), yearPlans, clock).execute({ actor: admin, year: 2027 });
    expect((await home.execute({ actor: admin })).cards).not.toContain('next_year');
  });

  it('home shows the year_end card in January while last year still has open lines', async () => {
    await ensureYear.execute({ familyId: 'f1', year: 2027 });
    clock.set('2027-01-02T04:00:00Z');
    expect((await home.execute({ actor: admin })).cards).toContain('year_end');
    for (const line of (await yearPlans.findByYear('f1', 2026))!.lines) await yearPlans.saveLine({ ...line, state: 'done' });
    expect((await home.execute({ actor: admin })).cards).not.toContain('year_end');
  });

  it('home shows the month review card while last month is open, and not once it is closed', async () => {
    expect((await home.execute({ actor: admin })).cards).not.toContain('month_review'); // no October budget: started in November
    const october = await ensureOctober();
    expect((await home.execute({ actor: admin })).cards).toContain('month_review');
    await monthBudgets.close('f1', october.id, 'u1', clock.now());
    expect((await home.execute({ actor: admin })).cards).not.toContain('month_review');
  });

  it('home shows the checklist card on the 1st until the deposit is confirmed or skipped', async () => {
    expect((await home.execute({ actor: admin })).cards).toContain('checklist');
    await new ConfirmPotDepositUseCase(potUow, pot, families, ids, clock).execute({ actor: admin, period: NOV, amountMinor: 3_691_666 });
    await new ConfirmSavingsUseCase(potUow, pot, planUow.plan, ids, clock).execute({ actor: admin, period: NOV, itemId: itemId('rd'), amountMinor: 200_000 });
    expect((await home.execute({ actor: admin })).cards).toContain('checklist'); // gold is still unanswered
    await new SkipChecklistItemUseCase(potUow, pot, planUow.plan, ids, clock).execute({ actor: admin, period: NOV, itemId: itemId('gold') });
    const h = await home.execute({ actor: admin });
    expect(h.cards).not.toContain('checklist');
    expect(h.pot).toMatchObject({ balanceMinor: 3_691_666, safeToSpendNowMinor: 3_541_666 });
  });

  it('shows the first short month and the top-up when money was taken out', async () => {
    await new SkipChecklistItemUseCase(potUow, pot, planUow.plan, ids, clock).execute({ actor: admin, period: NOV, itemId: null });
    const h = await home.execute({ actor: admin });
    expect(h.pot.firstRed).toEqual({ period: NOV, shortfallMinor: 150_000 });
    expect(h.pot.fixPerMonthMinor).toBeNull(); // no deposit can reach November any more
    await new RecordPotMovementUseCase(potUow, families, ids, clock).execute({ actor: admin, kind: 'extra_in', amountMinor: 150_000, note: null });
    expect((await home.execute({ actor: admin })).pot.firstRed).toBeNull();
  });

  it('this month: planned, actual and the groups that are over', async () => {
    // Food & Dining plans ₹24,000; groceries alone reach ₹25,000. Rent is exactly on plan.
    actuals.set('f1', NOV, new Map([[itemId('groceries'), 2_500_000], [itemId('rent'), 2_000_000]]));
    const h = await home.execute({ actor: admin });
    expect(h.thisMonth).toMatchObject({ monthlyPlannedMinor: 8_150_000, monthlyActualMinor: 4_500_000, groupsOver: ['Food & Dining'] });
  });

  it('home gives each of the coming months its end-of-month pot balance', async () => {
    expect((await home.execute({ actor: admin })).comingMonths.map((m) => m.endMinor)).toEqual(NOV_2026_END_BALANCES.slice(1, 4));
  });

  it('home gives the monthly set-aside and says every month is covered', async () => {
    const [h, f] = [await home.execute({ actor: admin }), await forecast.execute({ actor: admin })];
    expect(h.pot).toMatchObject({ setAsideMinor: f.months[1]!.inMinor, allCovered: true, topUpNowMinor: null });
  });

  it('home picks June 2027 as the biggest month ahead, from months 4–12', async () => {
    const [h, f] = [await home.execute({ actor: admin }), await forecast.execute({ actor: admin })];
    expect(h.biggestAhead).toMatchObject({
      period: { year: 2027, month: 6 },
      totalMinor: 12_000_000,
      openingMinor: f.months[6]!.endMinor + f.months[7]!.inMinor,
      shortOnTheWay: null,
    });
    expect(h.biggestAhead!.lines.map((l) => l.name)).toEqual(['Health Insurance — In-laws', 'Term Life Insurance']);
  });

  it('with a ₹20,000 set-aside the pot runs short in June 2027, and Home says so', async () => {
    await families.save(familyRecord({ setAsideOverrideMinor: 2_000_000 }));
    const [h, f] = [await home.execute({ actor: admin }), await forecast.execute({ actor: admin })];
    expect(h.pot.allCovered).toBe(false);
    expect(h.biggestAhead!.shortOnTheWay).toEqual({ period: { year: 2027, month: 6 }, shortfallMinor: -f.months[7]!.endMinor });
  });

  it('home lists this month’s groups with planned and actual', async () => {
    expect((await home.execute({ actor: admin })).thisMonth.groups).toContainEqual({ groupName: 'Food & Dining', plannedMinor: 2_400_000, actualMinor: 0 });
  });

  describe('this month’s bills', () => {
    type Home = Awaited<ReturnType<GetHomeSummaryUseCase['execute']>>;
    const names = (h: Home, state: string) => h.thisMonth.bills.lines.filter((b) => b.state === state).map((b) => b.name);
    const day = (value: string) => toIsoDate(value);

    it('lists the nine monthly bills and November’s bike insurance, all still to pay, yearly first', async () => {
      const h = await home.execute({ actor: admin });
      expect(h.thisMonth.bills).toMatchObject({ count: 10, paidCount: 0, toPayMinor: 4_400_000 });
      expect(h.thisMonth.bills.lines[0]).toEqual({
        kind: 'yearly',
        itemId: itemId('bike_ins'),
        yearLineId: (await yearPlans.findByYear('f1', 2026))!.lines.find((l) => l.itemId === itemId('bike_ins'))!.id,
        planYear: 2026,
        name: 'Bike Insurance',
        plannedMinor: 150_000,
        paidMinor: 0,
        toPayMinor: 150_000,
        paidOn: null,
        state: 'to_pay',
        overdue: false,
      });
      expect(names(h, 'to_pay').slice(1, 3)).toEqual(['House Rent', 'Electricity Bill']);
      expect(names(h, 'to_pay')).not.toContain('Groceries');
    });

    it('a bill with spending this month is paid, with its date; under-plan spend still counts as paid', async () => {
      actuals.set(
        'f1',
        NOV,
        new Map([
          [itemId('rent'), 2_000_000],
          [itemId('electricity'), 285_000],
          [itemId('groceries'), 94_500],
        ]),
        new Map([
          [itemId('rent'), day('2026-11-02')],
          [itemId('electricity'), day('2026-11-05')],
        ]),
      );
      const h = await home.execute({ actor: admin });
      expect(names(h, 'paid')).toEqual(['House Rent', 'Electricity Bill']);
      expect(h.thisMonth.bills.lines.find((b) => b.name === 'Electricity Bill')).toMatchObject({
        paidMinor: 285_000,
        plannedMinor: 300_000,
        toPayMinor: 0,
        paidOn: '2026-11-05',
      });
      expect(h.thisMonth.bills).toMatchObject({ count: 10, paidCount: 2, toPayMinor: 4_400_000 - 2_000_000 - 300_000 });
      // The whole month: ₹81,500 monthly plan + ₹1,500 bike insurance; paid ₹20,000 + ₹2,850 + ₹945.
      expect(h.thisMonth).toMatchObject({ plannedMinor: 8_300_000, paidMinor: 2_000_000 + 285_000 + 94_500 });
    });

    it('a bill planned at ₹0 this month is “not this month” and does not count', async () => {
      const ensure = new EnsureMonthBudgetUseCase(monthBudgets, planUow.plan, ids);
      const nov = await ensure.execute({ familyId: 'f1', period: NOV });
      const ott = nov.lines.find((l) => l.itemId === itemId('ott'))!;
      await monthBudgets.saveLine('f1', nov.id, { ...ott, plannedMinor: 0 });
      const h = await home.execute({ actor: admin });
      expect(names(h, 'not_this_month')).toEqual(['OTT Subscriptions (Netflix, Amazon)']);
      expect(h.thisMonth.bills.lines.at(-1)!.name).toBe('OTT Subscriptions (Netflix, Amazon)');
      expect(h.thisMonth.bills).toMatchObject({ count: 9, paidCount: 0, toPayMinor: 4_400_000 - 100_000 });
    });

    it('a yearly bill paid in part is still to pay with what is owed; fully paid it is paid', async () => {
      const bike = (await yearPlans.findByYear('f1', 2026))!.lines.find((l) => l.itemId === itemId('bike_ins'))!;
      paid.set('f1', 2026, bike.id, 100_000);
      let h = await home.execute({ actor: admin });
      expect(h.thisMonth.bills.lines[0]).toMatchObject({ name: 'Bike Insurance', state: 'to_pay', paidMinor: 100_000, toPayMinor: 50_000 });
      paid.set('f1', 2026, bike.id, 150_000);
      actuals.set('f1', NOV, new Map([[itemId('bike_ins'), 150_000]]), new Map([[itemId('bike_ins'), day('2026-11-03')]]));
      h = await home.execute({ actor: admin });
      expect(h.thisMonth.bills.lines.find((b) => b.name === 'Bike Insurance')).toMatchObject({ state: 'paid', toPayMinor: 0, paidOn: '2026-11-03' });
      expect(h.thisMonth.bills).toMatchObject({ paidCount: 1, toPayMinor: 4_250_000 });
    });

    it('a yearly bill from an earlier month that is still owed shows as overdue', async () => {
      clock.set('2026-12-05T04:00:00Z');
      const h = await home.execute({ actor: admin });
      expect(h.thisMonth.bills.lines[0]).toMatchObject({ name: 'Bike Insurance', overdue: true, state: 'to_pay', toPayMinor: 150_000 });
    });

    it('only monthly items marked as bills are listed', async () => {
      const groceries = (await planUow.plan.listItems('f1', { includeArchived: false })).find((i) => i.seedKey === 'groceries')!;
      await planUow.plan.saveItem({ ...groceries, isBill: true });
      expect(names(await home.execute({ actor: admin }), 'to_pay')).toContain('Groceries');
    });
  });
});
