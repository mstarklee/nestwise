import { assertMinor } from '../shared';

/**
 * Splits a yearly total into 12 monthly set-asides that add up exactly (TRD §4):
 * base = floor(T / 12), r = T − 12·base; months 1…r get base + 1, the rest get base.
 */
export function splitSetAside(totalMinor: number): readonly number[] {
  assertMinor(totalMinor);
  const base = Math.floor(totalMinor / 12);
  const remainder = totalMinor - base * 12;
  return Array.from({ length: 12 }, (_, i) => (i < remainder ? base + 1 : base));
}

/** The set-aside for calendar `month` (1–12): the override if the family set one, else the ÷12 split. */
export function setAsideFor(month: number, yearTotalMinor: number, overrideMinor: number | null): number {
  if (overrideMinor !== null) return overrideMinor;
  return splitSetAside(yearTotalMinor)[month - 1] ?? 0;
}
