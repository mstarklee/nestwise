import { describe, expect, test } from 'vitest';
import { biggestMonthAhead } from '../../src/forecast';
import type { ForecastBillLine, ForecastBills, ForecastMonth } from '../../src/forecast';

const line = (name: string, remainingMinor: number): ForecastBillLine => ({
  yearLineId: name,
  itemId: name,
  planYear: 2026,
  name,
  plannedMinor: remainingMinor,
  paidMinor: 0,
  remainingMinor,
  status: 'planned',
});

/** 12 months from Nov 2026 with a flat 10,000 in and the given bills; end balances follow from the money. */
function build(bills: Record<number, ForecastBillLine[]>, startMinor = 100_000) {
  const months: ForecastMonth[] = [];
  const billMonths: ForecastBills[] = [];
  let end = startMinor;
  for (let i = 0; i < 12; i++) {
    const index = 10 + i; // Nov 2026 = month index 10 of a zero-based year count
    const period = { year: 2026 + Math.floor(index / 12), month: (index % 12) + 1 };
    const lines = bills[i] ?? [];
    const out = lines.reduce((s, l) => s + l.remainingMinor, 0);
    end = end + 10_000 - out;
    months.push({ period, inMinor: 10_000, outMinor: out, endMinor: end, estimate: false });
    billMonths.push({ period, lines });
  }
  return { months, billMonths };
}

describe('biggestMonthAhead', () => {
  test('no dated bills in months 4–12 gives null', () => {
    const { months, billMonths } = build({ 0: [line('a', 5_000)], 2: [line('b', 5_000)] });
    expect(biggestMonthAhead(months, billMonths)).toBeNull();
  });

  test('a bigger bill in months 1–3 is ignored; months 4–12 decide', () => {
    const { months, billMonths } = build({ 1: [line('huge', 90_000)], 5: [line('small', 20_000)] });
    const result = biggestMonthAhead(months, billMonths);
    expect(result?.period).toEqual(months[5]!.period);
    expect(result?.totalMinor).toBe(20_000);
    expect(result?.openingMinor).toBe(months[4]!.endMinor + 10_000);
  });

  test('equal totals pick the earlier month', () => {
    const { months, billMonths } = build({ 4: [line('a', 20_000)], 8: [line('b', 20_000)] });
    expect(biggestMonthAhead(months, billMonths)?.period).toEqual(months[4]!.period);
  });

  test('shortOnTheWay names the first short month up to the biggest, not one after it', () => {
    // Index 3 ends below zero; the biggest month is index 6; index 9 is short too but comes after it.
    const { months, billMonths } = build({ 3: [line('early', 150_000)], 6: [line('big', 200_000)], 9: [line('late', 50_000)] }, 50_000);
    const result = biggestMonthAhead(months, billMonths);
    expect(result?.period).toEqual(months[6]!.period);
    expect(result?.shortOnTheWay).toEqual({ period: months[3]!.period, shortfallMinor: -months[3]!.endMinor });
    const { months: m2, billMonths: b2 } = build({ 6: [line('big', 200_000)] }, 50_000);
    expect(biggestMonthAhead(m2, b2)?.shortOnTheWay?.period).toEqual(m2[6]!.period);
  });
});

test('a month whose bills are all paid is never the biggest', () => {
  const { months, billMonths } = build({ 5: [line('paid', 0)] });
  expect(biggestMonthAhead(months, billMonths)).toBeNull();
});
