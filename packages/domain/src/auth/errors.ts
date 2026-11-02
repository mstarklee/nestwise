import { DomainError } from '../shared';

export abstract class AuthError extends DomainError {}

export class InvalidAuthCommandError extends AuthError {
  readonly category = 'invalid' as const;
}

export class EmailAlreadyRegisteredError extends AuthError {
  readonly category = 'conflict' as const;
}

/** Wrong email or password: deliberately the same answer for both. */
export class InvalidCredentialsError extends AuthError {
  readonly category = 'not_signed_in' as const;
}

export class NotSignedInError extends AuthError {
  readonly category = 'not_signed_in' as const;
}
