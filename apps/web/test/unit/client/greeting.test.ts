import { expect, test } from 'vitest';
import { greetingKey } from '@/client/greeting';

test('greeting by the hour in the family time zone', () => {
  expect(greetingKey(new Date('2026-11-05T03:00:00Z'), 'Asia/Kolkata')).toBe('morning');
  expect(greetingKey(new Date('2026-11-05T08:00:00Z'), 'Asia/Kolkata')).toBe('afternoon');
  expect(greetingKey(new Date('2026-11-05T13:00:00Z'), 'Asia/Kolkata')).toBe('evening');
  expect(greetingKey(new Date('2026-11-05T22:00:00Z'), 'Asia/Kolkata')).toBe('evening');
});
