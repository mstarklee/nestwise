import type { Actor, IsoDate, Period } from '../shared';
import type { LineFigures, MonthStatus, MonthSummaryLine } from './models';

export type ChecklistAnswer = 'done' | 'different' | 'skipped' | 'unanswered';

/** An item over plan several months in a row, with a rounded-up amount to suggest for the month just started. */
export interface OverStreak {
  readonly itemId: string;
  readonly name: string;
  readonly months: number;
  readonly suggestedMinor: number;
}

/** The month-end review (PRD §6.12): one screen for the month just ended. */
export interface MonthReview {
  readonly period: Period;
  readonly status: MonthStatus;
  readonly totals: LineFigures;
  /** The biggest few over plan, then under plan (by size of the difference); the full list is the month screen. */
  readonly over: readonly MonthSummaryLine[];
  readonly under: readonly MonthSummaryLine[];
  /** Yearly bills paid from the pot with expenses dated in this month. */
  readonly billsPaid: readonly { readonly itemId: string; readonly name: string; readonly paidMinor: number }[];
  /** Yearly bills due in this month and not fully paid. */
  readonly billsUnpaid: readonly { readonly lineId: string; readonly name: string; readonly remainingMinor: number }[];
  readonly potDeposit: ChecklistAnswer;
  readonly savings: readonly {
    readonly itemId: string;
    readonly name: string;
    readonly plannedMinor: number;
    readonly answer: ChecklistAnswer;
    readonly amountMinor: number | null;
  }[];
  readonly inboxCount: number;
  readonly streaks: readonly OverStreak[];
}

export interface GetMonthReviewCommand {
  readonly actor: Actor;
  readonly period: Period;
}

export interface CloseMonthCommand {
  readonly actor: Actor;
  readonly period: Period;
}

export interface AutoCloseMonthCommand {
  readonly familyId: string;
  /** Today in the family's time zone. */
  readonly today: IsoDate;
}

/** How many months in a row over plan before the review suggests a new amount (Stage 1b plan, Task 3). */
export const STREAK_MONTHS = 3;
/** "The biggest few" over and under plan shown in the review. */
export const REVIEW_TOP = 3;
/** The day the month before is closed if nobody closed it (PRD §6.3). */
export const AUTO_CLOSE_DAY = 10;

type StreakMonth = { readonly lines: readonly { readonly itemId: string; readonly name: string; readonly plannedMinor: number; readonly actualMinor: number }[] };

/**
 * Items over plan in each of the last `streakLength` months (history is oldest first, the reviewed month last). The
 * suggestion is the highest actual in the streak, rounded up to a whole `stepMinor`.
 */
export function overStreaks(history: readonly StreakMonth[], streakLength: number, stepMinor: number): readonly OverStreak[] {
  if (history.length < streakLength) return [];
  const months = history.slice(-streakLength);
  const latest = months[months.length - 1]!;
  const streaks: OverStreak[] = [];
  for (const line of latest.lines) {
    const same = months.map((m) => m.lines.find((l) => l.itemId === line.itemId));
    if (same.some((l) => !l || l.actualMinor <= l.plannedMinor)) continue;
    const highest = Math.max(...same.map((l) => l!.actualMinor));
    streaks.push({ itemId: line.itemId, name: line.name, months: streakLength, suggestedMinor: Math.ceil(highest / stepMinor) * stepMinor });
  }
  return streaks;
}
