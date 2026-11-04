import type { Period } from '../shared';
import type { CaptureBatch, ParsedEntry, ParseContext } from './models';

/**
 * Turning speech into text. Two services sit behind this (OpenAI and Sarvam), chosen by `STT_PROVIDER`, because
 * which of them hears Tamil better is decided by the family's own recordings (design §3).
 *
 * The audio is handed over and then dropped: no implementation may keep, write or log it (design §9).
 */
export interface SpeechToText {
  transcribe(
    audio: Uint8Array,
    mimeType: string,
    options: { readonly languages: readonly string[] },
  ): Promise<{ readonly text: string; readonly model: string; readonly seconds: number }>;
}

/** Turning a transcript into entries, given the family's own lists. */
export interface ExpenseParser {
  parse(transcript: string, context: ParseContext): Promise<readonly ParsedEntry[]>;
}

/** The staging store for batches waiting to be checked. Scoped to one family. */
export interface CaptureGateway {
  create(batch: CaptureBatch): Promise<void>;
  find(familyId: string, id: string): Promise<CaptureBatch | undefined>;
  /** Unresolved batches, oldest first, whoever spoke them. */
  listWaiting(familyId: string): Promise<readonly CaptureBatch[]>;
  /** Marks the batch dealt with; false if it already was, which is the guard against a double confirm. */
  resolve(familyId: string, id: string, at: Date): Promise<boolean>;
}

/** Monthly voice usage, for the cap and for what Settings shows (design §9). */
export interface UsageGateway {
  countThisMonth(familyId: string, period: Period): Promise<{ readonly voiceCount: number; readonly voiceSeconds: number }>;
  record(familyId: string, period: Period, seconds: number): Promise<void>;
}
