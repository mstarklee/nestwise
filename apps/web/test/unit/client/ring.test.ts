import { describe, expect, test } from 'vitest';
import { byMostUsed, ringOf } from '@/client/ring';

describe('ringOf', () => {
  test('fine, near, over', () => {
    expect(ringOf(890_000, 2_400_000, [80, 100])).toEqual({ percent: 37, tone: 'fine', overMinor: 0 });
    expect(ringOf(2_000_000, 2_000_000, [80, 100])).toEqual({ percent: 100, tone: 'near', overMinor: 0 });
    expect(ringOf(2_630_000, 2_400_000, [80, 100])).toEqual({ percent: 110, tone: 'over', overMinor: 230_000 });
  });
  test('a plan of zero never gives NaN or Infinity', () => {
    expect(ringOf(500_000, 0, [80, 100])).toEqual({ percent: null, tone: 'over', overMinor: 500_000 });
    expect(ringOf(0, 0, [80, 100])).toEqual({ percent: null, tone: 'fine', overMinor: 0 });
  });
  test('gold starts at the lowest level under 100; none means no gold', () => {
    expect(ringOf(1_100_000, 2_000_000, [50, 90, 100]).tone).toBe('near');
    expect(ringOf(1_900_000, 2_000_000, []).tone).toBe('fine');
  });
});

test('byMostUsed puts over-plan and zero-plan spending first, then highest share, ties in original order', () => {
  const g = (name: string, actualMinor: number, plannedMinor: number) => ({ name, actualMinor, plannedMinor });
  const sorted = byMostUsed([g('a', 10, 100), g('b', 50, 100), g('c', 5, 0), g('d', 300, 100), g('e', 10, 100), g('f', 0, 0)]);
  expect(sorted.map((x) => x.name)).toEqual(['c', 'd', 'b', 'a', 'e', 'f']);
});
