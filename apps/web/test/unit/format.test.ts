import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyRounded, formatPeriod, minorToInput } from '../../src/client/format';

describe('formatMoney', () => {
  it('shows exact amounts in the family’s currency and number style', () => {
    expect(formatMoney(13_541_667, 'INR', 2, 'en-IN')).toBe('₹1,35,416.67');
    expect(formatMoney(1500, 'JPY', 0, 'ja-JP')).toBe('￥1,500');
    expect(formatMoney(1234, 'KWD', 3, 'en-KW')).toMatch(/1\.234/);
    expect(formatMoney(5, 'INR', 2, 'en-IN')).toBe('₹0.05');
    expect(formatMoney(-15_000, 'INR', 2, 'en-IN')).toBe('-₹150.00');
    expect(formatMoney(Number.MAX_SAFE_INTEGER, 'INR', 2, 'en-IN')).toBe('₹9,00,71,99,25,47,409.91');
  });
});

describe('formatMoneyRounded', () => {
  it('rounds half up to whole units for summary tiles', () => {
    expect(formatMoneyRounded(3_691_667, 'INR', 2, 'en-IN')).toBe('₹36,917');
    expect(formatMoneyRounded(3_691_666, 'INR', 2, 'en-IN')).toBe('₹36,917');
    expect(formatMoneyRounded(3_691_649, 'INR', 2, 'en-IN')).toBe('₹36,916');
    expect(formatMoneyRounded(50, 'INR', 2, 'en-IN')).toBe('₹1');
    expect(formatMoneyRounded(-3_233_332, 'INR', 2, 'en-IN')).toBe('-₹32,333');
    expect(formatMoneyRounded(1500, 'JPY', 0, 'ja-JP')).toBe('￥1,500');
  });
});

describe('helpers', () => {
  it('turns minor units back into what a person types, and names a month', () => {
    expect(minorToInput(20_450, 2)).toBe('204.50');
    expect(minorToInput(1500, 0)).toBe('1500');
    expect(minorToInput(5, 3)).toBe('0.005');
    expect(formatPeriod({ year: 2026, month: 11 }, 'en-IN')).toBe('November 2026');
  });
});

describe('newId', () => {
  it('makes time-ordered UUID v7 ids', async () => {
    const { newId } = await import('../../src/client/new-id');
    const a = newId(1_700_000_000_000);
    const b = newId(1_700_000_000_001);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
    expect(a.slice(0, 13)).toBe('018bcfe5-6800');
  });
});
