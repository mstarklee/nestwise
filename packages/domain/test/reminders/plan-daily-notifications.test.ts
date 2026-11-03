import { describe, expect, it } from 'vitest';
import {
  type DailyFacts,
  type DailyYearLine,
  PlanDailyNotificationsUseCase,
  type RedState,
} from '../../src/reminders';
import type { IsoDate, Period } from '../../src/shared';

const plan = new PlanDailyNotificationsUseCase();
const members = [{ userId: 'u1' }, { userId: 'u2' }];
const date = (value: string) => value as IsoDate;

const line = (overrides: Partial<DailyYearLine>): DailyYearLine => ({
  id: 'yl',
  name: 'Item',
  dueYear: 2027,
  dueMonth: null,
  dueDay: null,
  remainingMinor: 100,
  state: 'open',
  ...overrides,
});

const schoolT1 = line({ id: 'school-t1', name: 'Kids’ School Fees — Term 1', dueYear: 2027, dueMonth: 5, remainingMinor: 6_000_000 });
const bike = line({ id: 'bike', name: 'Bike Insurance', dueYear: 2026, dueMonth: 11, remainingMinor: 150_000 });

const months = (start: Period, ends: number[]) =>
  ends.map((endMinor, i) => {
    const index = start.year * 12 + start.month - 1 + i;
    return { period: { year: Math.floor(index / 12), month: (index % 12) + 1 }, endMinor };
  });

function facts(overrides: Partial<DailyFacts> = {}): DailyFacts {
  return {
    familyId: 'f1',
    members,
    today: date('2026-11-01'),
    forecast: { balanceMinor: 0, months: months({ year: 2026, month: 11 }, Array(12).fill(1_000)), redMonths: [], undated: [] },
    yearLines: [],
    checklistPending: false,
    lastMonthOpen: false,
    lastYearOpen: null,
    nextYearReady: false,
    lastRedState: null,
    ...overrides,
  };
}

const kinds = (result: ReturnType<PlanDailyNotificationsUseCase['execute']>) => result.notifications.map((n) => `${n.userId}:${n.kind}`);

