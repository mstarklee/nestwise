import { DomainError } from '../shared';

export abstract class YearPlanError extends DomainError {}

export class InvalidYearPlanCommandError extends YearPlanError {
  readonly category = 'invalid' as const;
}

export class YearPlanNotFoundError extends YearPlanError {
  readonly category = 'not_found' as const;
}

export class YearLineNotFoundError extends YearPlanError {
  readonly category = 'not_found' as const;
}

/** A paid yearly item cannot be cancelled. */
export class YearLineNotCancellableError extends YearPlanError {
  readonly category = 'conflict' as const;
}

/** A cancelled or before-NestWise line cannot be marked done. */
export class YearLineNotCompletableError extends YearPlanError {
  readonly category = 'conflict' as const;
}

export class FirstYearCheckDoneError extends YearPlanError {
  readonly category = 'conflict' as const;
}
