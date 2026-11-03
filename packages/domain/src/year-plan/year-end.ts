import type { Actor } from '../shared';
import type { YearLineView } from './models';

/** A line from last year still open with something left to pay (PRD §5.3). */
export interface YearEndLine {
  readonly id: string;
  readonly name: string;
  readonly plannedMinor: number;
  readonly paidMinor: number;
  readonly remainingMinor: number;
  readonly dueMonth: number | null;
}

export interface YearEndReview {
  readonly year: number;
  readonly lines: readonly YearEndLine[];
}

/** Done closes it (the leftover stays in the pot), drop cancels it, carry moves it into the next year. */
export type YearEndAnswer = { readonly kind: 'done' } | { readonly kind: 'drop' } | { readonly kind: 'carry'; readonly dueMonth: number | null };

export interface GetYearEndReviewCommand {
  readonly actor: Actor;
  readonly year: number;
}

export interface AnswerYearEndLineCommand {
  readonly actor: Actor;
  /** The year being reviewed (last year); the line must belong to it. */
  readonly year: number;
  readonly lineId: string;
  readonly answer: YearEndAnswer;
}

/** The 1 December review of next year's bills. */
export interface NextYearReview {
  readonly year: number;
  readonly lines: readonly YearLineView[];
  /** An Admin said "Looks right"; the card goes away for the whole family. */
  readonly confirmed: boolean;
}

export interface NextYearReviewCommand {
  readonly actor: Actor;
  readonly year: number;
}

export interface SetYearLineAmountCommand {
  readonly actor: Actor;
  readonly lineId: string;
  readonly plannedMinor: number;
}
