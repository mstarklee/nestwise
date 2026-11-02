import { type Actor, comparePeriods, type Period, sumMinor } from '../shared';

export type YearLineState = 'open' | 'done' | 'cancelled' | 'before_nestwise';

export interface YearLine {
  readonly id: string;
  readonly familyId: string;
  readonly year: number;
  readonly itemId: string;
  readonly name: string;
  readonly plannedMinor: number;
  /** The plan's year, unless a year-end "Still to pay" carried the line into a later year. */
  readonly dueYear: number;
  /** 1–12, or null for "No month yet". Never invented. */
  readonly dueMonth: number | null;
  readonly dueDay: number | null;
  readonly state: YearLineState;
}

export type YearLineStatus = 'planned' | 'due_soon' | 'part_paid' | 'paid' | 'overdue' | 'cancelled' | 'before_nestwise';

const CLOSED: readonly YearLineState[] = ['done', 'cancelled', 'before_nestwise'];

/** Done, or fully paid (a ₹0 line with nothing paid is not paid). */
export function isPaid(line: YearLine, paidMinor: number): boolean {
  return line.state === 'done' || (paidMinor >= line.plannedMinor && paidMinor > 0);
}

/** The yearly total T behind the ÷12 set-aside (TRD §4): every line except cancelled ones, before_nestwise included. */
export function yearTotalMinor(lines: readonly YearLine[]): number {
  return sumMinor(lines.filter((l) => l.state !== 'cancelled').map((l) => l.plannedMinor));
}

/** What is still owed on the line (TRD §5.3): never below zero, and zero once the line is closed. */
export function remainingMinor(line: YearLine, paidMinor: number): number {
  if (CLOSED.includes(line.state)) return 0;
  return Math.max(line.plannedMinor - paidMinor, 0);
}

/** The line's status for `current` (TRD §5.3): the first matching rule wins. */
export function yearLineStatus(line: YearLine, paidMinor: number, current: Period): YearLineStatus {
  if (line.state === 'before_nestwise') return 'before_nestwise';
  if (line.state === 'cancelled') return 'cancelled';
  if (isPaid(line, paidMinor)) return 'paid';

  if (line.dueMonth !== null) {
    const due = { year: line.dueYear, month: line.dueMonth };
    const order = comparePeriods(due, current);
    if (order < 0 && remainingMinor(line, paidMinor) > 0) return 'overdue';
    const next = current.month === 12 ? { year: current.year + 1, month: 1 } : { year: current.year, month: current.month + 1 };
    if (order === 0 || comparePeriods(due, next) === 0) return 'due_soon';
  }

  if (paidMinor > 0 && paidMinor < line.plannedMinor) return 'part_paid';
  return 'planned';
}

/** One family's yearly bills for one calendar year, copied from the yearly template. */
export interface YearPlan {
  readonly id: string;
  readonly familyId: string;
  readonly year: number;
  /** Set once the first-year check has been answered; it never runs twice. */
  readonly firstYearCheckAt: Date | null;
  readonly lines: readonly YearLine[];
}

export interface EnsureYearPlanCommand {
  readonly familyId: string;
  readonly year: number;
}

export interface SetYearLineScheduleCommand {
  readonly actor: Actor;
  readonly yearLineId: string;
  readonly dueMonth: number | null;
  readonly dueDay: number | null;
}

export interface YearLineCommand {
  readonly actor: Actor;
  readonly yearLineId: string;
}

export interface ApplyFirstYearCheckCommand {
  readonly actor: Actor;
  readonly year: number;
  /** The lines the family ticked as still to come this year. */
  readonly stillToComeLineIds: readonly string[];
  /** The month the family started using NestWise; lines due before it were paid before NestWise. */
  readonly setupPeriod: Period;
}

export interface GetYearPlanCommand {
  readonly actor: Actor;
  readonly year: number;
}

export interface YearLineView extends YearLine {
  readonly paidMinor: number;
  readonly remainingMinor: number;
  readonly status: YearLineStatus;
}

export interface YearPlanView {
  readonly year: number;
  readonly firstYearCheckDone: boolean;
  readonly lines: readonly YearLineView[];
  /** Still owed on lines with no month yet, due this year. */
  readonly undatedRemainingMinor: number;
  /** Planned total of every line except cancelled ones. */
  readonly totalMinor: number;
}
