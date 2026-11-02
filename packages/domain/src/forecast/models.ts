import type { Actor, Period } from '../shared';
import type { YearLineStatus } from '../year-plan';

export interface ForecastMonthInput {
  readonly period: Period;
  readonly setAsideMinor: number;
  /** What is still owed on dated lines due this month. */
  readonly datedOutMinor: number;
  /** True when the month's year has no year plan yet and figures come from the template. */
  readonly estimate: boolean;
}

export interface ForecastInput {
  /** B0: the confirmed pot balance now. */
  readonly balanceMinor: number;
  /** The current month's deposit is already confirmed or skipped, so no more money arrives this month. */
  readonly currentDepositSettled: boolean;
  /** Owed on overdue dated lines; counted once, in the current month. */
  readonly overdueOutMinor: number;
  /** Exactly 12 months, starting with the current one. */
  readonly months: readonly ForecastMonthInput[];
}

export interface ForecastMonth {
  readonly period: Period;
  readonly inMinor: number;
  readonly outMinor: number;
  readonly endMinor: number;
  readonly estimate: boolean;
}

export interface Forecast {
  readonly months: readonly ForecastMonth[];
  readonly safeToSpendNowMinor: number;
  readonly redMonths: readonly Period[];
  /** Extra set-aside per month, from now, that clears every red month that a deposit can still reach. */
  readonly fixPerMonthMinor: number | null;
  /** A one-off top-up for red months no deposit can reach before they end. */
  readonly topUpNowMinor: number | null;
}

/** The 12-month pot projection (TRD §5.5). */
export function projectPot(input: ForecastInput): Forecast {
  const months: ForecastMonth[] = [];
  let end = input.balanceMinor;
  let lowest = input.balanceMinor;
  let depositsSoFar = 0;
  let fixPerMonth: number | null = null;
  let topUpNow: number | null = null;
  const redMonths: Period[] = [];

  input.months.forEach((month, i) => {
    const inMinor = i === 0 && input.currentDepositSettled ? 0 : month.setAsideMinor;
    const outMinor = month.datedOutMinor + (i === 0 ? input.overdueOutMinor : 0);
    end = end + inMinor - outMinor;
    if (inMinor > 0) depositsSoFar += 1;
    lowest = Math.min(lowest, end);

    if (end < 0) {
      redMonths.push(month.period);
      const shortfall = -end;
      if (depositsSoFar === 0) {
        topUpNow = Math.max(topUpNow ?? 0, shortfall);
      } else {
        fixPerMonth = Math.max(fixPerMonth ?? 0, Math.ceil(shortfall / depositsSoFar));
      }
    }
    months.push({ period: month.period, inMinor, outMinor, endMinor: end, estimate: month.estimate });
  });

  return {
    months,
    safeToSpendNowMinor: Math.max(0, lowest),
    redMonths,
    fixPerMonthMinor: fixPerMonth,
    topUpNowMinor: topUpNow,
  };
}

export interface ForecastCommand {
  readonly actor: Actor;
}

/** A yearly bill in a forecast month. yearLineId is null when the month's year has no plan yet (a template estimate). */
export interface ForecastBillLine {
  readonly yearLineId: string | null;
  readonly name: string;
  readonly remainingMinor: number;
  readonly status: YearLineStatus;
}

export interface ForecastBills {
  readonly period: Period;
  readonly lines: readonly ForecastBillLine[];
}

/** Lines with no month yet that still need money, for one plan year (TRD §5.5 undatedRemaining[Y]). */
export interface UndatedSummary {
  readonly year: number;
  readonly totalMinor: number;
  readonly count: number;
  readonly lines: readonly { readonly yearLineId: string; readonly name: string; readonly remainingMinor: number }[];
}

export interface ForecastView extends Forecast {
  /** B0: the confirmed pot balance now. */
  readonly balanceMinor: number;
  /** One entry per forecast month, in order; month 0 also lists overdue bills. */
  readonly bills: readonly ForecastBills[];
  readonly undated: readonly UndatedSummary[];
  /** The monthly spending and savings plans (templates), so the screen can show the total cash the household needs. */
  readonly monthlyPlanMinor: number;
  readonly savingsPlanMinor: number;
}

export type HomeCard = 'checklist' | 'undated' | 'month_review';

export interface HomeSummary {
  readonly pot: {
    readonly balanceMinor: number;
    readonly safeToSpendNowMinor: number;
    readonly firstRed: { readonly period: Period; readonly shortfallMinor: number } | null;
    readonly fixPerMonthMinor: number | null;
  };
  readonly next3Months: readonly ForecastBills[];
  readonly thisMonth: { readonly plannedMinor: number; readonly actualMinor: number; readonly groupsOver: readonly string[] };
  readonly undated: readonly UndatedSummary[];
  readonly cards: readonly HomeCard[];
}
