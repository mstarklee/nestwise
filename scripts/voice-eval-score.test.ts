import type { ParsedEntry } from '@nestwise/domain/capture';
import { toIsoDate } from '@nestwise/domain/shared';
import { describe, expect, it } from 'vitest';
import { type ClipRun, costOf, type ExpectedClip, formatReport, scoreClip, summarise } from './voice-eval-score';

const TODAY = toIsoDate('2026-11-05');

const parsed = (over: Partial<ParsedEntry>): ParsedEntry => ({
  amountMinor: 25000,
  itemId: 'item-groceries',
  yearLineId: null,
  kind: 'expense',
  txnDate: TODAY,
  merchant: null,
  note: '',
  heard: '',
  confidence: { amount: 0.9, item: 0.9 },
  ...over,
});

const run = (entries: readonly ParsedEntry[], over: Partial<ClipRun> = {}): ClipRun => ({
  clip: 'market-1.m4a',
  provider: 'openai',
  parseModel: 'gpt-6.1-terra',
  transcript: 'KPN 250',
  entries,
  sttSeconds: 15,
  ...over,
});

describe('scoreClip', () => {
  it('scores the amount right only on an exact minor-unit match', () => {
    const expected: ExpectedClip = { entries: [{ amountMinor: 25000, itemId: 'item-groceries' }] };

    expect(scoreClip(run([parsed({})]), expected)).toMatchObject({ amountRight: 1, expectedCount: 1 });
    expect(scoreClip(run([parsed({ amountMinor: 24999 })]), expected)).toMatchObject({ amountRight: 0 });
  });

  it('scores the item right only when the item id matches', () => {
    const expected: ExpectedClip = { entries: [{ amountMinor: 25000, itemId: 'item-groceries' }] };

    expect(scoreClip(run([parsed({})]), expected)).toMatchObject({ itemRight: 1 });
    expect(scoreClip(run([parsed({ itemId: 'item-nonveg' })]), expected)).toMatchObject({ amountRight: 1, itemRight: 0 });
  });

  it('counts an expected entry nobody heard as neither amount nor item right', () => {
    const expected: ExpectedClip = { entries: [{ amountMinor: 25000, itemId: 'item-groceries' }, { amountMinor: 50000, itemId: 'item-nonveg' }] };

    expect(scoreClip(run([parsed({})]), expected)).toMatchObject({ expectedCount: 2, amountRight: 1, itemRight: 1, missing: 1 });
  });

  it('matches a bill on its year line, not on an item', () => {
    const expected: ExpectedClip = { entries: [{ amountMinor: 150000, yearLineId: 'line-bike' }] };
    const bill = parsed({ amountMinor: 150000, kind: 'yearly_bill', itemId: null, yearLineId: 'line-bike' });

    expect(scoreClip(run([bill]), expected)).toMatchObject({ amountRight: 1, itemRight: 1 });
  });

  it('counts a row the model invented as an extra, never as a right answer', () => {
    const expected: ExpectedClip = { entries: [{ amountMinor: 25000, itemId: 'item-groceries' }] };

    expect(scoreClip(run([parsed({}), parsed({ amountMinor: 99900 })]), expected)).toMatchObject({ amountRight: 1, extra: 1 });
  });

  it('matches regardless of the order the entries came back in', () => {
    const expected: ExpectedClip = { entries: [{ amountMinor: 25000, itemId: 'item-groceries' }, { amountMinor: 50000, itemId: 'item-nonveg' }] };
    const entries = [parsed({ amountMinor: 50000, itemId: 'item-nonveg' }), parsed({})];

    expect(scoreClip(run(entries), expected)).toMatchObject({ amountRight: 2, itemRight: 2 });
  });

  it('reports a clip with no expected answers as unscored rather than failed', () => {
    const score = scoreClip(run([parsed({})]), undefined);

    expect(score.scored).toBe(false);
    expect(score).toMatchObject({ amountRight: 0, expectedCount: 0 });
  });
});

describe('costOf', () => {
  it('adds the speech cost and the parse cost for the clip', () => {
    const cost = costOf({ provider: 'openai', parseModel: 'gpt-6.1-terra', seconds: 60 });

    // One minute of gpt-transcribe at $0.0045, plus one gpt-6.1-terra parse at $0.004.
    expect(cost).toBeCloseTo(0.0045 + 0.004, 6);
  });

  it('is far cheaper on the small parse model', () => {
    const terra = costOf({ provider: 'openai', parseModel: 'gpt-6.1-terra', seconds: 15 });
    const luna = costOf({ provider: 'openai', parseModel: 'gpt-6-luna', seconds: 15 });

    expect(luna).toBeLessThan(terra);
  });

  it('prices Sarvam speech within a whisker of OpenAI, per minute', () => {
    const openai = costOf({ provider: 'openai', parseModel: 'gpt-6-luna', seconds: 60 });
    const sarvam = costOf({ provider: 'sarvam', parseModel: 'gpt-6-luna', seconds: 60 });

    expect(Math.abs(sarvam - openai)).toBeLessThan(0.005);
  });
});

describe('summarise', () => {
  it('groups the scores by service and parse model', () => {
    const expected: ExpectedClip = { entries: [{ amountMinor: 25000, itemId: 'item-groceries' }] };
    const scores = [
      scoreClip(run([parsed({})], { provider: 'openai' }), expected),
      scoreClip(run([parsed({ itemId: 'item-nonveg' })], { provider: 'sarvam' }), expected),
    ];

    const rows = summarise(scores);

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.provider === 'openai')).toMatchObject({ parseModel: 'gpt-6.1-terra', amountRight: 1, itemRight: 1, expectedCount: 1 });
    expect(rows.find((r) => r.provider === 'sarvam')).toMatchObject({ amountRight: 1, itemRight: 0 });
  });

  it('leaves unscored clips out of the totals but counts them', () => {
    const scores = [scoreClip(run([parsed({})]), undefined)];

    expect(summarise(scores)[0]).toMatchObject({ expectedCount: 0, unscoredClips: 1 });
  });
});

describe('formatReport', () => {
  it('shows what each service heard, per clip', () => {
    const expected: ExpectedClip = { entries: [{ amountMinor: 25000, itemId: 'item-groceries' }] };
    const scores = [
      scoreClip(run([parsed({})], { provider: 'openai', transcript: 'KPN 250' }), expected),
      scoreClip(run([parsed({})], { provider: 'sarvam', transcript: 'KPN irunooru ambadhu' }), expected),
    ];

    const report = formatReport(scores);

    expect(report).toContain('market-1.m4a');
    expect(report).toContain('KPN 250');
    expect(report).toContain('KPN irunooru ambadhu');
    expect(report).toContain('openai');
    expect(report).toContain('sarvam');
  });

  it('states the pass marks the owner is judging against', () => {
    const report = formatReport([]);

    expect(report).toContain('90');
    expect(report).toContain('80');
  });
});
