import { DomainError } from '../shared';

export abstract class MonthBudgetError extends DomainError {}

export class InvalidMonthCommandError extends MonthBudgetError {
  readonly category = 'invalid' as const;
}

/** The item is not a live monthly or savings item of this family. */
export class MonthItemNotFoundError extends MonthBudgetError {
  readonly category = 'not_found' as const;
}

export class MonthAlreadyClosedError extends MonthBudgetError {
  readonly category = 'conflict' as const;
}

export class MonthHasExpensesError extends MonthBudgetError {
  readonly category = 'conflict' as const;
}
