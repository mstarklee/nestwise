import { beforeEach, describe, expect, it } from 'vitest';
import { samplePlanImport } from '../../../../fixtures/sample-plan-import';
import { ImportPlanUseCase } from '../../src/plan';
import { type Actor, NotAllowedError } from '../../src/shared';
import {
  ApplyFirstYearCheckUseCase,
  CancelYearLineUseCase,
  EnsureYearPlanUseCase,
  FirstYearCheckDoneError,
  GetSetupStatusUseCase,
  GetYearPlanUseCase,
  InvalidYearPlanCommandError,
  MarkYearLineDoneUseCase,
  SetYearLineScheduleUseCase,
  type YearLine,
  YearLineNotCancellableError,
  YearLineNotCompletableError,
  YearLineNotFoundError,
  YearPlanNotFoundError,
} from '../../src/year-plan';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryFamilyGateway } from '../fakes/in-memory-family-gateways';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { InMemoryYearPaidGateway, InMemoryYearPlanGateway, InMemoryYearPlanUnitOfWork } from '../fakes/in-memory-year-plan-gateways';
import { SequentialIds } from '../fakes/sequential-ids';

const admin: Actor = { userId: 'u1', familyId: 'f1', role: 'admin' };
const member: Actor = { ...admin, role: 'member' };
const viewer: Actor = { ...admin, role: 'viewer' };
const NOV_2026 = { year: 2026, month: 11 };

let planUow: InMemoryPlanUnitOfWork;
let yearPlans: InMemoryYearPlanGateway;
let paid: InMemoryYearPaidGateway;
let uow: InMemoryYearPlanUnitOfWork;
let families: InMemoryFamilyGateway;
let clock: FixedClock;
let ensure: EnsureYearPlanUseCase;
let schedule: SetYearLineScheduleUseCase;
let markDone: MarkYearLineDoneUseCase;
let cancel: CancelYearLineUseCase;
let firstYearCheck: ApplyFirstYearCheckUseCase;
let getYearPlan: GetYearPlanUseCase;

beforeEach(async () => {
  planUow = new InMemoryPlanUnitOfWork();
  const ids = new SequentialIds();
  clock = new FixedClock('2026-11-01T04:00:00Z');
  await new ImportPlanUseCase(planUow, planUow.plan, ids, clock).execute({ actor: admin, plan: samplePlanImport });
  families = new InMemoryFamilyGateway();
  await families.save({
    id: 'f1',
    name: 'Family',
    currencyCode: 'INR',
    minorUnit: 2,
    numberLocale: 'en-IN',
    timeZone: 'Asia/Kolkata',
    countryCode: 'IN',
    setAsideOverrideMinor: null,
    alertThresholds: [80, 100],
    createdBy: 'u1',
    createdAt: clock.now(),
  });
  yearPlans = new InMemoryYearPlanGateway();
  paid = new InMemoryYearPaidGateway();
  uow = new InMemoryYearPlanUnitOfWork(yearPlans);
  ensure = new EnsureYearPlanUseCase(yearPlans, planUow.plan, ids);
  schedule = new SetYearLineScheduleUseCase(uow, yearPlans, clock);
  markDone = new MarkYearLineDoneUseCase(uow, yearPlans, clock);
  cancel = new CancelYearLineUseCase(uow, yearPlans, paid, clock);
  firstYearCheck = new ApplyFirstYearCheckUseCase(uow, ensure, clock);
  getYearPlan = new GetYearPlanUseCase(ensure, yearPlans, paid, families, clock);
});

async function line2026(seedKey: string): Promise<YearLine> {
  const items = await planUow.plan.listItems('f1', { includeArchived: true });
  const itemId = items.find((i) => i.seedKey === seedKey)!.id;
  const plan = await ensure.execute({ familyId: 'f1', year: 2026 });
  return (await yearPlans.findLine('f1', plan.lines.find((l) => l.itemId === itemId)!.id))!;
}

