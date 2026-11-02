import { describe, expect, it } from 'vitest';
import { sampleFamily } from '../../../../fixtures/sample-family';
import { groupFigures, lineFigures, monthTotals } from '../../src/month-budget';
import { sumMinor } from '../../src/shared';

const actualOf = (itemKey: string) =>
  sumMinor(sampleFamily.october2026Transactions.filter((t) => t.itemKey === itemKey).map((t) => t.amountMinor));

const octoberLines = sampleFamily.monthlyTemplate.map((item) => ({
  groupName: item.groupName,
  plannedMinor: item.amountMinor,
  actualMinor: actualOf(item.key),
}));

describe('month figures — sample October 2026', () => {
  it('totals ₹84,450 spent against ₹81,500 planned: +₹2,950 (PRD test 8)', () => {
    const totals = monthTotals(octoberLines);
    expect(totals.plannedMinor).toBe(8_150_000);
    expect(totals.actualMinor).toBe(8_445_000);
    expect(totals.varianceMinor).toBe(295_000);
    expect(totals.remainingMinor).toBe(-295_000);
  });

  it('groceries +₹2,000 and fruits −₹500 (AC-15 pattern)', () => {
    expect(lineFigures(800_000, 1_000_000).varianceMinor).toBe(200_000);
    expect(lineFigures(300_000, 250_000).varianceMinor).toBe(-50_000);
    expect(lineFigures(300_000, 250_000).remainingMinor).toBe(50_000);
  });

  it('adds up groups', () => {
    const groups = groupFigures(octoberLines);
    expect(groups.get('Food & Dining')).toMatchObject({ plannedMinor: 2_400_000, actualMinor: 2_630_000, varianceMinor: 230_000 });
    expect(groups.get('Utilities & Bills')!.varianceMinor).toBe(-15_000);
    expect([...groups.keys()]).toHaveLength(9);
  });

  it('matches every row of the sample doc §4 item table', () => {
    for (const row of sampleFamily.october2026ItemTable) {
      expect(actualOf(row.itemKey), row.itemKey).toBe(row.actualMinor);
      expect(lineFigures(row.plannedMinor, actualOf(row.itemKey)).varianceMinor, row.itemKey).toBe(row.varianceMinor);
    }
  });

  it('keeps yearly payments out of monthly spending (PRD test 9)', () => {
    expect(sumMinor(sampleFamily.october2026Transactions.map((t) => t.amountMinor))).toBe(8_445_000);
    const yearlyKeys = new Set(sampleFamily.yearlyTemplate.map((i) => i.key));
    expect(sampleFamily.october2026Transactions.some((t) => yearlyKeys.has(t.itemKey))).toBe(false);
  });

  it('keeps ₹204.50 exact (PRD test 12)', () => {
    expect(sampleFamily.october2026Transactions.find((t) => t.id === 'TX-011')!.amountMinor).toBe(20_450);
  });
});

describe('lineFigures', () => {
  it('reports % used, or null when nothing was planned (unplanned spend)', () => {
    expect(lineFigures(800_000, 1_000_000).pct).toBe(1.25);
    expect(lineFigures(0, 5_000).pct).toBeNull();
    expect(lineFigures(0, 0).pct).toBeNull();
  });
});

describe('sample plan totals', () => {
  it('monthly ₹81,500, savings ₹17,000, yearly ₹4,43,000 with 9 dated items', () => {
    expect(sumMinor(sampleFamily.monthlyTemplate.map((i) => i.amountMinor))).toBe(8_150_000);
    expect(sumMinor(sampleFamily.savingsTemplate.map((i) => i.amountMinor))).toBe(1_700_000);
    expect(sumMinor(sampleFamily.yearlyTemplate.map((i) => i.amountMinor))).toBe(44_300_000);
    expect(sampleFamily.yearlyTemplate.filter((i) => i.dueMonth !== null)).toHaveLength(9);
    expect(sampleFamily.october2026Transactions).toHaveLength(36);
  });
});
