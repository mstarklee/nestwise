import { beforeEach, describe, expect, it } from 'vitest';
import { samplePlanImport } from '../../../../fixtures/sample-plan-import';
import type { Transaction } from '../../src/expenses';
import { GetForecastUseCase } from '../../src/forecast';
import { ImportPlanUseCase } from '../../src/plan';
import { type Actor, type IsoDate, NotAllowedError } from '../../src/shared';
import {
  AnswerYearEndLineUseCase,
  ConfirmNextYearReviewUseCase,
  EnsureYearPlanUseCase,
  GetNextYearReviewUseCase,
  GetYearEndReviewUseCase,
  GetYearPlanUseCase,
  InvalidYearPlanCommandError,
  SetYearLineAmountUseCase,
  YearEndAlreadyAnsweredError,
  YearLineNotFoundError,
} from '../../src/year-plan';
import { familyRecord } from '../fakes/family-record';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryTransactionGateway } from '../fakes/in-memory-expenses-gateways';
import { InMemoryFamilyGateway } from '../fakes/in-memory-family-gateways';
import { InMemoryPlanUnitOfWork } from '../fakes/in-memory-plan-gateway';
import { InMemoryPotGateway } from '../fakes/in-memory-pot-gateways';
import { InMemoryYearPlanGateway, InMemoryYearPlanUnitOfWork } from '../fakes/in-memory-year-plan-gateways';
import { SequentialIds } from '../fakes/sequential-ids';

const admin: Actor = { userId: 'u1', familyId: 'f1', role: 'admin' };
const member: Actor = { userId: 'u2', familyId: 'f1', role: 'member' };

let clock: FixedClock;
let yearPlans: InMemoryYearPlanGateway;
let yearUow: InMemoryYearPlanUnitOfWork;
let ledger: InMemoryTransactionGateway;
let ensureYear: EnsureYearPlanUseCase;
let review: GetYearEndReviewUseCase;
let answer: AnswerYearEndLineUseCase;
let nextReview: GetNextYearReviewUseCase;
let confirm: ConfirmNextYearReviewUseCase;
let setAmount: SetYearLineAmountUseCase;
let forecast: GetForecastUseCase;
let itemId: (seedKey: string) => string;
let seq = 0;

/** A confirmed payment against a yearly line of plan year 2026. */
function pay(itemKey: string, amountMinor: number, txnDate: string) {
  seq += 1;
  const id = `0190a000-0000-7000-8000-${String(seq).padStart(12, '0')}`;
  const t: Transaction = {
    id,
    familyId: 'f1',
    kind: 'expense',
    amountMinor,
    currencyCode: 'INR',
    txnDate: txnDate as IsoDate,
    period: { year: Number(txnDate.slice(0, 4)), month: Number(txnDate.slice(5, 7)) },
    merchant: null,
    note: null,
    enteredBy: 'u1',
    paidBy: 'u1',
    captureMethod: 'typed',
    status: 'confirmed',
    mergedInto: null,
    allocations: [{ itemId: itemId(itemKey), amountMinor, planYear: 2026 }],
    entryTimeZone: 'Asia/Kolkata',
    deletedAt: null,
    createdAt: clock.now(),
    updatedAt: clock.now(),
  };
  ledger.rows.set(id, t);
}

const line2026 = async (seedKey: string) => (await yearPlans.findByYear('f1', 2026))!.lines.find((l) => l.itemId === itemId(seedKey))!;

