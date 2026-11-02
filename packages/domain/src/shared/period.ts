import { InvalidDateError } from './errors';

/** A calendar date, `YYYY-MM-DD`. */
export type IsoDate = string & { readonly __brand: 'IsoDate' };

/** A budget month; `month` is 1–12. */
export interface Period {
  readonly year: number;
  readonly month: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function toIsoDate(value: string): IsoDate {
  const match = ISO_DATE.exec(value);
  if (!match) throw new InvalidDateError(`Not a YYYY-MM-DD date: "${value}"`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new InvalidDateError(`Not a real calendar date: "${value}"`);
  }
  return value as IsoDate;
}

export function periodOf(date: IsoDate): Period {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

export function addMonths(period: Period, n: number): Period {
  const index = period.year * 12 + (period.month - 1) + n;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

export function comparePeriods(a: Period, b: Period): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

/** Today's date in `timeZone` at the instant `now` (the family's zone decides the period, not UTC). */
export function todayIn(timeZone: string, now: Date): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return toIsoDate(`${part('year')}-${part('month')}-${part('day')}`);
}
