import type { ParsedEntry } from './models';

/** At or above this, a field is taken as heard correctly; below it, the review screen asks (design §8). */
export const CONFIDENCE_FLOOR = 0.6;

/**
 * Whether the review screen must highlight this row and refuse to add it unchecked: no amount, nothing to put it
 * against, or a field the parse was not sure of. A bill carries a year line rather than an item, so it is not
 * flagged for having no item.
 */
export function needsAttention(entry: ParsedEntry): boolean {
  if (entry.amountMinor === null) return true;
  if (entry.kind === 'expense' && entry.itemId === null) return true;
  if (entry.kind === 'yearly_bill' && entry.yearLineId === null) return true;
  return entry.confidence.amount < CONFIDENCE_FLOOR || entry.confidence.item < CONFIDENCE_FLOOR;
}

/** Splits a batch into the two groups the review screen shows, keeping each group's original order. */
export function splitByKind<T extends ParsedEntry>(entries: readonly T[]): { expenses: T[]; bills: T[] } {
  const expenses: T[] = [];
  const bills: T[] = [];
  for (const entry of entries) (entry.kind === 'yearly_bill' ? bills : expenses).push(entry);
  return { expenses, bills };
}
