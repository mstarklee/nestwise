export type RingTone = 'fine' | 'near' | 'over';
export interface Ring {
  readonly percent: number | null;
  readonly tone: RingTone;
  readonly overMinor: number;
}

/** How full a spending group is. Thresholds are the family's alert levels; gold starts at the lowest one under 100. */
export function ringOf(actualMinor: number, plannedMinor: number, alertThresholds: readonly number[]): Ring {
  const percent = plannedMinor > 0 ? Math.round((actualMinor * 100) / plannedMinor) : null;
  if (actualMinor > plannedMinor) return { percent, tone: 'over', overMinor: actualMinor - plannedMinor };
  const below = alertThresholds.filter((t) => t < 100);
  const nearAt = below.length > 0 ? Math.min(...below) : null;
  const near = plannedMinor > 0 && nearAt !== null && actualMinor * 100 >= plannedMinor * nearAt;
  return { percent, tone: near ? 'near' : 'fine', overMinor: 0 };
}

/** Over-plan (and zero-plan) spending first, then the highest share used; ties keep their original order. */
export function byMostUsed<T extends { readonly actualMinor: number; readonly plannedMinor: number }>(groups: readonly T[]): T[] {
  const rank = (g: T) => {
    if (g.plannedMinor <= 0) return g.actualMinor > 0 ? Number.POSITIVE_INFINITY : -1;
    return g.actualMinor / g.plannedMinor;
  };
  return groups
    .map((g, i) => ({ g, i, r: rank(g) }))
    .sort((a, b) => (b.r === a.r ? a.i - b.i : b.r - a.r))
    .map((x) => x.g);
}
