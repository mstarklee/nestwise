import { describe, expect, it } from 'vitest';
import { addMonths, comparePeriods, InvalidDateError, periodOf, todayIn, toIsoDate } from '../../src/shared';

describe('periods', () => {
  it('takes the period of a date', () => {
    expect(periodOf(toIsoDate('2026-10-07'))).toEqual({ year: 2026, month: 10 });
  });

  it('adds months across year boundaries, forwards and back', () => {
    expect(addMonths({ year: 2026, month: 11 }, 2)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2027, month: 1 }, -2)).toEqual({ year: 2026, month: 11 });
    expect(addMonths({ year: 2026, month: 11 }, 0)).toEqual({ year: 2026, month: 11 });
    expect(addMonths({ year: 2026, month: 1 }, 24)).toEqual({ year: 2028, month: 1 });
  });

  it('compares periods', () => {
    expect(comparePeriods({ year: 2026, month: 12 }, { year: 2027, month: 1 })).toBeLessThan(0);
    expect(comparePeriods({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toBeGreaterThan(0);
    expect(comparePeriods({ year: 2027, month: 5 }, { year: 2027, month: 5 })).toBe(0);
  });
});

describe('toIsoDate', () => {
  it('accepts real calendar dates, including leap days', () => {
    expect(toIsoDate('2028-02-29')).toBe('2028-02-29');
    expect(toIsoDate('2026-12-31')).toBe('2026-12-31');
  });

  it('refuses impossible or malformed dates', () => {
    for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '26-10-07', '2026-1-7', '']) {
      expect(() => toIsoDate(bad)).toThrow(InvalidDateError);
    }
  });
});

describe('todayIn', () => {
  it("uses the family's time zone, not UTC (00:30 IST on 1 Nov is November)", () => {
    expect(todayIn('Asia/Kolkata', new Date('2026-10-31T19:00:00Z'))).toBe('2026-11-01');
    expect(todayIn('UTC', new Date('2026-10-31T19:00:00Z'))).toBe('2026-10-31');
    expect(todayIn('America/New_York', new Date('2026-11-01T03:00:00Z'))).toBe('2026-10-31');
  });
});