beforeEach(async () => {
  seq = 0;
  const planUow = new InMemoryPlanUnitOfWork();
  const ids = new SequentialIds();
  clock = new FixedClock('2027-01-01T04:00:00Z');
  await new ImportPlanUseCase(planUow, planUow.plan, ids, clock).execute({ actor: admin, plan: samplePlanImport });
  const items = await planUow.plan.listItems('f1', { includeArchived: true });
  itemId = (seedKey) => items.find((i) => i.seedKey === seedKey)!.id;
  const families = new InMemoryFamilyGateway();
  await families.save(familyRecord());

  yearPlans = new InMemoryYearPlanGateway();
  yearUow = new InMemoryYearPlanUnitOfWork(yearPlans);
  ledger = new InMemoryTransactionGateway();
  const paid = ledger.yearPaid(yearPlans);
  ensureYear = new EnsureYearPlanUseCase(yearPlans, planUow.plan, ids);
  await ensureYear.execute({ familyId: 'f1', year: 2026 });
  // Settle 2026 except three lines, so the review is easy to read.
  const keep = new Set(['car_bike_service', 'tour', 'bike_ins']);
  for (const l of (await yearPlans.findByYear('f1', 2026))!.lines) {
    if (!keep.has(items.find((i) => i.id === l.itemId)!.seedKey!)) await yearPlans.saveLine({ ...l, state: 'done' });
  }
  pay('car_bike_service', 500_000, '2026-08-10');

  review = new GetYearEndReviewUseCase(yearPlans, paid);
  answer = new AnswerYearEndLineUseCase(yearUow, yearPlans, clock);
  const yearView = new GetYearPlanUseCase(ensureYear, yearPlans, paid, families, clock);
  nextReview = new GetNextYearReviewUseCase(yearView, yearPlans);
  confirm = new ConfirmNextYearReviewUseCase(yearUow, yearPlans, clock);
  setAmount = new SetYearLineAmountUseCase(yearUow, yearPlans, clock);
  forecast = new GetForecastUseCase(families, new InMemoryPotGateway(), yearPlans, paid, planUow.plan, clock);
});

describe('GetYearEndReviewUseCase', () => {
  it('on 2027-01-01 lists 2026 lines still open with something left; done and fully paid lines are not listed', async () => {
    pay('bike_ins', 150_000, '2026-11-05');
    const r = await review.execute({ actor: member, year: 2026 });
    expect(r.lines.map((l) => l.name)).toEqual(['Family Tour / Vacation', 'Car & Bike Servicing']);
    expect(r.lines.find((l) => l.name === 'Car & Bike Servicing')).toMatchObject({ plannedMinor: 1_500_000, paidMinor: 500_000, remainingMinor: 1_000_000, dueMonth: null });
  });

  it('an unknown year gives an empty review', async () => {
    expect((await review.execute({ actor: admin, year: 2024 })).lines).toEqual([]);
  });
});

