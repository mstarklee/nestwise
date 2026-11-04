import type { IsoDate } from '../shared';

/**
 * What one spoken entry turns into: everyday spending against a monthly item, or a payment against one of this
 * year's bills. A bill payment moves the pot and the forecast, so the two are never mixed up (design §6).
 */
export type CaptureKind = 'expense' | 'yearly_bill';

/** How sure the parse was, per field, so the review screen knows what to highlight (design §4.2). */
export interface ParsedConfidence {
  readonly amount: number;
  readonly item: number;
}

/**
 * One expense heard in a recording, before anybody has checked it. An amount that was not heard clearly stays
 * `null`: it is never invented, never guessed and never rounded (design §4.2).
 */
export interface ParsedEntry {
  readonly amountMinor: number | null;
  /** The monthly item, when this is everyday spending. */
  readonly itemId: string | null;
  /** This year's bill line, when this is a bill payment. */
  readonly yearLineId: string | null;
  readonly kind: CaptureKind;
  readonly txnDate: IsoDate;
  readonly merchant: string | null;
  readonly note: string;
  /** The words this entry came from, shown on the review row so a mishearing is obvious. */
  readonly heard: string;
  readonly confidence: ParsedConfidence;
}

/**
 * What the parse is told about the family: its live lists, today's date and its currency. Only ever this family's
 * own data (design §9).
 */
export interface ParseContext {
  readonly items: readonly { readonly id: string; readonly name: string; readonly group: string }[];
  readonly yearLines: readonly {
    readonly id: string;
    readonly name: string;
    readonly plannedMinor: number;
    readonly paidMinor: number;
    readonly dueMonth: number | null;
  }[];
  readonly today: IsoDate;
  readonly currencyCode: string;
  readonly minorUnits: number;
}

/** A `ParsedEntry` once it is staged, so the review screen can address and drop individual rows. */
export interface CaptureEntry extends ParsedEntry {
  readonly id: string;
  /** The person removed this row on the review screen; it writes nothing. */
  readonly dropped: boolean;
}

/**
 * One recording's worth of entries, waiting to be checked. It is not a transaction and counts nowhere: real
 * transactions are written only when its speaker confirms it (design §8).
 */
export interface CaptureBatch {
  readonly id: string;
  readonly familyId: string;
  /** Only this person may confirm the batch (design §8). */
  readonly createdBy: string;
  readonly transcript: string;
  readonly sttModel: string;
  readonly parseModel: string;
  readonly entries: readonly CaptureEntry[];
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
}
