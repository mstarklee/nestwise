import type { Period } from '../shared';
import type { ForecastBillLine, ForecastBills, ForecastMonth } from './models';

export interface BiggestMonth {
  readonly period: Period;
  readonly totalMinor: number;
  readonly lines: readonly ForecastBillLine[];
  /** The pot going into the month: the previous month's end plus this month's deposit. */
  readonly openingMinor: number;
  /** The first month, up to and including this one, that ends below zero. */
  readonly shortOnTheWay: { readonly period: Period; readonly shortfallMinor: number } | null;
}

/** Months 4–12 (indexes 3–11) with dated bills; the largest total wins, the earlier month on a tie. */
export function biggestMonthAhead(months: readonly ForecastMonth[], bills: readonly ForecastBills[]): BiggestMonth | null {
  let best = -1;
  let bestTotal = 0;
  for (let i = 3; i < Math.min(months.length, bills.length, 12); i++) {
    const lines = bills[i]!.lines;
    if (lines.length === 0) continue;
    const total = lines.reduce((sum, l) => sum + l.remainingMinor, 0);
    if (best === -1 || total > bestTotal) {
      best = i;
      bestTotal = total;
    }
  }
  if (best === -1) return null;
  const month = months[best]!;
  const previous = months[best - 1]!;
  const short = months.slice(0, best + 1).find((m) => m.endMinor < 0);
  return {
    period: month.period,
    totalMinor: bestTotal,
    lines: bills[best]!.lines,
    openingMinor: previous.endMinor + month.inMinor,
    shortOnTheWay: short ? { period: short.period, shortfallMinor: -short.endMinor } : null,
  };
}