const DATED_BEFORE_NOV = ['school_t1', 'inlaws_health', 'term_ins', 'self_health', 'parents_health', 'car_ins', 'school_t2', 'pongal'];

describe('EnsureYearPlanUseCase', () => {
  it('creates 2026 from the yearly template once, all open, due in 2026', async () => {
    const plan = await ensure.execute({ familyId: 'f1', year: 2026 });
    expect(plan).toMatchObject({ familyId: 'f1', year: 2026, firstYearCheckAt: null });
    expect(plan.lines).toHaveLength(22);
    expect(plan.lines.every((l) => l.state === 'open' && l.dueYear === 2026 && l.year === 2026)).toBe(true);
    expect(plan.lines.find((l) => l.name === 'Bike Insurance')).toMatchObject({ plannedMinor: 150_000, dueMonth: 11, dueDay: null });
    expect(plan.lines.find((l) => l.name === 'Deepavali Celebration')).toMatchObject({ dueMonth: null });
    expect((await ensure.execute({ familyId: 'f1', year: 2026 })).id).toBe(plan.id);
    expect(yearPlans.count()).toBe(1);
  });
});

describe('ApplyFirstYearCheckUseCase', () => {
  const stillToCome = async (...seedKeys: string[]) => Promise.all(seedKeys.map(async (k) => (await line2026(k)).id));

  it('first-year check at Nov 2026: May/Jun/Jul/Oct lines and unticked undated lines become before_nestwise', async () => {
    const ticked = await stillToCome('deepavali', 'bike_ins');
    const plan = await firstYearCheck.execute({ actor: admin, year: 2026, stillToComeLineIds: ticked, setupPeriod: NOV_2026 });

    const before = plan.lines.filter((l) => l.state === 'before_nestwise');
    const open = plan.lines.filter((l) => l.state === 'open').map((l) => l.name);
    expect(open.sort()).toEqual(['Bike Insurance', 'Deepavali Celebration']);
    expect(before).toHaveLength(20);
    for (const key of DATED_BEFORE_NOV) expect((await line2026(key)).state).toBe('before_nestwise');
    expect((await line2026('tour')).state).toBe('before_nestwise');
    expect(plan.firstYearCheckAt).toEqual(clock.now());
    expect(uow.activity.all()).toMatchObject([{ action: 'year_plan.first_year_check', familyId: 'f1' }]);
  });

  it('a line due before the setup month is before_nestwise even when ticked', async () => {
    const ticked = await stillToCome('school_t2', 'bike_ins');
    await firstYearCheck.execute({ actor: admin, year: 2026, stillToComeLineIds: ticked, setupPeriod: NOV_2026 });
    expect((await line2026('school_t2')).state).toBe('before_nestwise');
    expect((await line2026('bike_ins')).state).toBe('open');
  });

  it('ticked Deepavali stays open and counts in undatedRemaining', async () => {
    const ticked = await stillToCome('deepavali', 'bike_ins');
    await firstYearCheck.execute({ actor: admin, year: 2026, stillToComeLineIds: ticked, setupPeriod: NOV_2026 });
    const view = await getYearPlan.execute({ actor: admin, year: 2026 });
    expect(view.undatedRemainingMinor).toBe(500_000);
    expect(view.lines.find((l) => l.name === 'Deepavali Celebration')).toMatchObject({ remainingMinor: 500_000, status: 'planned' });
    expect(view.lines.find((l) => l.name === 'Family Tour / Vacation')).toMatchObject({ remainingMinor: 0, status: 'before_nestwise' });
    expect(view.lines.find((l) => l.name === 'Bike Insurance')).toMatchObject({ remainingMinor: 150_000, status: 'due_soon' });
    expect(view.totalMinor).toBe(44_300_000); // before_nestwise still counts in the year total (TRD §4)
  });

  it('refuses to run twice, and the second answer changes nothing', async () => {
    await firstYearCheck.execute({ actor: admin, year: 2026, stillToComeLineIds: await stillToCome('deepavali'), setupPeriod: NOV_2026 });
    const tour = await line2026('tour');
    await expect(
      firstYearCheck.execute({ actor: admin, year: 2026, stillToComeLineIds: [tour.id], setupPeriod: NOV_2026 }),
    ).rejects.toBeInstanceOf(FirstYearCheckDoneError);
    expect((await line2026('tour')).state).toBe('before_nestwise');
    expect(uow.activity.all()).toHaveLength(1);
  });

  it('refuses a line from another year, a setup month in another year, and anyone but an admin', async () => {
    const plan2027 = await ensure.execute({ familyId: 'f1', year: 2027 });
    await expect(
      firstYearCheck.execute({ actor: admin, year: 2026, stillToComeLineIds: [plan2027.lines[0]!.id], setupPeriod: NOV_2026 }),
    ).rejects.toBeInstanceOf(InvalidYearPlanCommandError);
    await expect(
      firstYearCheck.execute({ actor: admin, year: 2026, stillToComeLineIds: [], setupPeriod: { year: 2027, month: 1 } }),
    ).rejects.toBeInstanceOf(InvalidYearPlanCommandError);
    await expect(firstYearCheck.execute({ actor: member, year: 2026, stillToComeLineIds: [], setupPeriod: NOV_2026 })).rejects.toBeInstanceOf(
      NotAllowedError,
    );
    expect((await yearPlans.findByYear('f1', 2026))!.firstYearCheckAt).toBeNull();
    expect(uow.activity.all()).toHaveLength(0);
  });
});

