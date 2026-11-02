/** `not_signed_in` means no valid session (HTTP 401); `not_allowed` means signed in but not permitted (403). */
export type ErrorCategory = 'invalid' | 'not_found' | 'not_allowed' | 'conflict' | 'not_signed_in';

export abstract class DomainError extends Error {
  abstract readonly category: ErrorCategory;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class InvalidAmountError extends DomainError {
  readonly category = 'invalid' as const;
}

export class InvalidDateError extends DomainError {
  readonly category = 'invalid' as const;
}

export class NotAllowedError extends DomainError {
  readonly category = 'not_allowed' as const;
}