describe('PlanDailyNotificationsUseCase', () => {
  it('on 1 Apr 2027 plans bill_prior_month for School Term 1 (May, ₹60,000) to every member', () => {
    const result = plan.execute(
      facts({ today: date('2027-04-01'), yearLines: [schoolT1], forecast: { ...facts().forecast, months: months({ year: 2027, month: 4 }, [24_191_667, ...Array(11).fill(0)]) } }),
    );
    expect(result.notifications).toEqual(
      ['u1', 'u2'].map((userId) => ({
        userId,
        kind: 'bill_prior_month',
        dedupeKey: 'bill:school-t1:bill_prior_month:2027-05',
        message: { key: 'bill_prior_month', values: { name: 'Kids’ School Fees — Term 1', amountMinor: 6_000_000, potMinor: 24_191_667 } },
        url: '/year/2027',
        emailFallback: true,
      })),
    );
  });

  it('the 1 Nov checklist message carries reviewMonth 2026-10 while October is open; still one message per person', () => {
    const result = plan.execute(facts({ checklistPending: true, lastMonthOpen: true }));
    expect(kinds(result)).toEqual(['u1:checklist', 'u2:checklist']);
    expect(result.notifications[0]!.message.values).toMatchObject({ reviewMonth: { year: 2026, month: 10 } });
    const reviewOnly = plan.execute(facts({ checklistPending: false, lastMonthOpen: true }));
    expect(kinds(reviewOnly)).toEqual(['u1:checklist', 'u2:checklist']);
    expect(plan.execute(facts({ checklistPending: true })).notifications[0]!.message.values).not.toHaveProperty('reviewMonth');
  });

  it('on 1 Jan 2027 plans one year_end message per person while 2026 has open lines; none when nothing is open', () => {
    const r = plan.execute(facts({ today: date('2027-01-01'), lastYearOpen: { count: 3, totalMinor: 2_300_000 } }));
    const yearEnd = r.notifications.filter((n) => n.kind === 'year_end');
    expect(yearEnd.map((n) => n.userId)).toEqual(['u1', 'u2']);
    expect(yearEnd[0]).toMatchObject({ dedupeKey: 'year_end:2026', url: '/year/2026/year-end', emailFallback: false, message: { values: { year: 2026, count: 3, totalMinor: 2_300_000 } } });
    expect(plan.execute(facts({ today: date('2027-01-01') })).notifications.filter((n) => n.kind === 'year_end')).toEqual([]);
    expect(plan.execute(facts({ today: date('2027-01-02'), lastYearOpen: { count: 3, totalMinor: 2_300_000 } })).notifications.filter((n) => n.kind === 'year_end')).toEqual([]);
  });

  it('on 1 Dec 2026 plans next_year once next year is waiting for review', () => {
    const r = plan.execute(facts({ today: date('2026-12-01'), nextYearReady: true }));
    expect(r.notifications.filter((n) => n.kind === 'next_year')).toEqual([
      expect.objectContaining({ userId: 'u1', dedupeKey: 'next_year:2027', url: '/year/2027/review', message: { key: 'next_year', values: { year: 2027 } } }),
      expect.objectContaining({ userId: 'u2', dedupeKey: 'next_year:2027' }),
    ]);
    expect(plan.execute(facts({ today: date('2026-12-01') })).notifications.filter((n) => n.kind === 'next_year')).toEqual([]);
  });

  it('on 1 Nov 2026 plans the checklist reminder and bill_due_month for bike insurance', () => {
    const result = plan.execute(facts({ yearLines: [bike, schoolT1], checklistPending: true, forecast: { ...facts().forecast, balanceMinor: 3_691_666 } }));
    expect(kinds(result)).toEqual(['u1:checklist', 'u2:checklist', 'u1:bill_due_month', 'u2:bill_due_month']);
    expect(result.notifications.find((n) => n.kind === 'checklist')).toMatchObject({ dedupeKey: 'checklist:2026-11', url: '/home', message: { values: { potMinor: 3_691_666 } } });
    expect(result.notifications.find((n) => n.kind === 'bill_due_month')).toMatchObject({
      dedupeKey: 'bill:bike:bill_due_month:2026-11',
      message: { values: { amountMinor: 150_000, potMinor: 3_691_666 } },
    });
  });

  it('skips the checklist once it is all answered, and bills that are paid, closed or not due', () => {
    const paid = line({ ...bike, id: 'paid', remainingMinor: 0 });
    const closed = line({ ...bike, id: 'closed', state: 'before_nestwise' });
    const result = plan.execute(facts({ yearLines: [paid, closed], checklistPending: false }));
    expect(result.notifications).toEqual([]);
    expect(plan.execute(facts({ today: date('2026-11-02'), yearLines: [bike], checklistPending: true })).notifications).toEqual([]);
  });

  it('plans bill_3_days only for lines with a dueDay', () => {
    const withDay = line({ id: 'renewal', name: 'Car Insurance', dueYear: 2026, dueMonth: 11, dueDay: 20, remainingMinor: 650_000 });
    const result = plan.execute(facts({ today: date('2026-11-17'), yearLines: [withDay, bike] }));
    expect(kinds(result)).toEqual(['u1:bill_3_days', 'u2:bill_3_days']);
    expect(result.notifications[0]).toMatchObject({ dedupeKey: 'bill:renewal:bill_3_days:2026-11', message: { values: { dueDate: '2026-11-20' } } });
    // A day past the month's end means its last day: 31 Feb → 28 Feb, three days before is the 25th.
    const feb = line({ id: 'feb', dueYear: 2027, dueMonth: 2, dueDay: 31 });
    expect(kinds(plan.execute(facts({ today: date('2027-02-25'), yearLines: [feb] })))).toEqual(['u1:bill_3_days', 'u2:bill_3_days']);
    // Three days before the 2nd is the previous month.
    const early = line({ id: 'early', dueYear: 2026, dueMonth: 12, dueDay: 2 });
    expect(kinds(plan.execute(facts({ today: date('2026-11-29'), yearLines: [early] })))).toEqual(['u1:bill_3_days', 'u2:bill_3_days']);
  });

  it('does not repeat red when the same shortfall persists; does when it grows by >10%', () => {
    const red = (ends: number[]) => {
      const ms = months({ year: 2026, month: 11 }, ends);
      return { ...facts().forecast, months: ms, redMonths: ms.filter((m) => m.endMinor < 0).map((m) => m.period) };
    };
    const short = red([100, 100, -1_000_000, -500_000, ...Array(8).fill(0)]);
    const first = plan.execute(facts({ today: date('2026-11-05'), forecast: short }));
    expect(kinds(first)).toEqual(['u1:red', 'u2:red']);
    expect(first.notifications[0]).toMatchObject({ dedupeKey: 'red:2026-11-05', url: '/forecast', emailFallback: true, message: { values: { shortfallMinor: 1_000_000, period: { year: 2027, month: 1 } } } });
    const state: RedState = { firstRed: { year: 2027, month: 1 }, shortfallMinor: 1_000_000 };
    expect(first.nextRedState).toEqual(state);

    const same = plan.execute(facts({ today: date('2026-11-06'), forecast: short, lastRedState: state }));
    expect(same.notifications).toEqual([]);
    expect(same.nextRedState).toEqual(state);

    const slightlyWorse = plan.execute(facts({ today: date('2026-11-07'), forecast: red([100, 100, -1_100_000, ...Array(9).fill(0)]), lastRedState: state }));
    expect(slightlyWorse.notifications).toEqual([]); // exactly 10% more is not "more than 10%"
    expect(slightlyWorse.nextRedState).toEqual(state); // compared against the last alert, not yesterday

    const worse = plan.execute(facts({ today: date('2026-11-08'), forecast: red([100, 100, -1_100_001, ...Array(9).fill(0)]), lastRedState: state }));
    expect(kinds(worse)).toEqual(['u1:red', 'u2:red']);

    const earlier = plan.execute(facts({ today: date('2026-11-09'), forecast: red([100, -10, -1_000_000, ...Array(9).fill(0)]), lastRedState: state }));
    expect(kinds(earlier)).toEqual(['u1:red', 'u2:red']);
    expect(earlier.nextRedState).toEqual({ firstRed: { year: 2026, month: 12 }, shortfallMinor: 1_000_000 });

    const cleared = plan.execute(facts({ today: date('2026-11-10'), lastRedState: state }));
    expect(cleared.notifications).toEqual([]);
    expect(cleared.nextRedState).toBeNull();
  });

  it('marks only bill and red reminders as emailFallback', () => {
    const ms = months({ year: 2026, month: 11 }, [-5, ...Array(11).fill(0)]);
    const result = plan.execute(
      facts({
        yearLines: [bike, line({ id: 'next', dueYear: 2026, dueMonth: 12, remainingMinor: 10 })],
        checklistPending: true,
        forecast: { ...facts().forecast, months: ms, redMonths: [ms[0]!.period] },
      }),
    );
    const byKind = Object.fromEntries(result.notifications.map((n) => [n.kind, n.emailFallback]));
    expect(byKind).toEqual({ checklist: false, bill_prior_month: true, bill_due_month: true, red: true });
  });

  it('plans undated on the 15th only when undated lines exist', () => {
    const undated = [{ year: 2026, count: 13, totalMinor: 15_700_000 }];
    const on15th = plan.execute(facts({ today: date('2026-11-15'), forecast: { ...facts().forecast, undated } }));
    expect(on15th.notifications).toEqual(
      ['u1', 'u2'].map((userId) => ({
        userId,
        kind: 'undated',
        dedupeKey: 'undated:2026-11',
        message: { key: 'undated', values: { count: 13, totalMinor: 15_700_000 } },
        url: '/year/2026',
        emailFallback: false,
      })),
    );
    expect(plan.execute(facts({ today: date('2026-11-14'), forecast: { ...facts().forecast, undated } })).notifications).toEqual([]);
    expect(plan.execute(facts({ today: date('2026-11-15') })).notifications).toEqual([]);
  });
});
