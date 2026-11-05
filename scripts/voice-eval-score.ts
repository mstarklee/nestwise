/**
 * Scoring and reporting for the speech comparison (design §3). Pure functions, so they are tested without a key,
 * without audio and without the network; `voice-eval.ts` does the I/O.
 *
 * Pass marks, from PRD §8 decision 18: amount right >= 90%, item right >= 80%.
 */
import type { ParsedEntry } from '@nestwise/domain/capture';
import type { SttProvider } from '../apps/web/src/capture/clip-limits';

export const AMOUNT_PASS_PERCENT = 90;
export const ITEM_PASS_PERCENT = 80;

/** What the owner wrote down by hand as the right answer for one clip. */
export interface ExpectedEntry {
  readonly amountMinor: number;
  readonly itemId?: string;
  readonly yearLineId?: string;
}

export interface ExpectedClip {
  /** The clip's length, when the owner noted it. Used for the speech cost, which no service reports for Sarvam. */
  readonly seconds?: number;
  readonly entries: readonly ExpectedEntry[];
}

export interface ClipRun {
  readonly clip: string;
  readonly provider: SttProvider;
  readonly parseModel: string;
  readonly transcript: string;
  readonly entries: readonly ParsedEntry[];
  readonly sttSeconds: number;
}

export interface ClipScore {
  readonly clip: string;
  readonly provider: SttProvider;
  readonly parseModel: string;
  readonly transcript: string;
  /** False when the owner has not written the right answer for this clip yet. */
  readonly scored: boolean;
  readonly expectedCount: number;
  readonly amountRight: number;
  readonly itemRight: number;
  /** Expected entries no row matched. */
  readonly missing: number;
  /** Rows that matched no expected entry. */
  readonly extra: number;
  readonly costUsd: number;
}

/** Per-minute speech prices, USD, from each service's pricing page (checked 2026-11-05). ₹0.49 ≈ $0.0059. */
const SPEECH_USD_PER_MINUTE: Record<SttProvider, number> = { openai: 0.0045, sarvam: 0.0059 };

/**
 * Cost of one parse, USD, at the plan's working estimate of 1.5k input + 0.5k output tokens, using OpenAI's listed
 * per-million prices. An unknown model falls back to the dearer of the two we use, so a cost is never understated.
 */
const PARSE_USD: Readonly<Record<string, number>> = {
  'gpt-6.1-terra': (1500 / 1e6) * 1.0 + (500 / 1e6) * 5.0,
  'gpt-6-luna': (1500 / 1e6) * 0.1 + (500 / 1e6) * 0.5,
};
const DEAREST_PARSE = Math.max(...Object.values(PARSE_USD));

export function costOf(run: { provider: SttProvider; parseModel: string; seconds: number }): number {
  const speech = (Math.max(run.seconds, 0) / 60) * SPEECH_USD_PER_MINUTE[run.provider];
  return speech + (PARSE_USD[run.parseModel] ?? DEAREST_PARSE);
}

/** The id an expected entry should have landed on: a bill's year line, otherwise a monthly item. */
const expectedTarget = (entry: ExpectedEntry) => entry.yearLineId ?? entry.itemId ?? null;
const parsedTarget = (entry: ParsedEntry) => entry.yearLineId ?? entry.itemId ?? null;

/**
 * Scores one clip against the hand-written answer. Entries are paired by amount rather than by position, so a
 * service that returns the same purchases in a different order is not punished for the order; a row that pairs with
 * nothing is an extra, and an expected entry that pairs with nothing is missing.
 */
