import type { IsoDate, Period } from '../shared';
import type { YearLineState } from '../year-plan';

export type ReminderKind = 'checklist' | 'bill_prior_month' | 'bill_due_month' | 'bill_3_days' | 'red' | 'undated' | 'next_year' | 'year_end' | 'spending_alert';

/**
 * What to say, as a message key plus values; the app turns it into words from messages/en.json (so the core holds
 * no copy) and formats the amounts in the family's currency.
 */
export interface ReminderMessage {
  readonly key: ReminderKind;
  readonly values: Readonly<Record<string, string | number | Period>>;
}

export interface PlannedNotification {
  readonly userId: string;
  /** TRD §8.4: bill:{lineId}:{kind}:{yyyy-mm}, checklist:{yyyy-mm}, undated:{yyyy-mm}, red:{yyyy-mm-dd}. Sent once per user. */
  readonly dedupeKey: string;
  readonly kind: ReminderKind;
  readonly message: ReminderMessage;
  /** The screen a tap opens. */
  readonly url: string;
  /** Sent by email when the person has no working push subscription (bills and shortfalls only, TRD §8.3). */
  readonly emailFallback: boolean;
}

/** The last shortfall the family was warned about; null once the forecast is clear again. */
export interface RedState {
  readonly firstRed: Period;
  readonly shortfallMinor: number;
}

/** A yearly line as the reminders need it: when it is due and what is still owed. */
export interface DailyYearLine {
  readonly id: string;
  readonly name: string;
  readonly dueYear: number;
  readonly dueMonth: number | null;
  readonly dueDay: number | null;
  readonly remainingMinor: number;
  readonly state: YearLineState;
}

/** Everything the decision needs for one family on one day; gathered by the daily job. */
export interface DailyFacts {
  readonly familyId: string;
  readonly members: readonly { readonly userId: string }[];
  /** Today in the family's time zone. */
  readonly today: IsoDate;
  readonly forecast: {
    readonly balanceMinor: number;
    readonly months: readonly { readonly period: Period; readonly endMinor: number }[];
    readonly redMonths: readonly Period[];
    readonly undated: readonly { readonly year: number; readonly count: number; readonly totalMinor: number }[];
  };
  /** This year's and next year's lines. */
  readonly yearLines: readonly DailyYearLine[];
  /** Something on this month's checklist is still unanswered. */
  readonly checklistPending: boolean;
  /** Last month is not closed yet, so the 1st-of-month message also points to its review. */
  readonly lastMonthOpen: boolean;
  /** Last year's lines still open with something left (for the 1 January message); null when there are none. */
  readonly lastYearOpen: { readonly count: number; readonly totalMinor: number } | null;
  /** Next year's plan exists and no Admin has confirmed it yet (for the 1 December message). */
  readonly nextYearReady: boolean;
  readonly lastRedState: RedState | null;
}

export interface DailyPlan {
  readonly notifications: readonly PlannedNotification[];
  readonly nextRedState: RedState | null;
}
