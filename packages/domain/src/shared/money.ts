import { InvalidAmountError } from './errors';

export type MinorUnit = 0 | 1 | 2 | 3;

const IGNORED = /[\s,₹$€£¥]/g;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** Throws unless `value` is a safe integer number of minor units. */
export function assertMinor(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new InvalidAmountError(`Not a whole number of minor units: ${value}`);
  }
}

/**
 * Parses a typed amount ("1,35,417", "₹ 500", " 204.50 ") into positive minor units.
 * Grouping commas, currency symbols and spaces are ignored; anything else malformed is refused.
 */
export function parseMinor(input: string, minorUnit: MinorUnit): number {
  const cleaned = input.replace(IGNORED, '');
  const pattern = minorUnit === 0 ? /^\d+$/ : new RegExp(String.raw`^\d+(\.\d{1,${minorUnit}})?$`);
  if (!pattern.test(cleaned)) throw new InvalidAmountError(`Not a valid amount: "${input}"`);

  const [whole = '', fraction = ''] = cleaned.split('.');
  const minor = BigInt(whole + fraction.padEnd(minorUnit, '0'));
  if (minor <= 0n) throw new InvalidAmountError('The amount must be more than zero');
  if (minor > MAX_SAFE) throw new InvalidAmountError('The amount is too large');
  return Number(minor);
}

/** Adds minor units exactly; throws when a value or the running total leaves the safe-integer range. */
export function sumMinor(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    assertMinor(value);
    total += value;
    assertMinor(total);
  }
  return total;
}