describe('CancelYearLineUseCase', () => {
  it('a paid line cannot be cancelled and stays unchanged', async () => {
    const bike = await line2026('bike_ins');
    paid.set('f1', 2026, bike.id, 150_000);
    await expect(cancel.execute({ actor: admin, yearLineId: bike.id })).rejects.toBeInstanceOf(YearLineNotCancellableError);
    expect((await line2026('bike_ins')).state).toBe('open');
    expect(uow.activity.all()).toHaveLength(0);
  });

  it('cancels an unpaid line, which leaves the year total', async () => {
    const tour = await line2026('tour');
    const cancelled = await cancel.execute({ actor: admin, yearLineId: tour.id });
    expect(cancelled.state).toBe('cancelled');
    const view = await getYearPlan.execute({ actor: admin, year: 2026 });
    expect(view.totalMinor).toBe(44_300_000 - 5_000_000);
    expect(uow.activity.all()).toMatchObject([{ action: 'year_line.cancel', entityId: tour.id, before: { state: 'open' }, after: { state: 'cancelled' } }]);
  });

  it('refuses another family’s line and a member', async () => {
    const tour = await line2026('tour');
    await expect(cancel.execute({ actor: { ...admin, familyId: 'f2' }, yearLineId: tour.id })).rejects.toBeInstanceOf(YearLineNotFoundError);
    await expect(cancel.execute({ actor: member, yearLineId: tour.id })).rejects.toBeInstanceOf(NotAllowedError);
    expect((await line2026('tour')).state).toBe('open');
  });
});

describe('MarkYearLineDoneUseCase', () => {
  it('marking done with less paid leaves remaining 0 and status paid', async () => {
    const servicing = await line2026('car_bike_service');
    paid.set('f1', 2026, servicing.id, 400_000);
    await markDone.execute({ actor: admin, yearLineId: servicing.id });
    const view = await getYearPlan.execute({ actor: admin, year: 2026 });
    expect(view.lines.find((l) => l.id === servicing.id)).toMatchObject({ state: 'done', paidMinor: 400_000, remainingMinor: 0, status: 'paid' });
  });

  it('refuses a cancelled line', async () => {
    const tour = await line2026('tour');
    await cancel.execute({ actor: admin, yearLineId: tour.id });
    await expect(markDone.execute({ actor: admin, yearLineId: tour.id })).rejects.toBeInstanceOf(YearLineNotCompletableError);
    expect((await line2026('tour')).state).toBe('cancelled');
  });
});

