import { expect, test } from 'vitest';
import { billLine, monthCover } from '@/client/bill-status';

test('bill lines', () => {
  expect(billLine('overdue', true)).toBe('overdue');
  expect(billLine('part_paid', false)).toBe('partPaid');
  expect(billLine('paid', true)).toBe('paid');
  expect(billLine('due_soon', true)).toBe('dueThisMonth');
  expect(billLine('planned', false)).toBeNull();
});
test('month cover', () => {
  expect(monthCover(0)).toEqual({ key: 'covers' });
  expect(monthCover(-3_650_000)).toEqual({ key: 'short', shortfallMinor: 3_650_000 });
});
