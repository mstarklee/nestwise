import { describe, expect, it } from 'vitest';
import { remainingMinor, type YearLine, yearLineStatus } from '../../src/year-plan';

const line = (overrides: Partial<YearLine>): YearLine => ({
  id: 'yl-1',
  familyId: 'f1',
  year: 2027,
  itemId: 'item-1',
  name: 'Item',
  plannedMinor: 0,
  dueYear: 2027,
  dueMonth: null,
  dueDay: null,
  state: 'open',
  ...overrides,
});

const may2027 = { year: 2027, month: 5 };
const schoolT1 = line({ name: 'School Fees — Term 1', plannedMinor: 6_000_000, dueMonth: 5 });
const servicing = line({ name: 'Car & Bike Servicing', plannedMinor: 1_500_000 });
const pongal = line({ name: 'Pongal', plannedMinor: 1_500_000 });
const tour = line({ name: 'Family Tour', plannedMinor: 5_000_000 });

describe('yearLineStatus (current period 2027-05)', () => {
  it('a dated bill due this month is due soon, and paid once fully paid', () => {
    expect(yearLineStatus(schoolT1, 0, may2027)).toBe('due_soon');
    expect(yearLineStatus(schoolT1, 6_000_000, may2027)).toBe('paid');
    expect(yearLineStatus(schoolT1, 7_000_000, may2027)).toBe('paid');
  });

  it('a bill due next month is due soon; later is planned', () => {
    expect(yearLineStatus({ ...schoolT1, dueMonth: 6 }, 0, may2027)).toBe('due_soon');
    expect(yearLineStatus({ ...schoolT1, dueMonth: 7 }, 0, may2027)).toBe('planned');
    expect(yearLineStatus(line({ plannedMinor: 100, dueYear: 2027, dueMonth: 1 }), 0, { year: 2026, month: 12 })).toBe('due_soon');
  });

  it('an undated item paid in part is part-paid', () => {
    expect(yearLineStatus(servicing, 400_000, may2027)).toBe('part_paid');
    expect(yearLineStatus(servicing, 0, may2027)).toBe('planned');
  });

  it('a dated bill whose month has passed with money still owed is overdue', () => {
    expect(yearLineStatus({ ...pongal, dueMonth: 1 }, 0, may2027)).toBe('overdue');
    expect(yearLineStatus({ ...pongal, dueMonth: 1 }, 500_000, may2027)).toBe('overdue');
    expect(yearLineStatus({ ...pongal, dueYear: 2026, dueMonth: 12 }, 0, may2027)).toBe('overdue');
  });

  it('marking done with less paid makes it paid with nothing remaining', () => {
    expect(yearLineStatus({ ...servicing, state: 'done' }, 400_000, may2027)).toBe('paid');
    expect(remainingMinor({ ...servicing, state: 'done' }, 400_000)).toBe(0);
  });

  it('before NestWise and cancelled win over everything else', () => {
    expect(yearLineStatus({ ...tour, state: 'before_nestwise' }, 0, may2027)).toBe('before_nestwise');
    expect(yearLineStatus({ ...pongal, dueMonth: 1, state: 'cancelled' }, 0, may2027)).toBe('cancelled');
  });

  it('a zero-amount line with nothing paid is planned, not paid', () => {
    expect(yearLineStatus(line({ plannedMinor: 0 }), 0, may2027)).toBe('planned');
  });
});

describe('remainingMinor', () => {
  it('is planned minus paid, never below zero', () => {
    expect(remainingMinor(servicing, 400_000)).toBe(1_100_000);
    expect(remainingMinor(servicing, 2_000_000)).toBe(0);
  });

  it('is zero for cancelled and before-NestWise lines', () => {
    expect(remainingMinor({ ...tour, state: 'cancelled' }, 0)).toBe(0);
    expect(remainingMinor({ ...tour, state: 'before_nestwise' }, 0)).toBe(0);
  });
});
