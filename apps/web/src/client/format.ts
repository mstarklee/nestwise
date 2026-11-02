/**
 * Money and month display (TRD §4). Amounts are integer minor units; they are turned into a decimal string with
 * integer maths and handed to Intl as a string, so no float ever touches the value.
 */

type MinorUnit = 0 | 1 | 2 | 3;

/** "20450", 2 → "204.50"; keeps the sign. */
export function minorToInput(minor: number, minorUnit: number): string {
  const digits = BigInt(Math.abs(minor)).toString().padStart(minorUnit + 1, '0');
  const whole = minorUnit === 0 ? digits : digits.slice(0, -minorUnit);
  const fraction = minorUnit === 0 ? '' : `.${digits.slice(-minorUnit)}`;
  return `${minor < 0 ? '-' : ''}${whole}${fraction}`;
}

function currencyFormat(currency: string, digits: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Exact amount, e.g. ₹1,35,416.67 — for lists, forms and the ledger. */
export function formatMoney(minor: number, currency: string, minorUnit: MinorUnit | number, locale: string): string {
  // Intl formats decimal strings exactly (no float conversion).
  return currencyFormat(currency, minorUnit, locale).format(minorToInput(minor, minorUnit) as unknown as number);
}

/** Whole units, rounded half up (away from zero), e.g. ₹36,917 — for summary tiles only. */
export function formatMoneyRounded(minor: number, currency: string, minorUnit: MinorUnit | number, locale: string): string {
  const scale = 10n ** BigInt(minorUnit);
  const magnitude = BigInt(Math.abs(minor));
  const whole = (magnitude * 2n + scale) / (scale * 2n);
  return currencyFormat(currency, 0, locale).format(`${minor < 0 ? '-' : ''}${whole}` as unknown as number);
}

/** { year: 2026, month: 11 } → "November 2026". */
export function formatPeriod(period: { year: number; month: number }, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(period.year, period.month - 1, 1));
}

/** { year: 2026, month: 11 } → "Nov". */
export function formatMonthShort(period: { year: number; month: number }, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(period.year, period.month - 1, 1));
}

/** { year: 2026, month: 11 } → "2026-11", the form used in URLs. */
export function toYm(period: { year: number; month: number }): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}`;
}
