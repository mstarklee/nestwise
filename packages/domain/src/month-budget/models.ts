import { type Actor, type Period, sumMinor } from '../shared';

/** Planned vs actual for one line, group or month (TRD §5.2). */
export interface LineFigures {
  readonly plannedMinor: number;
  readonly actualMinor: number;
  readonly remainingMinor: number;
  /** actual − planned; positive means over. */
  readonly varianceMinor: number;
  /** actual ÷ planned, or null when nothing was planned ("unplanned spend"). */
  readonly pct: number | null;
}

interface PlannedActual {
  readonly plannedMinor: number;
  readonly actualMinor: number;
}

export function lineFigures(plannedMinor: number, actualMinor: number): LineFigures {
  return {
    plannedMinor,
    actualMinor,
    remainingMinor: plannedMinor - actualMinor,
    varianceMinor: actualMinor - plannedMinor,
    pct: plannedMinor === 0 ? null : actualMinor / plannedMinor,
  };
}

export function monthTotals(lines: readonly PlannedActual[]): LineFigures {
  return lineFigures(sumMinor(lines.map((l) => l.plannedMinor)), sumMinor(lines.map((l) => l.actualMinor)));
}

/** Figures per group name, in the order groups first appear. */
export function groupFigures(lines: readonly (PlannedActual & { readonly groupName: string })[]): ReadonlyMap<string, LineFigures> {
  const byGroup = new Map<string, PlannedActual[]>();
  for (const line of lines) {
    const group = byGroup.get(line.groupName) ?? [];
    group.push(line);
    byGroup.set(line.groupName, group);
  }
  return new Map([...byGroup].map(([name, group]) => [name, monthTotals(group)]));
}

export type MonthStatus = 'draft' | 'active' | 'closed';
export type MonthCreatedFrom = 'template' | 'copy' | 'blank';
export type MonthLineKind = 'monthly' | 'savings';

/** One item's plan for one month. Snapshots keep history readable after an item is renamed. */
export interface MonthLine {
  readonly id: string;
  readonly itemId: string;
  readonly kind: MonthLineKind;
  readonly nameSnapshot: string;
  readonly groupNameSnapshot: string;
  readonly plannedMinor: number;
}

/** A dated copy of the monthly and savings templates; editing it changes only this month. */
export interface MonthBudget {
  readonly id: string;
  readonly familyId: string;
  readonly period: Period;
  readonly status: MonthStatus;
  readonly createdFrom: MonthCreatedFrom;
  readonly lines: readonly MonthLine[];
}

export interface EnsureMonthBudgetCommand {
  readonly familyId: string;
  readonly period: Period;
}

export interface SetMonthLineCommand {
  readonly actor: Actor;
  readonly period: Period;
  readonly itemId: string;
  readonly plannedMinor: number;
}

export interface CopyOrBlankMonthCommand {
  readonly actor: Actor;
  readonly period: Period;
  readonly mode: 'copy_previous' | 'blank';
}

export interface GetMonthSummaryCommand {
  readonly actor: Actor;
  readonly period: Period;
}

export interface MonthSummaryLine extends LineFigures {
  readonly itemId: string;
  readonly name: string;
  readonly groupName: string;
}

export interface MonthSummary {
  readonly period: Period;
  readonly status: MonthStatus;
  readonly lines: readonly MonthSummaryLine[];
  readonly groups: readonly (LineFigures & { readonly groupName: string })[];
  readonly totals: LineFigures;
  readonly savings: {
    readonly lines: readonly { readonly itemId: string; readonly name: string; readonly plannedMinor: number }[];
    readonly plannedMinor: number;
  };
}