describe('AnswerYearEndLineUseCase', () => {
  it('done closes the line; drop cancels it; both leave the review', async () => {
    await answer.execute({ actor: admin, year: 2026, lineId: (await line2026('tour')).id, answer: { kind: 'drop' } });
    await answer.execute({ actor: admin, year: 2026, lineId: (await line2026('bike_ins')).id, answer: { kind: 'done' } });
    expect((await line2026('tour')).state).toBe('cancelled');
    expect((await line2026('bike_ins')).state).toBe('done');
    expect((await review.execute({ actor: admin, year: 2026 })).lines.map((l) => l.name)).toEqual(['Car & Bike Servicing']);
    expect(yearUow.activity.all().map((e) => e.action)).toEqual(['year_end.drop', 'year_end.done']);
  });

  it('carry a part-paid Car & Bike Servicing (₹5,000 of ₹15,000) to March 2027: the forecast shows ₹10,000 in March, never ₹15,000 (Review Focus 4)', async () => {
    const service = await line2026('car_bike_service');
    await answer.execute({ actor: admin, year: 2026, lineId: service.id, answer: { kind: 'carry', dueMonth: 3 } });
    expect(await line2026('car_bike_service')).toMatchObject({ year: 2026, dueYear: 2027, dueMonth: 3, state: 'open' });
    const f = await forecast.execute({ actor: admin });
    const march = f.bills.find((b) => b.period.year === 2027 && b.period.month === 3)!;
    expect(march.lines).toEqual([expect.objectContaining({ name: 'Car & Bike Servicing', remainingMinor: 1_000_000 })]);
    expect(f.bills.flatMap((b) => b.lines).filter((l) => l.name === 'Car & Bike Servicing')).toHaveLength(1);
    expect((await review.execute({ actor: admin, year: 2026 })).lines.map((l) => l.name)).not.toContain('Car & Bike Servicing');
  });

  it('an unanswered dated 2026 line is overdue and counted once in month 0; an unanswered undated one is not in 2027 undated (PRD §7 test 19)', async () => {
    await ensureYear.execute({ familyId: 'f1', year: 2027 });
    const f = await forecast.execute({ actor: admin });
    const bike = f.bills.flatMap((b) => b.lines).filter((l) => l.name === 'Bike Insurance');
    // Overdue 2026 bike insurance once in January, plus 2027's own bike insurance in November.
    expect(f.bills[0]!.lines).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Bike Insurance', remainingMinor: 150_000, status: 'overdue' })]));
    expect(bike.filter((l) => l.status === 'overdue')).toHaveLength(1);
    const undated2027 = f.undated.find((u) => u.year === 2027)!;
    expect(undated2027.count).toBe(13); // 2027's own undated lines only; 2026's tour stays under "last year, still open"
  });

  it('refuses a member, a line of another year, a second answer and a bad month', async () => {
    const tour = await line2026('tour');
    await expect(answer.execute({ actor: member, year: 2026, lineId: tour.id, answer: { kind: 'done' } })).rejects.toBeInstanceOf(NotAllowedError);
    await expect(answer.execute({ actor: admin, year: 2025, lineId: tour.id, answer: { kind: 'done' } })).rejects.toBeInstanceOf(YearLineNotFoundError);
    await expect(answer.execute({ actor: admin, year: 2026, lineId: tour.id, answer: { kind: 'carry', dueMonth: 13 } })).rejects.toBeInstanceOf(InvalidYearPlanCommandError);
    await answer.execute({ actor: admin, year: 2026, lineId: tour.id, answer: { kind: 'carry', dueMonth: null } });
    await expect(answer.execute({ actor: admin, year: 2026, lineId: tour.id, answer: { kind: 'drop' } })).rejects.toBeInstanceOf(YearEndAlreadyAnsweredError);
  });
});

describe('next year review (1 December)', () => {
  beforeEach(() => clock.set('2026-12-01T04:00:00Z'));

  it('shows next year’s lines until confirmed; confirming twice is harmless', async () => {
    await ensureYear.execute({ familyId: 'f1', year: 2027 });
    const before = await nextReview.execute({ actor: member, year: 2027 });
    expect(before).toMatchObject({ year: 2027, confirmed: false });
    expect(before.lines).toHaveLength(22);
    await expect(confirm.execute({ actor: member, year: 2027 })).rejects.toBeInstanceOf(NotAllowedError);
    await confirm.execute({ actor: admin, year: 2027 });
    await confirm.execute({ actor: admin, year: 2027 });
    expect((await nextReview.execute({ actor: admin, year: 2027 })).confirmed).toBe(true);
  });

  it("changing a 2027 line's amount changes the 2027 set-aside and leaves the template alone", async () => {
    const plan = await ensureYear.execute({ familyId: 'f1', year: 2027 });
    const tour = plan.lines.find((l) => l.itemId === itemId('tour'))!;
    const total = async () => (await nextReview.execute({ actor: admin, year: 2027 })).lines.reduce((s, l) => s + (l.state === 'cancelled' ? 0 : l.plannedMinor), 0);
    const before = await total();
    await setAmount.execute({ actor: admin, lineId: tour.id, plannedMinor: 6_000_000 });
    expect(await total()).toBe(before + 1_000_000);
    expect(yearUow.activity.all().at(-1)).toMatchObject({ action: 'year_line.amount', before: { plannedMinor: 5_000_000 }, after: { plannedMinor: 6_000_000 } });
    const plan2028 = await ensureYear.execute({ familyId: 'f1', year: 2028 });
    expect(plan2028.lines.find((l) => l.itemId === itemId('tour'))!.plannedMinor).toBe(5_000_000);
    await expect(setAmount.execute({ actor: admin, lineId: tour.id, plannedMinor: -1 })).rejects.toBeInstanceOf(InvalidYearPlanCommandError);
  });
});
