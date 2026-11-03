import type { Transaction } from '../expenses';
import type { IsoDate } from '../shared';
import type { DuplicateCandidate, DuplicateReason } from './models';

/** The same key for a pair whichever way round it is given. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const dayNumber = (date: IsoDate) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000;
const normalise = (shop: string) =>
  shop
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

function sameShop(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const [x, y] = [normalise(a), normalise(b)];
  return x !== '' && y !== '' && (x.startsWith(y) || y.startsWith(x));
}

/**
 * Probable duplicates of a just-saved expense (TRD §5.6): the same amount and kind, at most a day apart, and another
 * person, another capture method or the same shop. Never on amount alone; pairs answered Different are skipped.
 */
export function findDuplicateCandidates(
  saved: Transaction,
  others: readonly Transaction[],
  differentPairs: ReadonlySet<string>,
): readonly DuplicateCandidate[] {
  const found: DuplicateCandidate[] = [];
  for (const other of others) {
    if (other.id === saved.id || other.deletedAt !== null || other.mergedInto !== null) continue;
    if (other.familyId !== saved.familyId || other.amountMinor !== saved.amountMinor || other.kind !== saved.kind) continue;
    if (Math.abs(dayNumber(other.txnDate) - dayNumber(saved.txnDate)) > 1) continue;
    if (differentPairs.has(pairKey(saved.id, other.id))) continue;
    const reasons: DuplicateReason[] = [];
    if (other.enteredBy !== saved.enteredBy) reasons.push('other_person');
    if (other.captureMethod !== saved.captureMethod) reasons.push('other_method');
    if (sameShop(other.merchant, saved.merchant)) reasons.push('same_shop');
    if (reasons.length > 0) found.push({ other, reasons });
  }
  return found;
}

/** The one that was there first: earlier save, then id. */
export function earlier(a: Transaction, b: Transaction): Transaction {
  const diff = a.createdAt.getTime() - b.createdAt.getTime();
  return diff < 0 || (diff === 0 && a.id < b.id) ? a : b;
}
