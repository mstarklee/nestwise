import { DomainError } from '../shared';

export abstract class ExpensesError extends DomainError {}

export class InvalidExpenseCommandError extends ExpensesError {
  readonly category = 'invalid' as const;
}

/** The item exists but cannot take spending (archived, or a savings item). */
export class ItemNotUsableError extends ExpensesError {
  readonly category = 'invalid' as const;
}

/** No such item in this family. */
export class ExpenseItemNotFoundError extends ExpensesError {
  readonly category = 'not_found' as const;
}

export class TransactionNotFoundError extends ExpensesError {
  readonly category = 'not_found' as const;
}

/** The client id is already used by something that is not this family's expense. */
export class ExpenseIdTakenError extends ExpensesError {
  readonly category = 'conflict' as const;
}

export class ExpenseNotRestorableError extends ExpensesError {
  readonly category = 'conflict' as const;
}
