import type { Actor, IsoDate, Period } from '../shared';

export type TransactionKind = 'expense' | 'refund';

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
  readonly captureMethod: 'typed';
  readonly status: 'confirmed';
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
  readonly txnDate: IsoDate;
  readonly allocations: readonly AllocationInput[];
  readonly merchant?: string | null;
  readonly note?: string | null;
  /** Another active member of the family; defaults to the person entering it. */
  readonly paidBy?: string | null;
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
