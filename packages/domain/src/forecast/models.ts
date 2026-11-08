import type { Checklist } from '../pot';
import type { Actor, IsoDate, Period } from '../shared';
import type { YearLineStatus } from '../year-plan';
import type { BiggestMonth } from './biggest-month';

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
  readonly itemId: string;
  /** The year whose plan a payment goes to (the allocation's planYear). */
  readonly planYear: number;
  readonly name: string;
  readonly plannedMinor: number;
  /** Paid on the line so far; 0 for an estimate. */
  readonly paidMinor: number;
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

export type HomeCard = 'checklist' | 'undated' | 'capture' | 'month_review' | 'next_year' | 'year_end';

/** A month's bills with the pot's balance at the end of that month. */
export interface HomeMonth extends ForecastBills {
  readonly endMinor: number;
}

/** Paid (something is recorded on it this month), still to pay, or planned at ₹0 this month (a monthly bill only). */
export type HomeBillState = 'to_pay' | 'paid' | 'not_this_month';

/** One bill on Home this month: a monthly item marked as a bill, or a yearly bill due now or overdue. */
export interface HomeBill {
  readonly kind: 'monthly' | 'yearly';
  readonly itemId: string;
  /** Yearly bills only: the year line, or null when its year has no plan yet. */
  readonly yearLineId: string | null;
  /** Yearly bills only: the year whose plan a payment goes to. */
  readonly planYear: number | null;
  readonly name: string;
  readonly plannedMinor: number;
  /** Monthly: spent on it this month. Yearly: paid on the line so far. */
  readonly paidMinor: number;
  /** What paying it now takes: the plan for a monthly bill, what is still owed on a yearly one; 0 once paid. */
  readonly toPayMinor: number;
  /** The latest expense on it this month, if any. */
  readonly paidOn: IsoDate | null;
  readonly state: HomeBillState;
  /** A yearly bill due in an earlier month and still owed. */
  readonly overdue: boolean;
}

export interface HomeBills {
  /** Still to pay first (yearly bills, then monthly in plan order), then paid, then "not this month". */
  readonly lines: readonly HomeBill[];
  /** Every bill except "not this month" ones. */
  readonly count: number;
  readonly paidCount: number;
  readonly toPayMinor: number;
}

export interface HomeSummary {
  readonly pot: {
    readonly balanceMinor: number;
    readonly safeToSpendNowMinor: number;
    readonly firstRed: { readonly period: Period; readonly shortfallMinor: number } | null;
    readonly fixPerMonthMinor: number | null;
    /** What goes into the pot each month (next month's deposit). */
    readonly setAsideMinor: number;
    /** No month in the 12-month forecast goes short. */
    readonly allCovered: boolean;
    /** A one-off top-up for short months no deposit can reach. */
    readonly topUpNowMinor: number | null;
  };
  /** The three months after this one; this month's yearly bills are in thisMonth.bills. */
  readonly comingMonths: readonly HomeMonth[];
  /** The biggest month among months 4–12, or null when none has a dated bill. */
  readonly biggestAhead: BiggestMonth | null;
  readonly thisMonth: {
    /** The whole month: every monthly line (everyday spending too) plus the yearly bills in `bills`. */
    readonly plannedMinor: number;
    /** Spent on monthly items this month, plus what is paid on those yearly bills. */
    readonly paidMinor: number;
    /** Monthly lines only, as Budgets shows them. */
    readonly monthlyPlannedMinor: number;
    readonly monthlyActualMinor: number;
    readonly bills: HomeBills;
    readonly groupsOver: readonly string[];
    readonly groups: readonly { readonly groupName: string; readonly plannedMinor: number; readonly actualMinor: number }[];
  };
  readonly undated: readonly UndatedSummary[];
  readonly cards: readonly HomeCard[];
  /** This month's checklist, so the screen does not read it a second time. */
  readonly checklist: Checklist;
}
