import type { Transaction } from '../expenses';
import type { Actor } from '../shared';

/** Why two expenses look like one purchase (TRD §5.6). */
export type DuplicateReason = 'other_person' | 'other_method' | 'same_shop';

export type DuplicateStatus = 'pending' | 'same' | 'different';

/** A question about two expenses: txnA was there first, txnB is the one waiting (pending) for the answer. */
export interface DuplicateMatch {
  readonly id: string;
  readonly familyId: string;
  readonly txnA: string;
  readonly txnB: string;
  readonly reasons: readonly DuplicateReason[];
  readonly status: DuplicateStatus;
  readonly resolvedBy: string | null;
  readonly resolvedAt: Date | null;
  readonly createdAt: Date;
}

export type EvidenceKind = 'voice' | 'receipt' | 'merged_entry';

/** Proof behind an expense: a voice transcript, a receipt photo, or a snapshot of an entry merged into it. */
export interface Evidence {
  readonly id: string;
  readonly familyId: string;
  readonly transactionId: string | null;
  readonly kind: EvidenceKind;
  readonly extracted: unknown;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface DuplicateCandidate {
  readonly other: Transaction;
  readonly reasons: readonly DuplicateReason[];
}

export interface ResolveDuplicateCommand {
  readonly actor: Actor;
  readonly matchId: string;
  readonly answer: 'same' | 'different';
  /** For Same: which of the two to keep; defaults to the earlier one. */
  readonly keepId?: string;
}

/** One Inbox question: the waiting expense and the one it may repeat. */
export interface InboxEntry {
  readonly matchId: string;
  readonly pending: Transaction;
  readonly other: Transaction;
  readonly reasons: readonly DuplicateReason[];
}
