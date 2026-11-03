import type { Actor, IsoDate, Period } from '../shared';

export type TransactionKind = 'expense' | 'refund';

/** How the expense was captured: typed now; voice and receipt from Stages 2 and 3. */
export type CaptureMethod = 'typed' | 'voice' | 'receipt';

/** Pending: waiting in the Inbox (a possible duplicate); it counts nowhere until someone answers. */
export type TransactionStatus = 'pending' | 'confirmed';

/** One part of a split: which item the money went to and, for a yearly item, which year's plan it pays. */
export interface Allocation {
  readonly itemId: string;
  readonly amountMinor: number;
  /** Set for yearly items (defaults to the year of txnDate); null for monthly items. */
  readonly planYear: number | null;
}

export interface Transaction {
  /** Made on the phone (UUID v7), so a resend from the offline outbox is recognised. */
  readonly id: string;
  readonly familyId: string;
  readonly kind: TransactionKind;
  readonly amountMinor: number;
  readonly currencyCode: string;
  /** The local date in the family's time zone; it decides the period. */
  readonly txnDate: IsoDate;
  readonly period: Period;
  readonly merchant: string | null;
  readonly note: string | null;
  readonly enteredBy: string;
  readonly paidBy: string | null;
  readonly captureMethod: CaptureMethod;
  readonly status: TransactionStatus;
  /** Set when the family said this was the same purchase as another expense; it then counts nowhere. */
  readonly mergedInto: string | null;
  readonly allocations: readonly Allocation[];
  readonly entryTimeZone: string;
  readonly deletedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** An allocation as the caller gives it; planYear is optional and only kept for yearly items. */
export interface AllocationInput {
  readonly itemId: string;
  readonly amountMinor: number;
  readonly planYear?: number | null;
}

export interface RecordExpenseCommand {
  readonly actor: Actor;
  /** Client idempotency id (UUID). */
  readonly id: string;
  readonly kind?: TransactionKind;
  readonly amountMinor: number;
  /** Defaults to today in the family's time zone (not the phone's, not UTC). */
  readonly txnDate?: IsoDate;
  readonly allocations: readonly AllocationInput[];
  readonly merchant?: string | null;
  readonly note?: string | null;
  /** Another active member of the family; defaults to the person entering it. */
  readonly paidBy?: string | null;
  /** Typed unless a voice or receipt flow (Stages 2 and 3) confirms it. Not taken from the API. */
  readonly captureMethod?: CaptureMethod;
}

export interface RecordExpenseResult {
  readonly transaction: Transaction;
  /** False when the id was already saved (a resend), and the first save is returned. */
  readonly created: boolean;
  /** Set when the new expense may repeat another one; it waits as pending until someone answers. */
  readonly duplicate: { readonly matchId: string; readonly other: Transaction } | null;
}

export interface ExpenseChanges {
  readonly amountMinor?: number;
  readonly txnDate?: IsoDate;
  /** Required when the amount changes on a split; a single-item expense follows the new amount. */
  readonly allocations?: readonly AllocationInput[];
  readonly merchant?: string | null;
  readonly note?: string | null;
  readonly paidBy?: string | null;
}

export interface EditExpenseCommand {
  readonly actor: Actor;
  readonly id: string;
  readonly changes: ExpenseChanges;
}

export interface ExpenseIdCommand {
  readonly actor: Actor;
  readonly id: string;
}

export interface ExpenseFilter {
  readonly period: Period;
  readonly itemId?: string;
  readonly enteredBy?: string;
}

export interface ListExpensesCommand extends ExpenseFilter {
  readonly actor: Actor;
}

/** A deleted expense can be restored for this long. */
export const RESTORE_DAYS = 30;
