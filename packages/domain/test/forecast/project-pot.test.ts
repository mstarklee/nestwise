import { describe, expect, it } from 'vitest';
import { type ForecastInput, type ForecastMonthInput, projectPot } from '../../src/forecast';
import { setAsideFor } from '../../src/pot';
import { addMonths, type Period } from '../../src/shared';

const YEAR_TOTAL = 44_300_000;
// Dated yearly bills of the sample plan, by calendar month (paise).
const DATED_BY_MONTH: Record<number, number> = {
  1: 1_500_000, // Pongal
  5: 6_000_000, // School Term 1
  6: 12_000_000, // In-laws health + term life
  7: 5_300_000, // Self + parents health
  10: 3_650_000, // Car insurance + School Term 2
  11: 150_000, // Bike insurance
};
const key = (p: Period) => `${p.year}-${String(p.month).padStart(2, '0')}`;

function months(
  start: Period,
  opts: { extra?: Record<string, number>; total?: number; override?: number | null } = {},
): ForecastMonthInput[] {
  const total = opts.total ?? YEAR_TOTAL;
  return Array.from({ length: 12 }, (_, i) => {
    const period = addMonths(start, i);
    return {
      period,
      setAsideMinor: setAsideFor(period.month, total, opts.override ?? null),
      datedOutMinor: total === 0 ? 0 : (DATED_BY_MONTH[period.month] ?? 0) + (opts.extra?.[key(period)] ?? 0),
      estimate: false,
    };
  });
}

const novemberStart = (o: { balanceMinor: number; currentDepositSettled: boolean; extra?: Record<string, number> }): ForecastInput => ({
  balanceMinor: o.balanceMinor,
  currentDepositSettled: o.currentDepositSettled,
  overdueOutMinor: 0,
  months: months({ year: 2026, month: 11 }, { extra: o.extra ?? {} }),
});

const marchStart = (): ForecastInput => ({
  balanceMinor: 0,
  currentDepositSettled: false,
  overdueOutMinor: 0,
  months: months({ year: 2027, month: 3 }),
});

describe('projectPot', () => {
  it('reproduces the PRD §5.4 worked example: Nov 2026 start, B0 = 0, dated lines only', () => {
    const f = projectPot(novemberStart({ balanceMinor: 0, currentDepositSettled: false }));
    expect(f.months.map((m) => m.endMinor)).toEqual([
      3_541_666, 7_233_332, 9_424_999, 13_116_666, 16_808_333, 20_500_000,
      18_191_667, 9_883_334, 8_275_001, 11_966_668, 15_658_334, 15_700_000,
    ]);
    expect(f.months[0]).toMatchObject({ inMinor: 3_691_666, outMinor: 150_000 });
    expect(f.safeToSpendNowMinor).toBe(0);
    expect(f.redMonths).toEqual([]);
    expect(f.fixPerMonthMinor).toBeNull();
    expect(f.topUpNowMinor).toBeNull();
  });

  it('after the November deposit is confirmed, safe to spend is ₹35,416.66', () => {
    const g = projectPot(novemberStart({ balanceMinor: 3_691_666, currentDepositSettled: true }));
    expect(g.months[0]).toMatchObject({ inMinor: 0, endMinor: 3_541_666 });
    expect(g.safeToSpendNowMinor).toBe(3_541_666);
  });

  it('a March start from ₹0 is ₹32,333.32 short in June, and the fix clears every red month', () => {
    const input = marchStart();
    const m = projectPot(input);
    expect(m.months[3]!.endMinor).toBe(-3_233_332);
    expect(m.redMonths[0]).toEqual({ year: 2027, month: 6 });
    // June, July (−48,416.65) and August (−11,499.98) are all short.
    expect(m.redMonths).toEqual([
      { year: 2027, month: 6 },
      { year: 2027, month: 7 },
      { year: 2027, month: 8 },
    ]);
    expect(m.months[4]!.endMinor).toBe(-4_841_665);
    expect(m.fixPerMonthMinor).toBe(968_333); // July decides: ceil(4,841,665 / 5)
    expect(m.topUpNowMinor).toBeNull();

    const fixed = projectPot({
      ...input,
      months: input.months.map((mo) => ({ ...mo, setAsideMinor: mo.setAsideMinor + m.fixPerMonthMinor! })),
    });
    expect(fixed.redMonths).toEqual([]);
  });

  it('dating the ₹50,000 tour in May leaves June at ₹48,833.34 and July at ₹32,750.01', () => {
    const t = projectPot(novemberStart({ balanceMinor: 0, currentDepositSettled: false, extra: { '2027-05': 5_000_000 } }));
    expect(t.months[7]!.endMinor).toBe(4_883_334);
    expect(t.months[8]!.endMinor).toBe(3_275_001);
    expect(t.redMonths).toEqual([]);
  });

  it('an all-zero plan has no red months, no fix, and nothing safe to spend (no division by zero)', () => {
    const z = projectPot({
      balanceMinor: 0,
      currentDepositSettled: false,
      overdueOutMinor: 0,
      months: months({ year: 2026, month: 11 }, { total: 0 }),
    });
    expect(z.redMonths).toEqual([]);
    expect(z.fixPerMonthMinor).toBeNull();
    expect(z.topUpNowMinor).toBeNull();
    expect(z.safeToSpendNowMinor).toBe(0);
  });

  it('a set-aside override of 0 asks for a top-up instead of dividing by zero', () => {
    const o = projectPot({
      balanceMinor: 0,
      currentDepositSettled: false,
      overdueOutMinor: 0,
      months: months({ year: 2026, month: 11 }, { override: 0 }),
    });
    expect(o.fixPerMonthMinor).toBeNull();
    expect(o.topUpNowMinor).toBe(28_600_000); // every dated bill Nov–Oct: ₹2,71,000 + Pongal ₹15,000
    expect(o.safeToSpendNowMinor).toBe(0);
  });

  it('red in month 0 with the deposit already settled → top up now, not per month', () => {
    const r = projectPot({ ...novemberStart({ balanceMinor: 100_000, currentDepositSettled: true }), overdueOutMinor: 500_000 });
    expect(r.months[0]).toMatchObject({ outMinor: 650_000, endMinor: -550_000 });
    expect(r.redMonths).toEqual([{ year: 2026, month: 11 }]);
    expect(r.fixPerMonthMinor).toBeNull();
    expect(r.topUpNowMinor).toBe(550_000);
    expect(r.safeToSpendNowMinor).toBe(0);
  });

  it('safe to spend is the low point, and never more than the balance today', () => {
    const s = projectPot(novemberStart({ balanceMinor: 20_000_000, currentDepositSettled: true }));
    expect(s.safeToSpendNowMinor).toBe(19_850_000); // November, after bike insurance
    const quiet = projectPot({
      balanceMinor: 5_000_000,
      currentDepositSettled: true,
      overdueOutMinor: 0,
      months: months({ year: 2026, month: 11 }, { total: 0 }),
    });
    expect(quiet.safeToSpendNowMinor).toBe(5_000_000);
  });

  it('carries the estimate flag through', () => {
    const input = novemberStart({ balanceMinor: 0, currentDepositSettled: false });
    const f = projectPot({ ...input, months: input.months.map((mo, i) => ({ ...mo, estimate: i >= 2 })) });
    expect(f.months.map((mo) => mo.estimate)).toEqual([false, false, ...Array(10).fill(true)]);
  });
});
