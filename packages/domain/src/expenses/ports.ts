import type { ActivityGateway } from '../shared';
import type { ExpenseFilter, Transaction } from './models';

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
}

/** Expense writes plus their activity rows, all or nothing. */
export interface ExpensesUnitOfWork {
  run<T>(work: (gateways: { transactions: TransactionGateway; activity: ActivityGateway }) => Promise<T>): Promise<T>;
}
