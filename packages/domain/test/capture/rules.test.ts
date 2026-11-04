import { describe, expect, it } from 'vitest';
import { CONFIDENCE_FLOOR, needsAttention, type ParsedEntry, splitByKind } from '../../src/capture';
import { toIsoDate } from '../../src/shared';

const TODAY = toIsoDate('2026-11-05');

/** A clear everyday expense: "KPN 250" matched to Groceries. */
const entry: ParsedEntry = {
  amountMinor: 25000,
  itemId: 'item-groceries',
  yearLineId: null,
  kind: 'expense',
  txnDate: TODAY,
  merchant: 'KPN',
  note: '',
  heard: 'KPN 250',
  confidence: { amount: 0.98, item: 0.95 },
};

/** A clear yearly bill payment: "bike insurance 1500 paid". A bill carries a year line, never an item. */
const billEntry: ParsedEntry = {
  amountMinor: 150000,
  itemId: null,
  yearLineId: 'line-bike-ins',
  kind: 'yearly_bill',
  txnDate: TODAY,
  merchant: null,
  note: '',
  heard: 'bike insurance 1500 paid',
  confidence: { amount: 0.97, item: 0.93 },
};

describe('needsAttention', () => {
  it('flags an entry with no amount', () => {
    expect(needsAttention({ ...entry, amountMinor: null })).toBe(true);
  });

  it('flags an expense with no item', () => {
    expect(needsAttention({ ...entry, itemId: null })).toBe(true);
  });

  it('flags low amount confidence', () => {
    expect(needsAttention({ ...entry, confidence: { amount: 0.4, item: 0.9 } })).toBe(true);
  });

  it('flags low item confidence', () => {
    expect(needsAttention({ ...entry, confidence: { amount: 0.9, item: 0.4 } })).toBe(true);
  });

  it('leaves a clear entry alone', () => {
    expect(needsAttention(entry)).toBe(false);
  });

  it('leaves a bill with a year line and no item alone', () => {
    expect(needsAttention(billEntry)).toBe(false);
  });

  it('flags a bill with no year line', () => {
    expect(needsAttention({ ...billEntry, yearLineId: null })).toBe(true);
  });

  it('treats the floor itself as confident enough', () => {
    expect(needsAttention({ ...entry, confidence: { amount: CONFIDENCE_FLOOR, item: CONFIDENCE_FLOOR } })).toBe(false);
  });
});

describe('splitByKind', () => {
  it('keeps bills out of the spending list', () => {
    const { expenses, bills } = splitByKind([entry, billEntry]);
    expect(expenses).toEqual([entry]);
    expect(bills).toEqual([billEntry]);
  });

  it('returns empty lists for no entries', () => {
    expect(splitByKind([])).toEqual({ expenses: [], bills: [] });
  });
});
