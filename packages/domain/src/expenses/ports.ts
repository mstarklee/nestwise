import type { DuplicateMatchGateway, EvidenceGateway } from '../duplicates';
import type { MonthStatusGateway } from '../month-budget';
import type { ActivityGateway, IsoDate } from '../shared';
import type { ExpenseFilter, Transaction, TransactionKind } from './models';

/** Every method is scoped to one family. */
export interface TransactionGateway {
  /** Includes soft-deleted transactions. */
  findById(familyId: string, id: string): Promise<Transaction | undefined>;
  /** Inserts the transaction with its allocations; false if the id is already used (a resend). */
  insert(transaction: Transaction): Promise<boolean>;
  /** Replaces the transaction's fields and allocations. */
  update(transaction: Transaction): Promise<void>;
  /** Live (not deleted) transactions of the period, newest first. */
  list(familyId: string, filter: ExpenseFilter): Promise<readonly Transaction[]>;
  /** Live, not merged transactions with this amount and kind dated within a day of txnDate (duplicate candidates). */
  listNear(familyId: string, txnDate: IsoDate, amountMinor: number, kind: TransactionKind): Promise<readonly Transaction[]>;
}

export interface ExpensesGateways {
  readonly transactions: TransactionGateway;
  readonly activity: ActivityGateway;
  readonly duplicates: DuplicateMatchGateway;
  readonly evidence: EvidenceGateway;
  readonly months: MonthStatusGateway;
}

/** Expense writes, duplicate questions, proofs and their activity rows, all or nothing. */
export interface ExpensesUnitOfWork {
  run<T>(work: (gateways: ExpensesGateways) => Promise<T>): Promise<T>;
}
