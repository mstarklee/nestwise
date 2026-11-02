import { describe, expect, it } from 'vitest';
import { assertMinor, InvalidAmountError, parseMinor, sumMinor } from '../../src/shared';

describe('parseMinor', () => {
  it('parses amounts the way people type them', () => {
    expect(parseMinor('204.50', 2)).toBe(20450);
    expect(parseMinor(' 1,35,417 ', 2)).toBe(13541700);
    expect(parseMinor('₹ 500', 2)).toBe(50000);
    expect(parseMinor('500.5', 2)).toBe(50050);
  });

  it('uses the currency minor unit (JPY 0, KWD 3)', () => {
    expect(parseMinor('1500', 0)).toBe(1500);
    expect(parseMinor('1.234', 3)).toBe(1234);
    expect(() => parseMinor('1500.5', 0)).toThrow(InvalidAmountError);
  });

  it('refuses malformed, negative, empty and zero amounts', () => {
    for (const bad of ['1.2.3', '12.345', '-5', '', 'abc', '0', '0.00', '.5', '5.']) {
      expect(() => parseMinor(bad, 2)).toThrow(InvalidAmountError);
    }
  });

  it('refuses amounts beyond the safe-integer range', () => {
    expect(() => parseMinor('90071992547409.92', 2)).toThrow(InvalidAmountError);
    expect(parseMinor('90071992547409.91', 2)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('sumMinor', () => {
  it('adds minor units exactly', () => {
    expect(sumMinor([800000, 300000, 300000, 500000, 500000])).toBe(2400000);
    expect(sumMinor([])).toBe(0);
  });

  it('throws beyond the safe-integer range', () => {
    expect(() => sumMinor([Number.MAX_SAFE_INTEGER, 1])).toThrow(InvalidAmountError);
  });

  it('refuses non-integer values', () => {
    expect(() => sumMinor([1, 0.5])).toThrow(InvalidAmountError);
  });
});

describe('assertMinor', () => {
  it('accepts safe integers and refuses floats, NaN and unsafe values', () => {
    expect(() => assertMinor(20450)).not.toThrow();
    for (const bad of [204.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => assertMinor(bad)).toThrow(InvalidAmountError);
    }
  });
});

describe('InvalidAmountError', () => {
  it('has category invalid and its own name', () => {
    const error = new InvalidAmountError('bad');
    expect(error.category).toBe('invalid');
    expect(error.name).toBe('InvalidAmountError');
  });
});
