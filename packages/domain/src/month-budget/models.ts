import { sumMinor } from '../shared';

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
