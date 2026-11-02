import { comparePeriods, type Period } from '../shared';

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

/** What is still owed on the line (TRD §5.3): never below zero, and zero once the line is closed. */
export function remainingMinor(line: YearLine, paidMinor: number): number {
  if (CLOSED.includes(line.state)) return 0;
  return Math.max(line.plannedMinor - paidMinor, 0);
}

/** The line's status for `current` (TRD §5.3): the first matching rule wins. */
export function yearLineStatus(line: YearLine, paidMinor: number, current: Period): YearLineStatus {
  if (line.state === 'before_nestwise') return 'before_nestwise';
  if (line.state === 'cancelled') return 'cancelled';
  if (line.state === 'done' || (paidMinor >= line.plannedMinor && paidMinor > 0)) return 'paid';

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