export function scoreClip(run: ClipRun, expected: ExpectedClip | undefined): ClipScore {
  const seconds = expected?.seconds ?? run.sttSeconds;
  const costUsd = costOf({ provider: run.provider, parseModel: run.parseModel, seconds });
  const base = { clip: run.clip, provider: run.provider, parseModel: run.parseModel, transcript: run.transcript, costUsd };

  if (!expected || expected.entries.length === 0) {
    return { ...base, scored: false, expectedCount: 0, amountRight: 0, itemRight: 0, missing: 0, extra: run.entries.length };
  }

  const unmatched = [...run.entries];
  let amountRight = 0;
  let itemRight = 0;
  let missing = 0;

  for (const want of expected.entries) {
    const at = unmatched.findIndex((got) => got.amountMinor === want.amountMinor);
    if (at === -1) {
      missing += 1;
      continue;
    }
    const [got] = unmatched.splice(at, 1);
    amountRight += 1;
    const target = expectedTarget(want);
    if (target !== null && parsedTarget(got!) === target) itemRight += 1;
  }

  return { ...base, scored: true, expectedCount: expected.entries.length, amountRight, itemRight, missing, extra: unmatched.length };
}

export interface SummaryRow {
  readonly provider: SttProvider;
  readonly parseModel: string;
  readonly clips: number;
  readonly unscoredClips: number;
  readonly expectedCount: number;
  readonly amountRight: number;
  readonly itemRight: number;
  readonly amountPercent: number;
  readonly itemPercent: number;
  readonly costUsd: number;
  readonly passes: boolean;
}

/** One row per service and parse model, which is the table the owner reads to choose. */
export function summarise(scores: readonly ClipScore[]): readonly SummaryRow[] {
  const groups = new Map<string, ClipScore[]>();
  for (const score of scores) {
    const key = `${score.provider}|${score.parseModel}`;
    groups.set(key, [...(groups.get(key) ?? []), score]);
  }

  return [...groups.values()].map((group) => {
    const expectedCount = sum(group.map((s) => s.expectedCount));
    const amountRight = sum(group.map((s) => s.amountRight));
    const itemRight = sum(group.map((s) => s.itemRight));
    const amountPercent = percent(amountRight, expectedCount);
    const itemPercent = percent(itemRight, expectedCount);
    return {
      provider: group[0]!.provider,
      parseModel: group[0]!.parseModel,
      clips: group.length,
      unscoredClips: group.filter((s) => !s.scored).length,
      expectedCount,
      amountRight,
      itemRight,
      amountPercent,
      itemPercent,
      costUsd: sum(group.map((s) => s.costUsd)),
      passes: expectedCount > 0 && amountPercent >= AMOUNT_PASS_PERCENT && itemPercent >= ITEM_PASS_PERCENT,
    };
  });
}

/** A plain-text report: the summary table first, then every clip with what each service actually heard. */
export function formatReport(scores: readonly ClipScore[]): string {
  const lines: string[] = [
    'NestWise — speech comparison (Tamil and English)',
    `Pass marks: amount right >= ${AMOUNT_PASS_PERCENT}%, item right >= ${ITEM_PASS_PERCENT}% (PRD §8 decision 18)`,
    '',
    'SUMMARY',
  ];

  for (const row of summarise(scores)) {
    const mark = row.expectedCount === 0 ? 'unscored' : row.passes ? 'PASSES' : 'below the mark';
    lines.push(
      `  ${row.provider} + ${row.parseModel}: amount ${row.amountRight}/${row.expectedCount} (${row.amountPercent}%), ` +
        `item ${row.itemRight}/${row.expectedCount} (${row.itemPercent}%), ${row.clips} clips, $${row.costUsd.toFixed(4)} — ${mark}`,
    );
    if (row.unscoredClips > 0) lines.push(`    ${row.unscoredClips} clip(s) had no written answer, so they are not scored`);
  }

  lines.push('', 'PER CLIP');
  for (const clip of [...new Set(scores.map((s) => s.clip))]) {
    lines.push(`  ${clip}`);
    for (const score of scores.filter((s) => s.clip === clip)) {
      lines.push(`    ${score.provider} heard: "${score.transcript}"`);
      lines.push(
        score.scored
          ? `      ${score.parseModel}: amount ${score.amountRight}/${score.expectedCount}, item ${score.itemRight}/${score.expectedCount}` +
              `${score.missing ? `, ${score.missing} missed` : ''}${score.extra ? `, ${score.extra} extra` : ''}`
          : `      ${score.parseModel}: no written answer — ${score.extra} entr${score.extra === 1 ? 'y' : 'ies'} heard, unscored`,
      );
    }
  }

  return lines.join('\n');
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));
