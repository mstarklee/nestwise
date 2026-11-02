import { DomainError } from '../shared';

export abstract class PotError extends DomainError {}

export class InvalidPotCommandError extends PotError {
  readonly category = 'invalid' as const;
}

/** The item is not a live savings item of this family. */
export class ChecklistItemNotFoundError extends PotError {
  readonly category = 'not_found' as const;
}

export class PotDepositAlreadyExistsError extends PotError {
  readonly category = 'conflict' as const;
}

export class SavingsAlreadyConfirmedError extends PotError {
  readonly category = 'conflict' as const;
}

/** "Not this month" cannot be the answer once the line is done. */
export class ChecklistItemAlreadyDoneError extends PotError {
  readonly category = 'conflict' as const;
}
