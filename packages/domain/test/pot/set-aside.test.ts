import { describe, expect, it } from 'vitest';
import { setAsideFor, splitSetAside } from '../../src/pot';
import { sumMinor } from '../../src/shared';

describe('splitSetAside', () => {
  it('splits ₹4,43,000 into 8 × 36,916.67 then 4 × 36,916.66, adding up exactly', () => {
    const split = splitSetAside(44_300_000);
    expect(split).toHaveLength(12);
    expect(split.filter((v) => v === 3_691_667)).toHaveLength(8);
    expect(split.filter((v) => v === 3_691_666)).toHaveLength(4);
    expect(split.slice(0, 8).every((v) => v === 3_691_667)).toBe(true);
    expect(sumMinor(split)).toBe(44_300_000);
  });

  it('gives twelve zeros for a zero total', () => {
    expect(splitSetAside(0)).toEqual(Array(12).fill(0));
  });

  it('divides evenly when there is no remainder', () => {
    expect(splitSetAside(1200)).toEqual(Array(12).fill(100));
  });
});

describe('setAsideFor', () => {
  it('uses the split for the month unless an override is set', () => {
    expect(setAsideFor(1, 44_300_000, null)).toBe(3_691_667);
    expect(setAsideFor(11, 44_300_000, null)).toBe(3_691_666);
    expect(setAsideFor(11, 44_300_000, 3_700_000)).toBe(3_700_000);
    expect(setAsideFor(11, 44_300_000, 0)).toBe(0);
  });
});