describe('SetYearLineScheduleUseCase', () => {
  it('gives an undated line a month and day, and can take the month away again', async () => {
    const tour = await line2026('tour');
    expect(await schedule.execute({ actor: admin, yearLineId: tour.id, dueMonth: 5, dueDay: 20 })).toMatchObject({ dueMonth: 5, dueDay: 20 });
    expect(await line2026('tour')).toMatchObject({ dueMonth: 5, dueDay: 20 });
    await schedule.execute({ actor: admin, yearLineId: tour.id, dueMonth: null, dueDay: null });
    expect(await line2026('tour')).toMatchObject({ dueMonth: null, dueDay: null });
    expect(uow.activity.all().map((a) => a.action)).toEqual(['year_line.schedule', 'year_line.schedule']);
  });

  it('cannot set a due month outside 1–12 (InvalidYearPlanCommandError) and saves nothing', async () => {
    const tour = await line2026('tour');
    for (const [dueMonth, dueDay] of [[13, null], [0, null], [null, 5], [2, 30], [4, 31], [1.5, null]] as const) {
      await expect(schedule.execute({ actor: admin, yearLineId: tour.id, dueMonth, dueDay })).rejects.toBeInstanceOf(InvalidYearPlanCommandError);
    }
    expect(await line2026('tour')).toMatchObject({ dueMonth: null, dueDay: null });
    expect(uow.activity.all()).toHaveLength(0);
  });

  it('a viewer cannot change the schedule', async () => {
    const tour = await line2026('tour');
    await expect(schedule.execute({ actor: viewer, yearLineId: tour.id, dueMonth: 5, dueDay: null })).rejects.toBeInstanceOf(NotAllowedError);
  });
});

describe('GetYearPlanUseCase', () => {
  it('year view for the fixture 2026 plan totals 4,43,000', async () => {
    const view = await getYearPlan.execute({ actor: viewer, year: 2026 });
    expect(view.totalMinor).toBe(44_300_000);
    expect(view.lines).toHaveLength(22);
    expect(view.undatedRemainingMinor).toBe(15_700_000);
    expect(view.lines.find((l) => l.name === 'Car Insurance')).toMatchObject({ status: 'overdue', remainingMinor: 650_000, paidMinor: 0 });
    expect(view.firstYearCheckDone).toBe(false);
  });

  it('creates the current year lazily, but not a future or past year', async () => {
    expect(yearPlans.count()).toBe(0);
    await getYearPlan.execute({ actor: admin, year: 2026 });
    expect(yearPlans.count()).toBe(1);
    await expect(getYearPlan.execute({ actor: admin, year: 2027 })).rejects.toBeInstanceOf(YearPlanNotFoundError);
    await expect(getYearPlan.execute({ actor: admin, year: 2025 })).rejects.toBeInstanceOf(YearPlanNotFoundError);
    expect(yearPlans.count()).toBe(1);
    await ensure.execute({ familyId: 'f1', year: 2027 });
    expect((await getYearPlan.execute({ actor: admin, year: 2027 })).lines).toHaveLength(22);
  });
});

describe('GetSetupStatusUseCase', () => {
  it('reports whether setup’s first-year check was ever answered, without creating a year plan', async () => {
    const status = new GetSetupStatusUseCase(yearPlans);
    expect(await status.execute({ actor: viewer })).toEqual({ firstYearCheckDone: false });
    expect(yearPlans.count()).toBe(0);
    const plan = await ensure.execute({ familyId: 'f1', year: 2026 });
    await firstYearCheck.execute({ actor: admin, year: 2026, stillToComeLineIds: [plan.lines[0]!.id], setupPeriod: NOV_2026 });
    expect(await status.execute({ actor: viewer })).toEqual({ firstYearCheckDone: true });
    // Next year's plan never gets a first-year check; setup stays done.
    await ensure.execute({ familyId: 'f1', year: 2027 });
    expect(await status.execute({ actor: viewer })).toEqual({ firstYearCheckDone: true });
    expect(await status.execute({ actor: { ...viewer, familyId: 'f2' } })).toEqual({ firstYearCheckDone: false });
  });
});
